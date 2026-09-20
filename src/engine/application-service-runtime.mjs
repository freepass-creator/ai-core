import { resolveServiceBinding, validateAdapterContract } from '../contracts/engine-adapter-contract.mjs';
import { buildAdapterReceipt } from '../contracts/adapter-receipt.mjs';
import { buildServiceReceipt } from '../contracts/service-receipt.mjs';
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
    receipt_context=null,
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
    let portReceiptSequence=0;
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
          const invokeOptions={
            correlation_id,
            idempotency_key:options.idempotency_key??idempotency_key,
            expected_revision:options.expected_revision??null,
            auth_context:options.auth_context??auth_context,
            execution:options.execution??execution,
          };
          if(receipt_context){
            portReceiptSequence+=1;
            const child=await runtime.invokeWithReceipt(options.repository_operation_id,portInput,{
              ...invokeOptions,
              receipt:{
                receipt_id:`${receipt_context.receipt_id}.child.${portReceiptSequence}`,
                operation_id:`${receipt_context.receipt_id}.op.${portReceiptSequence}`,
                operation_kind:options.repository_operation_id,
                actor:receipt_context.actor,
                executor:repository.repository_id,
                input_refs:options.input_refs??[],
                output_refs:options.output_refs??[],
                evidence_refs:options.evidence_refs??[],
                proof_inputs:options.proof_inputs??null,
                reproducibility:{
                  ...receipt_context.reproducibility,
                  executor_version:repository.repository_version,
                  command_ref:options.repository_operation_id,
                }
              }
            });
            portResults.push({
              port_id:portId,
              binding_kind:'REPOSITORY',
              result:child.repository_result,
              receipt:child.receipt
            });
            return child.repository_result;
          }
          const result=await runtime.invoke(options.repository_operation_id,portInput,invokeOptions);
          portResults.push({port_id:portId,binding_kind:'REPOSITORY',result});
          return result;
        }

        const result=await invocation.invoke(portId,portInput,{
          correlation_id,
          idempotency_key:options.idempotency_key??idempotency_key,
          execution:options.execution??execution,
          auth_context:options.auth_context??auth_context,
        });
        if(receipt_context){
          portReceiptSequence+=1;
          const selected=binding.selected_adapters.find(item=>item.port_id===portId);
          const receipt=buildAdapterReceipt({
            receipt_id:`${receipt_context.receipt_id}.child.${portReceiptSequence}`,
            operation_id:`${receipt_context.receipt_id}.op.${portReceiptSequence}`,
            operation_kind:portId,
            actor:receipt_context.actor,
            executor:selected?.adapter_id??result.adapter_id,
            adapter_result:result,
            input:portInput,
            input_refs:options.input_refs??[],
            output_refs:options.output_refs??[],
            evidence_refs:options.evidence_refs??[],
            proof_inputs:options.proof_inputs??null,
            reproducibility:{
              ...receipt_context.reproducibility,
              executor_version:selected?.adapter_version??result.adapter_version,
              command_ref:portId,
            }
          });
          portResults.push({port_id:portId,binding_kind:'ADAPTER',result,receipt});
          return result;
        }
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

  async function runWithReceipt(useCaseName,input,options={}){
    const {receipt:receiptOptions,...runOptions}=options;
    need(receiptOptions&&typeof receiptOptions==='object','RECEIPT_OPTIONS_REQUIRED');
    need(text(receiptOptions.receipt_id),'RECEIPT_ID_REQUIRED');
    need(text(receiptOptions.actor),'RECEIPT_ACTOR_REQUIRED');
    need(receiptOptions.reproducibility&&typeof receiptOptions.reproducibility.deterministic==='boolean','RECEIPT_REPRODUCIBILITY_REQUIRED');

    const normalizedReceiptContext={
      ...receiptOptions,
      execution:receiptOptions.execution??runOptions.execution??null,
      reproducibility:{
        ...receiptOptions.reproducibility,
        executor_version:receiptOptions.reproducibility.executor_version??service.version,
        command_ref:receiptOptions.reproducibility.command_ref??useCaseName,
      }
    };
    const service_result=await run(useCaseName,input,{
      ...runOptions,
      receipt_context:normalizedReceiptContext,
    });
    const child_receipts=(service_result.port_results??[])
      .filter(item=>item.receipt?.receipt_id)
      .map(item=>({
        receipt:item.receipt,
        relation:item.binding_kind==='REPOSITORY'?'REPOSITORY':'ADAPTER'
      }));

    const receipt=buildServiceReceipt({
      receipt_id:normalizedReceiptContext.receipt_id,
      operation_id:normalizedReceiptContext.operation_id??`${normalizedReceiptContext.receipt_id}.operation`,
      operation_kind:normalizedReceiptContext.operation_kind??`${service.service_id}.${useCaseName}`,
      actor:normalizedReceiptContext.actor,
      executor:normalizedReceiptContext.executor??service.service_id,
      service_result,
      input,
      input_refs:normalizedReceiptContext.input_refs??[],
      output_refs:normalizedReceiptContext.output_refs??[],
      evidence_refs:normalizedReceiptContext.evidence_refs??[],
      child_receipts,
      proof_inputs:normalizedReceiptContext.proof_inputs??null,
      reproducibility:normalizedReceiptContext.reproducibility,
      milestones:normalizedReceiptContext.milestones??[],
      metrics:{
        ...(normalizedReceiptContext.metrics??{}),
        child_receipt_count:child_receipts.length,
      },
      source_revision:service.source?.revision??null,
      execution:normalizedReceiptContext.execution??null,
    });

    return {service_result,receipt,child_receipts:child_receipts.map(item=>item.receipt)};
  }

  return Object.freeze({
    binding:Object.freeze(describe()),
    describe,
    run,
    runWithReceipt,
  });
}
