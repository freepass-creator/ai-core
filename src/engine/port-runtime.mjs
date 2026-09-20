import { resolveBinding, validateAdapterContract } from '../contracts/engine-adapter-contract.mjs';

const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code,details={})=>{if(!condition){const e=new Error(code);e.code=code;e.details=details;throw e;}};
const iso=clock=>new Date(clock()).toISOString();

function timeoutError(adapterId){
  const e=new Error('ADAPTER_TIMEOUT');
  e.code='ADAPTER_TIMEOUT';
  e.adapter_id=adapterId;
  return e;
}

function withTimeout(promise,timeoutMs,adapterId){
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(timeoutError(adapterId)),timeoutMs);})
  ]).finally(()=>clearTimeout(timer));
}

function normalizeImplementation(implementations,adapterId){
  const raw=implementations?.get?.(adapterId)??implementations?.[adapterId];
  if(typeof raw==='function') return {invoke:raw};
  if(raw&&typeof raw.invoke==='function') return raw;
  return null;
}

function mappedCoreCode(adapter,providerCode){
  const mapped=adapter.failure_mapping?.find(x=>x.provider_code===providerCode)?.core_code;
  if(mapped) return mapped;
  if(providerCode==='ADAPTER_TIMEOUT') return 'UPSTREAM_UNAVAILABLE';
  return 'UPSTREAM_INVALID_RESPONSE';
}

function normalizeIssues(value,coreCode=null){
  const issues=Array.isArray(value?.issues)?value.issues.map(issue=>({
    code:text(issue?.code)?issue.code:(coreCode??'UPSTREAM_INVALID_RESPONSE'),
    severity:['INFO','WARNING','ERROR','BLOCKING'].includes(issue?.severity)?issue.severity:'ERROR',
    ...(text(issue?.field)?{field:issue.field}:{}),
    ...(text(issue?.source_path)?{source_path:issue.source_path}:{}),
    ...(text(issue?.message)?{message:issue.message}:{})
  })):[];
  if(coreCode&&!issues.some(x=>x.code===coreCode)) issues.push({code:coreCode,severity:'ERROR'});
  return issues;
}

function resolveConnectorFacade(adapter,connectors,correlation_id,auth_context,execution){
  const binding=adapter.connector_binding;
  if(binding==null) return null;
  const runtime=connectors?.get?.(binding.connector_id)??connectors?.[binding.connector_id];
  need(runtime,'CONNECTOR_RUNTIME_MISSING',{connector_id:binding.connector_id});
  need(runtime.connector_id===binding.connector_id,'CONNECTOR_RUNTIME_ID_MISMATCH');
  need(runtime.connector_version===binding.connector_version,'CONNECTOR_RUNTIME_VERSION_MISMATCH');
  const allowed=new Set(binding.operation_ids);
  for(const operationId of allowed){
    need(runtime.operations?.includes?.(operationId),'CONNECTOR_OPERATION_NOT_AVAILABLE',{connector_id:binding.connector_id,operation_id:operationId});
  }
  return Object.freeze({
    connector_id:binding.connector_id,
    connector_version:binding.connector_version,
    operation_ids:Object.freeze([...allowed]),
    async invoke(operationId,request,{signal=null}={}){
      need(allowed.has(operationId),'CONNECTOR_OPERATION_NOT_ALLOWED',{connector_id:binding.connector_id,operation_id:operationId});
      return runtime.invoke(operationId,request,{correlation_id,auth_context,execution,signal});
    }
  });
}

export function createPortRuntime({
  engine,
  adapters=[],
  profile,
  implementations,
  connectors=null,
  clock=Date.now,
  requireVerifiedBinding=true,
}={}){
  const binding=resolveBinding({engine,adapters,profile,requireVerified:requireVerifiedBinding});
  const adapterById=new Map(adapters.map(adapter=>[adapter.adapter_id,adapter]));
  const selectedByPort=new Map(binding.selected_adapters.map(item=>[item.port_id,item]));

  function describe(){
    return {
      status:binding.status,
      authorization:'NOT_GRANTED',
      engine_id:engine?.engine_id??null,
      engine_version:engine?.version??null,
      project_id:profile?.project_id??null,
      environment:profile?.environment??null,
      subject_revision:profile?.subject_revision??null,
      verification_state:profile?.verification_state??null,
      selected_adapters:binding.selected_adapters.map(x=>({...x})),
      errors:[...binding.errors],
    };
  }

  async function invoke(portId,input,{correlation_id,idempotency_key=null,execution=null,auth_context=null}={}){
    need(binding.status==='RESOLVED','PORT_RUNTIME_BINDING_HOLD',{errors:binding.errors});
    need(text(portId),'PORT_ID_REQUIRED');
    need(text(correlation_id),'CORRELATION_ID_REQUIRED');
    const selected=selectedByPort.get(portId);
    need(selected,'PORT_NOT_BOUND',{port_id:portId});
    const adapter=adapterById.get(selected.adapter_id);
    need(adapter,'ADAPTER_NOT_FOUND',{adapter_id:selected.adapter_id});
    validateAdapterContract(adapter);
    if(adapter.project_scope!=null) need(adapter.project_scope===profile.project_id,'ADAPTER_PROJECT_SCOPE_MISMATCH');
    if(adapter.side_effects===true&&adapter.idempotency==='REQUIRED') need(text(idempotency_key),'IDEMPOTENCY_KEY_REQUIRED');
    const impl=normalizeImplementation(implementations,adapter.adapter_id);
    need(impl,'ADAPTER_IMPLEMENTATION_MISSING',{adapter_id:adapter.adapter_id});

    const startedAt=iso(clock);
    try{
      const connector=resolveConnectorFacade(adapter,connectors,correlation_id,auth_context,execution);
      const raw=await withTimeout(impl.invoke({
        input,
        port_id:portId,
        adapter_id:adapter.adapter_id,
        adapter_version:adapter.adapter_version,
        correlation_id,
        idempotency_key,
        auth_context,
        connector,
        binding:{project_id:profile.project_id,environment:profile.environment,subject_revision:profile.subject_revision},
      }),adapter.timeout_ms,adapter.adapter_id);
      need(raw&&typeof raw==='object'&&!Array.isArray(raw),'ADAPTER_IMPLEMENTATION_RESULT_INVALID');
      const status=['SUCCEEDED','HOLD','FAILED'].includes(raw.status)?raw.status:null;
      need(status,'ADAPTER_IMPLEMENTATION_STATUS_INVALID');
      const providerCode=text(raw.provider_code)?raw.provider_code:null;
      const coreCode=status==='SUCCEEDED'?null:mappedCoreCode(adapter,providerCode??'UNMAPPED_PROVIDER_FAILURE');
      return {
        schema_version:'core-adapter-result/v1',
        adapter_id:adapter.adapter_id,
        adapter_version:adapter.adapter_version,
        provider_id:text(raw.provider_id)?raw.provider_id:null,
        source_revision:adapter.source?.revision??null,
        correlation_id,
        status,
        retryable:coreCode?adapter.retry_policy.retryable_error_codes.includes(coreCode):false,
        data:raw.data??null,
        issues:normalizeIssues(raw,coreCode),
        evidence_refs:Array.isArray(raw.evidence_refs)?raw.evidence_refs.filter(text):[],
        started_at:startedAt,
        ended_at:iso(clock),
        ...(execution?{execution}:{}),
      };
    }catch(error){
      const providerCode=text(error?.code)?error.code:'ADAPTER_EXCEPTION';
      const coreCode=mappedCoreCode(adapter,providerCode);
      return {
        schema_version:'core-adapter-result/v1',
        adapter_id:adapter.adapter_id,
        adapter_version:adapter.adapter_version,
        provider_id:null,
        source_revision:adapter.source?.revision??null,
        correlation_id,
        status:'FAILED',
        retryable:adapter.retry_policy.retryable_error_codes.includes(coreCode),
        data:null,
        issues:[{code:coreCode,severity:'ERROR',message:String(error?.message??providerCode)}],
        evidence_refs:[],
        started_at:startedAt,
        ended_at:iso(clock),
        ...(execution?{execution}:{}),
      };
    }
  }

  return Object.freeze({binding:Object.freeze(describe()),describe,invoke});
}
