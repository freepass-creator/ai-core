import { createHash } from 'node:crypto';

function canonicalize(value){
  if(Array.isArray(value)) return value.map(canonicalize);
  if(value && typeof value==='object'){
    return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalize(value[key])]));
  }
  return value;
}

export function executionIdentityDigest(dimensions){
  const canonical=JSON.stringify(canonicalize(dimensions));
  return 'sha256:'+createHash('sha256').update(canonical).digest('hex');
}

export function createExecutionIdentity({logicalExecutionId,dimensions,createdAt}){
  return {
    schema_version:'core-execution-identity/v1',
    logical_execution_id:logicalExecutionId,
    identity_digest:executionIdentityDigest(dimensions),
    dimensions:canonicalize(dimensions),
    created_at:createdAt
  };
}

export function bindExecutionAttempt(identity,{attemptId,attemptSequence,executionPath,parentAttemptId=null}){
  return {
    logical_execution_id:identity.logical_execution_id,
    identity_digest:identity.identity_digest,
    attempt_id:attemptId,
    attempt_sequence:attemptSequence,
    execution_path:executionPath,
    parent_attempt_id:parentAttemptId
  };
}

export function sameLogicalExecution(left,right){
  return Boolean(
    left &&
    right &&
    left.logical_execution_id===right.logical_execution_id &&
    left.identity_digest===right.identity_digest
  );
}
