const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code)=>{if(!condition) throw new Error(code);};

export function validateRepositoryContract(repository){
  need(repository?.schema_version==='core-repository-contract/v1','REPOSITORY_SCHEMA_VERSION_INVALID');
  need(text(repository.repository_id)&&repository.repository_id.includes('.'),'REPOSITORY_ID_REQUIRED');
  need(text(repository.repository_version),'REPOSITORY_VERSION_REQUIRED');
  need(text(repository.port_id)&&repository.port_id.includes('.'),'REPOSITORY_PORT_REQUIRED');
  need(/^v[1-9][0-9]*$/.test(repository.port_version??''),'REPOSITORY_PORT_VERSION_REQUIRED');
  need(repository?.source?.locator&&repository?.source?.revision,'REPOSITORY_SOURCE_REVISION_REQUIRED');
  need(text(repository.entity_scope),'REPOSITORY_ENTITY_SCOPE_REQUIRED');
  need(Array.isArray(repository.operations)&&repository.operations.length>0,'REPOSITORY_OPERATIONS_REQUIRED');
  need(repository.atomicity&&repository.concurrency,'REPOSITORY_STORAGE_POLICY_REQUIRED');
  need(Array.isArray(repository.error_codes),'REPOSITORY_ERROR_CODES_INVALID');
  need(Array.isArray(repository.verification_profile)&&repository.verification_profile.length>0,'REPOSITORY_VERIFICATION_REQUIRED');

  const ids=new Set();
  let hasWrite=false;
  for(const operation of repository.operations){
    need(text(operation?.operation_id),'REPOSITORY_OPERATION_ID_REQUIRED');
    need(!ids.has(operation.operation_id),`REPOSITORY_OPERATION_DUPLICATE:${operation.operation_id}`);
    ids.add(operation.operation_id);
    need(['READ','LIST','CREATE','MUTATE','UPSERT','DELETE'].includes(operation.kind),'REPOSITORY_OPERATION_KIND_INVALID');
    need(['REQUIRED','SUPPORTED','CALLER_ENFORCED','NOT_APPLICABLE'].includes(operation.idempotency),'REPOSITORY_IDEMPOTENCY_INVALID');
    need(['REQUIRED','SUPPORTED','NOT_APPLICABLE'].includes(operation.expected_revision),'REPOSITORY_EXPECTED_REVISION_INVALID');
    if(operation.side_effects===true){
      hasWrite=true;
      need(operation.kind!=='READ'&&operation.kind!=='LIST','REPOSITORY_WRITE_KIND_MISMATCH');
      need(operation.idempotency!=='NOT_APPLICABLE','REPOSITORY_WRITE_IDEMPOTENCY_REQUIRED');
    }
  }

  if(hasWrite){
    need(repository.concurrency.mode!=='NONE','REPOSITORY_WRITE_CONCURRENCY_REQUIRED');
    need(repository.concurrency.lost_update_protection===true,'REPOSITORY_LOST_UPDATE_PROTECTION_REQUIRED');
    need(repository.error_codes.includes('PERSISTENCE_ERROR'),'REPOSITORY_PERSISTENCE_ERROR_REQUIRED');
  }

  if(repository.connector_binding!=null){
    need(text(repository.connector_binding.connector_id)&&repository.connector_binding.connector_id.includes('.'),'REPOSITORY_CONNECTOR_ID_REQUIRED');
    need(text(repository.connector_binding.connector_version),'REPOSITORY_CONNECTOR_VERSION_REQUIRED');
    need(Array.isArray(repository.connector_binding.operation_map)&&repository.connector_binding.operation_map.length>0,'REPOSITORY_CONNECTOR_OPERATION_MAP_REQUIRED');
    const repositoryOperationIds=new Set(repository.operations.map(op=>op.operation_id));
    const mapped=new Set();
    for(const item of repository.connector_binding.operation_map){
      need(text(item?.repository_operation_id),'REPOSITORY_CONNECTOR_OPERATION_ID_REQUIRED');
      need(repositoryOperationIds.has(item.repository_operation_id),`REPOSITORY_CONNECTOR_UNKNOWN_OPERATION:${item.repository_operation_id}`);
      need(!mapped.has(item.repository_operation_id),`REPOSITORY_CONNECTOR_OPERATION_MAP_DUPLICATE:${item.repository_operation_id}`);
      mapped.add(item.repository_operation_id);
      need(Array.isArray(item.connector_operation_ids)&&item.connector_operation_ids.length>0,'REPOSITORY_CONNECTOR_OPERATIONS_REQUIRED');
      need(new Set(item.connector_operation_ids).size===item.connector_operation_ids.length,`REPOSITORY_CONNECTOR_OPERATION_DUPLICATE:${item.repository_operation_id}`);
    }
    for(const operation of repository.operations){
      need(mapped.has(operation.operation_id),`REPOSITORY_CONNECTOR_OPERATION_UNMAPPED:${operation.operation_id}`);
    }
  }

  return {status:'VALID'};
}
