import { resolveServiceBinding, validateAdapterContract } from '../contracts/engine-adapter-contract.mjs';
import { createAdapterInvocationRuntime } from './adapter-invocation-runtime.mjs';
import { createRepositoryRuntime } from './repository-runtime.mjs';

const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code,details={})=>{if(!condition){const e=new Error(code);e.code=code;e.details=details;throw e;}};
const iso=clock=>new Date(clock()).toISOString();

function normalizeServiceImplementation(implementation){
  if(typeof implementation==='function') return {invoke:implementation};
  if(implementation&&typeof implementation.invoke==='function') return implementation;
  return null;
}

export function createApplicationServiceRuntime({
  service,
  adapters=[],
  repositories=[],
  profile,
  adapterImplementations,
  repositoryImplementations=null,
  connectors=null,
  implementation,
  clock=Date.now,
  requireVerifiedBinding=true,
}={}){
  const binding=resolveServiceBinding({
    service,
    adapters,
    repositories,
    profile,
    requireVerified:requireVerifiedBinding,
  });
  const invocation=createAdapterInvocationRuntime({
    selectedAdapters:binding.selected_adapters,
    adapters,
    profile,
    implementations:adapterImplementations,
    connectors,
    validateAdapter:validateAdapterContract,
    clock,
  });
  const serviceImpl=normalizeServiceImplementation(implementation);
  const useCases=new Map((service?.use_cases??[]).map(useCase=>[useCase.name,useCase]));

  function describe(){
    return {
      status:binding.status,
      authorization:'NOT_GRANTED',
      service_id:service?.service_id??null,
      service_version:service?.version??null,
      project_id:profile?.project_id??null,
      environment:profile?.environment??null,
      subject_revision:profile?.subject_revision??null,
      verification_state:profile?.verification_state??null,
      selected_adapters:binding.selected_adapters.map(x=>({...x})),
      selected_repositories:(binding.selected_repositories??[]).map(x=>({...x})),
      errors:[...binding.errors],
    };
  }

  async function run(useCaseName,input,{
    actor=null,
    idempotency_key=null,
    correlation_id,
    execution=null,
    auth_context=null,
  }={}){
    need(text(useCaseName),'SERVICE_USE_CASE_REQUIRED');
    need(text(correlation_id),'CORRELATION_ID_REQUIRED');
    const useCase=useCases.get(useCaseName);
    need(useCase,'SERVICE_USE_CASE_UNKNOWN',{use_case:useCaseName});

    if(binding.status!=='RESOLVED'){
      return {
        status:'HOLD',
        reason:'SERVICE_RUNTIME_BINDING_HOLD',
        service_id:service.service_id,
        service_version:service.version,
        use_case:useCaseName,
        correlation_id,
        started_at:null,
        ended_at:iso(clock),
        port_results:[],
        result:null,
        errors:[...binding.errors],
      };
    }

    if(useCase.actor_requirement==='REQUIRED'&&!actor){
      return {
        status:'HOLD',
        reason:'SERVICE_ACTOR_REQUIRED',
        service_id:service.service_id,
        service_version:service.version,
        use_case:useCaseName,
        correlation_id,
        started_at:null,
        ended_at:iso(clock),
        port_results:[],
        result:null,
        errors:['SERVICE_ACTOR_REQUIRED'],
      };
    }

    if(useCase.idempotency==='REQUIRED'&&!text(idempotency_key)){
      return {
        status:'HOLD',
        reason:'SERVICE_IDEMPOTENCY_KEY_REQUIRED',
        service_id:service.service_id,
        service_version:service.version,
        use_case:useCaseName,
        correlation_id,
        started_at:null,
        ended_at:iso(clock),
        port_results:[],
        result:null,
        errors:['SERVICE_IDEMPOTENCY_KEY_REQUIRED'],
      };
    }

    need(serviceImpl,'SERVICE_IMPLEMENTATION_REQUIRED');
    const portResults=[];
    const repositoryByPort=new Map((binding.selected_repositories??[]).map(item=>[item.port_id,item]));
    const repositoryById=new Map(repositories.map(item=>[item.repository_id,item]));
    const availablePorts=[...new Set([...invocation.ports,...repositoryByPort.keys()])];
    const ports=Object.freeze({
      available:Object.freeze(availablePorts),
      async invoke(portId,portInput,options={}){
        const repositoryBinding=repositoryByPort.get(portId);
        if(repositoryBinding){
          const repository=repositoryById.get(repositoryBinding.repository_id);
          need(repository,'REPOSITORY_NOT_FOUND',{repository_id:repositoryBinding.repository_id});
          const implementation=repositoryImplementations?.get?.(repository.repository_id)
            ?? repositoryImplementations?.[repository.repository_id];
          const runtime=createRepositoryRuntime({
            repository,
            implementation,
            connectors,
            project_id:profile.project_id,
            clock,
          });
          need(text(options.repository_operation_id),'REPOSITORY_OPERATION_ID_REQUIRED',{port_id:portId});
          const result=await runtime.invoke(options.repository_operation_id,portInput,{
            correlation_id,
            idempotency_key:options.idempotency_key??idempotency_key,
            expected_revision:options.expected_revision??null,
            auth_context:options.auth_context??auth_context,
            execution:options.execution??execution,
          });
          portResults.push({port_id:portId,binding_kind:'REPOSITORY',result});
          return result;
        }

        const result=await invocation.invoke(portId,portInput,{
          correlation_id,
          idempotency_key:options.idempotency_key??idempotency_key,
          execution:options.execution??execution,
          auth_context:options.auth_context??auth_context,
        });
        portResults.push({port_id:portId,binding_kind:'ADAPTER',result});
        return result;
      }
    });

    const startedAt=iso(clock);
    try{
      const result=await serviceImpl.invoke({
        use_case:useCase,
        input,
        actor,
        idempotency_key,
        correlation_id,
        transaction_boundary:useCase.transaction_boundary,
        ports,
      });
      need(result&&typeof result==='object'&&!Array.isArray(result),'SERVICE_RESULT_INVALID');
      const status=['SUCCEEDED','HOLD','FAILED'].includes(result.status)?result.status:null;
      need(status,'SERVICE_RESULT_STATUS_INVALID');
      if(status==='FAILED'){
        need(text(result.error_code),'SERVICE_ERROR_CODE_REQUIRED');
        need((useCase.error_codes??[]).includes(result.error_code),'SERVICE_ERROR_CODE_UNDECLARED',{error_code:result.error_code});
      }
      return {
        status,
        reason:status==='SUCCEEDED'?null:(result.error_code??result.reason??'SERVICE_EXECUTION_'+status),
        service_id:service.service_id,
        service_version:service.version,
        use_case:useCaseName,
        correlation_id,
        started_at:startedAt,
        ended_at:iso(clock),
        port_results:portResults,
        result:result.data??null,
        errors:status==='SUCCEEDED'?[]:[result.error_code??result.reason??'SERVICE_EXECUTION_'+status],
      };
    }catch(error){
      const code=text(error?.code)?error.code:'SERVICE_EXECUTION_FAILED';
      const declared=(useCase.error_codes??[]).includes(code);
      return {
        status:'FAILED',
        reason:declared?code:'SERVICE_EXECUTION_FAILED',
        service_id:service.service_id,
        service_version:service.version,
        use_case:useCaseName,
        correlation_id,
        started_at:startedAt,
        ended_at:iso(clock),
        port_results:portResults,
        result:null,
        errors:[declared?code:'SERVICE_EXECUTION_FAILED'],
      };
    }
  }

  return Object.freeze({
    binding:Object.freeze(describe()),
    describe,
    run,
  });
}
