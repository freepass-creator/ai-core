const need=(condition,code)=>{if(!condition) throw new Error(code);};

export function evaluateCheckerManifest(manifest){
  need(manifest?.schema_version==='qa-checker-manifest/v1','QA_CHECKER_MANIFEST_INVALID');
  const ids=new Set();
  const issues=[];
  for(const checker of manifest.checkers??[]){
    if(ids.has(checker.checker_id)) issues.push({code:'QA_CHECKER_DUPLICATE',checker_id:checker.checker_id});
    ids.add(checker.checker_id);

    if(checker.classification==='REQUIRED' && !checker.command){
      issues.push({code:'QA_REQUIRED_CHECKER_COMMAND_MISSING',checker_id:checker.checker_id});
    }
    if(checker.classification==='REQUIRED' && checker.negative_control?.required && checker.negative_control.status!=='PROVEN'){
      issues.push({code:'QA_NEGATIVE_CONTROL_NOT_PROVEN',checker_id:checker.checker_id});
    }
    if(checker.classification==='PENDING' && !checker.reason){
      issues.push({code:'QA_PENDING_REASON_MISSING',checker_id:checker.checker_id});
    }
  }
  return {
    status:issues.length?'HOLD':'READY_WITHIN_MANIFEST',
    required:(manifest.checkers??[]).filter(x=>x.classification==='REQUIRED').length,
    manual:(manifest.checkers??[]).filter(x=>x.classification==='MANUAL').length,
    pending:(manifest.checkers??[]).filter(x=>x.classification==='PENDING').length,
    issues,
  };
}

export function summarizeQaResult(result){
  need(result?.schema_version==='qa-result/v1','QA_RESULT_INVALID');
  const counts={PASS:0,FAIL:0,SKIP:0,UNKNOWN:0};
  for(const check of result.checks??[]) counts[check.status]=(counts[check.status]??0)+1;

  const productionClaim=result.proof_level==='PRODUCTION';
  if(productionClaim){
    need(result.environment==='PRODUCTION','QA_PRODUCTION_PROOF_ENVIRONMENT_MISMATCH');
    need(result.target?.target_id,'QA_PRODUCTION_TARGET_REQUIRED');
    need(result.target?.observed_revision,'QA_PRODUCTION_REVISION_REQUIRED');
    need(result.target.observed_revision===result.subject_revision,'QA_PRODUCTION_REVISION_MISMATCH');
  }

  const status=counts.FAIL>0?'FAILED'
    :counts.UNKNOWN>0||counts.SKIP>0?'HOLD'
    :'PASSED_WITHIN_PROOF_LEVEL';

  return {
    status,
    proof_level:result.proof_level,
    counts,
    production_proven:productionClaim && status==='PASSED_WITHIN_PROOF_LEVEL',
  };
}

export function evaluateHealth(health,{now=Date.now()}={}){
  need(health?.schema_version==='observability-health/v1','OBSERVABILITY_HEALTH_INVALID');
  const issues=[];
  let worst='OK';
  const rank={OK:0,UNKNOWN:1,DEGRADED:2,FAIL:3};

  for(const check of health.checks??[]){
    let effective=check.status;
    if(check.kind==='FRESHNESS' && check.observed_at && Number.isInteger(check.stale_after_seconds)){
      const ageSeconds=(now-Date.parse(check.observed_at))/1000;
      if(Number.isFinite(ageSeconds) && ageSeconds>check.stale_after_seconds && rank[effective]<rank.DEGRADED){
        effective='DEGRADED';
        issues.push({code:'OBSERVABILITY_SOURCE_STALE',check:check.name,age_seconds:Math.floor(ageSeconds)});
      }
    }
    if(rank[effective]>rank[worst]) worst=effective;
  }
  return {status:worst,issues};
}

export function evaluateJobStatus(job){
  need(job?.schema_version==='observability-job-status/v1','OBSERVABILITY_JOB_STATUS_INVALID');
  const issues=[];
  if(job.schedule_state==='DISABLED') issues.push('JOB_DISABLED');
  if(job.schedule_state==='UNKNOWN') issues.push('JOB_SCHEDULE_UNKNOWN');
  if(job.last_result==='SUCCEEDED' && !job.terminal_evidence_ref) issues.push('JOB_SUCCESS_WITHOUT_TERMINAL_EVIDENCE');
  if(job.last_result==='SUCCEEDED' && !job.run_revision) issues.push('JOB_SUCCESS_WITHOUT_RUN_REVISION');
  return {
    status:issues.length?'HOLD':'OBSERVED',
    issues,
  };
}
