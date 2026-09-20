const need=(condition,code)=>{if(!condition) throw new Error(code);};

export function evaluateReleaseProof(proof){
  need(proof?.schema_version==='governance-release-proof/v1','GOVERNANCE_RELEASE_PROOF_INVALID');
  const failures=[];
  if(proof.build_status!=='PASS') failures.push('BUILD_NOT_VERIFIED');
  if(proof.deployment?.status!=='READY') failures.push('DEPLOYMENT_NOT_READY');
  if(proof.production_observation?.reachable!==true) failures.push('PRODUCTION_NOT_REACHABLE');
  if(!proof.production_observation?.observed_revision) failures.push('PRODUCTION_REVISION_UNKNOWN');
  if(proof.production_observation?.observed_revision && proof.production_observation.observed_revision!==proof.expected_revision){
    failures.push('PRODUCTION_REVISION_MISMATCH');
  }
  if(proof.runtime_smoke?.status!=='PASS') failures.push('RUNTIME_SMOKE_NOT_VERIFIED');
  if(proof.rollback?.available!==true || !proof.rollback?.previous_revision || !proof.rollback?.plan_ref){
    failures.push('ROLLBACK_NOT_READY');
  }

  const expectedResult=failures.length
    ? (proof.build_status==='FAIL'||proof.deployment?.status==='FAILED'||proof.runtime_smoke?.status==='FAIL'?'FAILED':'HOLD')
    :'VERIFIED';

  return {result:expectedResult,failures,declared_result:proof.result,consistent:proof.result===expectedResult};
}

export function evaluateProjectObservation(observation,{maxAgeSeconds=86400,now=Date.now()}={}){
  need(observation?.schema_version==='governance-project-observation/v1','GOVERNANCE_PROJECT_OBSERVATION_INVALID');
  if(observation.status==='UNKNOWN'){
    return {status:'UNKNOWN',fresh:false,reason:observation.failure_reason||'OBSERVATION_UNAVAILABLE'};
  }
  if(!observation.head_revision) return {status:'HOLD',fresh:false,reason:'OBSERVED_HEAD_MISSING'};
  const age=(now-Date.parse(observation.observed_at))/1000;
  if(!Number.isFinite(age)) return {status:'HOLD',fresh:false,reason:'OBSERVED_AT_INVALID'};
  if(age>maxAgeSeconds) return {status:'STALE',fresh:false,reason:'PROJECT_OBSERVATION_STALE',age_seconds:Math.floor(age)};
  return {status:'OBSERVED',fresh:true,head_revision:observation.head_revision,age_seconds:Math.max(0,Math.floor(age))};
}

export function evaluateException(record,{now=Date.now()}={}){
  need(record?.schema_version==='governance-exception/v1','GOVERNANCE_EXCEPTION_INVALID');
  if(record.status==='CLOSED') return {active:false,status:'CLOSED'};
  if(record.expires_at && Date.parse(record.expires_at)<=now) return {active:false,status:'EXPIRED'};
  if(record.status==='EXPIRED') return {active:false,status:'EXPIRED'};
  if(record.status==='PERMANENT_PROFILE_CANDIDATE') return {active:false,status:'REVIEW_REQUIRED'};
  return {active:record.status==='ACTIVE',status:record.status};
}

export function evaluateRepositoryLifecycle(record){
  need(record?.schema_version==='governance-repository-lifecycle/v1','GOVERNANCE_REPOSITORY_LIFECYCLE_INVALID');
  const issues=[];
  if(record.status==='REFERENCE' && !record.reference_purpose) issues.push('REFERENCE_PURPOSE_REQUIRED');
  if(record.status==='RETIRE' && !(record.retirement_gates??[]).length) issues.push('RETIREMENT_GATES_REQUIRED');
  if(record.status==='ACTIVE' && !record.authority) issues.push('ACTIVE_AUTHORITY_REQUIRED');
  return {status:issues.length?'HOLD':'VALID_WITHIN_RECORD',issues};
}

export function assertDeprecationTransition(from,to){
  const order=['ACTIVE','DEPRECATED','READ_ONLY','RETIRED','REMOVED'];
  need(order.includes(from)&&order.includes(to),'GOVERNANCE_DEPRECATION_STATE_INVALID');
  const delta=order.indexOf(to)-order.indexOf(from);
  need(delta>=0,'GOVERNANCE_DEPRECATION_REVERSE_FORBIDDEN');
  need(delta<=1,'GOVERNANCE_DEPRECATION_SKIP_FORBIDDEN');
  return true;
}
