const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code)=>{if(!condition) throw new Error(code);};
const iso=clock=>new Date(clock()).toISOString();

export function validateConnectorContract(connector){
  need(connector?.schema_version==='core-connector-contract/v1','CONNECTOR_SCHEMA_VERSION_INVALID');
  need(text(connector.connector_id)&&connector.connector_id.includes('.'),'CONNECTOR_ID_REQUIRED');
  need(text(connector.connector_version),'CONNECTOR_VERSION_REQUIRED');
  need(['HTTP','DATABASE','QUEUE','FILESYSTEM','SDK','IPC','OTHER'].includes(connector.transport),'CONNECTOR_TRANSPORT_INVALID');
  need(Array.isArray(connector.operations)&&connector.operations.length>0,'CONNECTOR_OPERATIONS_REQUIRED');
  const ids=connector.operations.map(x=>x?.operation_id);
  need(new Set(ids).size===ids.length,'CONNECTOR_OPERATION_DUPLICATE');
  need(Number.isInteger(connector.timeout_ms)&&connector.timeout_ms>0,'CONNECTOR_TIMEOUT_INVALID');
  need(connector.auth&&Array.isArray(connector.auth.credential_refs),'CONNECTOR_AUTH_INVALID');
  return {status:'VALID'};
}

function normalizeImplementation(implementation){
  if(typeof implementation==='function') return {invoke:implementation};
  if(implementation&&typeof implementation.invoke==='function') return implementation;
  return null;
}

function failureKind(error){
  if(error?.code==='CONNECTOR_TIMEOUT') return 'TIMEOUT';
  if(error?.name==='AbortError'||error?.code==='ABORT_ERR') return 'ABORTED';
  if(['UNAVAILABLE','AUTH','PROTOCOL','UNKNOWN'].includes(error?.failure_kind)) return error.failure_kind;
  return 'UNKNOWN';
}

export function createConnectorRuntime({connector,implementation,clock=Date.now}={}){
  validateConnectorContract(connector);
  const impl=normalizeImplementation(implementation);
  need(impl,'CONNECTOR_IMPLEMENTATION_REQUIRED');
  const operationById=new Map(connector.operations.map(op=>[op.operation_id,op]));

  async function invoke(operationId,request,{correlation_id,auth_context=null,execution=null,signal=null}={}){
    need(text(operationId),'CONNECTOR_OPERATION_ID_REQUIRED');
    need(text(correlation_id),'CORRELATION_ID_REQUIRED');
    const operation=operationById.get(operationId);
    need(operation,'CONNECTOR_OPERATION_UNKNOWN');

    const startedAt=iso(clock);
    const controller=new AbortController();
    if(signal){
      if(signal.aborted) controller.abort(signal.reason);
      else signal.addEventListener('abort',()=>controller.abort(signal.reason),{once:true});
    }

    let timer;
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        const error=new Error('CONNECTOR_TIMEOUT');
        error.code='CONNECTOR_TIMEOUT';
        controller.abort(error);
        reject(error);
      },connector.timeout_ms);
    });

    try{
      const raw=await Promise.race([
        Promise.resolve(impl.invoke({
          operation,
          request,
          correlation_id,
          auth_context,
          signal:connector.abort_supported?controller.signal:null,
          connector:{id:connector.connector_id,version:connector.connector_version,transport:connector.transport,provider_scope:connector.provider_scope}
        })),
        timeout
      ]);
      need(raw&&typeof raw==='object'&&!Array.isArray(raw),'CONNECTOR_RESULT_INVALID');
      const status=raw.status==='FAILED'?'FAILED':'SUCCEEDED';
      const kind=status==='FAILED'
        ? (['TIMEOUT','UNAVAILABLE','AUTH','PROTOCOL','ABORTED','UNKNOWN'].includes(raw.failure_kind)?raw.failure_kind:'UNKNOWN')
        : null;
      return {
        schema_version:'core-connector-result/v1',
        connector_id:connector.connector_id,
        connector_version:connector.connector_version,
        operation_id:operationId,
        correlation_id,
        status,
        failure_kind:kind,
        data:raw.data??null,
        evidence_refs:Array.isArray(raw.evidence_refs)?raw.evidence_refs.filter(text):[],
        raw_ref:text(raw.raw_ref)?raw.raw_ref:null,
        started_at:startedAt,
        ended_at:iso(clock),
        ...(execution?{execution}:{})
      };
    }catch(error){
      return {
        schema_version:'core-connector-result/v1',
        connector_id:connector.connector_id,
        connector_version:connector.connector_version,
        operation_id:operationId,
        correlation_id,
        status:'FAILED',
        failure_kind:failureKind(error),
        data:null,
        evidence_refs:[],
        raw_ref:null,
        started_at:startedAt,
        ended_at:iso(clock),
        ...(execution?{execution}:{})
      };
    }finally{
      clearTimeout(timer);
    }
  }

  return Object.freeze({
    connector_id:connector.connector_id,
    connector_version:connector.connector_version,
    transport:connector.transport,
    operations:Object.freeze(connector.operations.map(x=>x.operation_id)),
    invoke
  });
}
