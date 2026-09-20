import { buildRepositoryReceipt } from '../contracts/repository-receipt.mjs';
import { validateRepositoryContract } from '../contracts/repository-contract.mjs';
import { createBoundConnectorFacade } from './adapter-invocation-runtime.mjs';

const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code,details={})=>{if(!condition){const e=new Error(code);e.code=code;e.details=details;throw e;}};
const iso=clock=>new Date(clock()).toISOString();

function implementationOf(value){
  if(typeof value==='function') return {invoke:value};
  if(value&&typeof value.invoke==='function') return value;
  return null;
}

function normalizedErrorCode(repository,rawCode){
  if(text(rawCode)&&repository.error_codes.includes(rawCode)) return rawCode;
  return repository.error_codes.includes('PERSISTENCE_ERROR')?'PERSISTENCE_ERROR':(repository.error_codes[0]??'PERSISTENCE_ERROR');
}

export function createRepositoryRuntime({
  repository,
  implementation,
  connectors=null,
  project_id=null,
  clock=Date.now,
}={}){
  validateRepositoryContract(repository);
  if(repository.project_scope!=null&&project_id!=null){
    need(repository.project_scope===project_id,'REPOSITORY_PROJECT_SCOPE_MISMATCH');
  }
  const impl=implementationOf(implementation);
  need(impl,'REPOSITORY_IMPLEMENTATION_REQUIRED');
  const operations=new Map(repository.operations.map(op=>[op.operation_id,op]));

  async function invoke(operationId,input,{
    correlation_id,
    idempotency_key=null,
    expected_revision=null,
    auth_context=null,
    execution=null,
  }={}){
    need(text(operationId),'REPOSITORY_OPERATION_ID_REQUIRED');
    need(text(correlation_id),'CORRELATION_ID_REQUIRED');
    const operation=operations.get(operationId);
    need(operation,'REPOSITORY_OPERATION_UNKNOWN');

    if(operation.idempotency==='REQUIRED') need(text(idempotency_key),'REPOSITORY_IDEMPOTENCY_KEY_REQUIRED');
    if(operation.expected_revision==='REQUIRED') need(expected_revision!==null&&expected_revision!==undefined,'REPOSITORY_EXPECTED_REVISION_REQUIRED');

    const startedAt=iso(clock);
    try{
      const connectorMap=repository.connector_binding?.operation_map?.find(
        item=>item.repository_operation_id===operationId
      )??null;
      const connectorBinding=repository.connector_binding==null?null:{
        connector_id:repository.connector_binding.connector_id,
        connector_version:repository.connector_binding.connector_version,
        operation_ids:connectorMap?.connector_operation_ids??[]
      };
      const connector=createBoundConnectorFacade({
        binding:connectorBinding,
        connectors,
        correlation_id,
        auth_context,
        execution,
      });
      const raw=await impl.invoke({
        operation,
        input,
        correlation_id,
        idempotency_key,
        expected_revision,
        connector,
        storage_policy:{
          atomicity:structuredClone(repository.atomicity),
          concurrency:structuredClone(repository.concurrency),
          revision_policy:repository.revision_policy,
        }
      });
      need(raw&&typeof raw==='object'&&!Array.isArray(raw),'REPOSITORY_RESULT_INVALID');
      const status=['SUCCEEDED','HOLD','FAILED'].includes(raw.status)?raw.status:null;
      need(status,'REPOSITORY_RESULT_STATUS_INVALID');
      const errorCode=status==='SUCCEEDED'?null:normalizedErrorCode(repository,raw.error_code);
      return {
        schema_version:'core-repository-result/v1',
        repository_id:repository.repository_id,
        repository_version:repository.repository_version,
        operation_id:operationId,
        correlation_id,
        status,
        error_code:errorCode,
        data:raw.data??null,
        revision:raw.revision??null,
        evidence_refs:Array.isArray(raw.evidence_refs)?raw.evidence_refs.filter(text):[],
        started_at:startedAt,
        ended_at:iso(clock),
      };
    }catch(error){
      return {
        schema_version:'core-repository-result/v1',
        repository_id:repository.repository_id,
        repository_version:repository.repository_version,
        operation_id:operationId,
        correlation_id,
        status:'FAILED',
        error_code:normalizedErrorCode(repository,error?.code),
        data:null,
        revision:null,
        evidence_refs:[],
        started_at:startedAt,
        ended_at:iso(clock),
      };
    }
  }

  async function invokeWithReceipt(operationId,input,options={}){
    const {receipt:receiptOptions,...invokeOptions}=options;
    need(receiptOptions&&typeof receiptOptions==='object','RECEIPT_OPTIONS_REQUIRED');
    const repository_result=await invoke(operationId,input,invokeOptions);
    const receipt=buildRepositoryReceipt({
      ...receiptOptions,
      repository_result,
      input,
      source_revision:receiptOptions.source_revision??repository.source?.revision??null
    });
    return {repository_result,receipt};
  }

  return Object.freeze({
    repository_id:repository.repository_id,
    repository_version:repository.repository_version,
    port_id:repository.port_id,
    operations:Object.freeze([...operations.keys()]),
    invoke,
    invokeWithReceipt,
  });
}
