import { createHash } from 'node:crypto';

const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code)=>{if(!condition) throw new Error(code);};

export function executionLeaseKey(execution){
  need(execution&&text(execution.logical_execution_id),'EXECUTION_LEASE_LOGICAL_ID_REQUIRED');
  need(text(execution.identity_digest),'EXECUTION_LEASE_IDENTITY_DIGEST_REQUIRED');
  return 'execution-lease.'+createHash('sha256')
    .update(execution.logical_execution_id+'::'+execution.identity_digest)
    .digest('hex');
}

export function validateExecutionLease(lease){
  need(lease?.schema_version==='core-execution-lease/v1','EXECUTION_LEASE_SCHEMA_INVALID');
  need(text(lease.lease_id)&&lease.lease_id.startsWith('lease.'),'EXECUTION_LEASE_ID_REQUIRED');
  need(text(lease.logical_execution_id),'EXECUTION_LEASE_LOGICAL_ID_REQUIRED');
  need(text(lease.identity_digest),'EXECUTION_LEASE_IDENTITY_DIGEST_REQUIRED');
  need(text(lease.attempt_id),'EXECUTION_LEASE_ATTEMPT_ID_REQUIRED');
  need(text(lease.owner_id),'EXECUTION_LEASE_OWNER_REQUIRED');
  need(Number.isSafeInteger(lease.fencing_token)&&lease.fencing_token>=1,'EXECUTION_LEASE_FENCE_INVALID');
  need(['ACTIVE','RELEASED','EXPIRED','SUPERSEDED'].includes(lease.state),'EXECUTION_LEASE_STATE_INVALID');
  need(text(lease.claimed_at)&&text(lease.lease_until),'EXECUTION_LEASE_TIME_REQUIRED');
  return {status:'VALID'};
}

export function leaseMatchesExecution(lease,execution){
  return Boolean(
    lease &&
    execution &&
    lease.logical_execution_id===execution.logical_execution_id &&
    lease.identity_digest===execution.identity_digest &&
    lease.attempt_id===execution.attempt_id
  );
}
