const HUMAN_GATE_SCOPES = new Set(['deployment','production_data','delete','permissions','payment','legal_filing','physical_harm','weapons']);

export function taskSignature(task={}) {
  const parts = [
    task.domain ?? 'unknown',
    task.task_type ?? inferTaskType(task),
    task.risk ?? 'A',
    task.needs_build ? 'build' : 'no-build',
    task.needs_runtime_debug ? 'debug' : 'no-debug',
    task.needs_dependency_install ? 'deps' : 'no-deps'
  ];
  return parts.join('|');
}

function inferTaskType(task={}) {
  const g = String(task.goal ?? '').toLowerCase();
  if (/(ui|ux|화면|디자인)/.test(g)) return 'ui';
  if (/(버그|오류|debug)/.test(g)) return 'debug';
  if (/(문서|보고서|pdf|계약서)/.test(g)) return 'document';
  if (/(법률|소송|고소|판례)/.test(g)) return 'legal';
  return 'general';
}

export function qualityTier(task={}) {
  if (task.risk === 'D' || task.risk === 'C' || task.authority_required || task.external_effect && task.external_effect !== 'none') return 'CRITICAL';
  if (task.needs_build || task.needs_runtime_debug || task.needs_dependency_install || Number(task.changed_files_estimate ?? 0) >= 5 || ['development','document','legal'].includes(task.domain)) return 'STANDARD';
  return 'FAST';
}

export function baselineRoute(task={}) {
  if (HUMAN_GATE_SCOPES.has(task.target_scope) || task.risk === 'D' || task.authority_required || task.external_effect && task.external_effect !== 'none') return 'HUMAN_GATE';
  if (task.cloud_reproducible === false) return 'LOCAL_REQUIRED';
  if (task.needs_build || task.needs_runtime_debug || task.needs_dependency_install || Number(task.changed_files_estimate ?? 0) >= 10) return 'WORK_CODEX';
  return 'GPT_DIRECT';
}

export function verificationPlan(task={}) {
  const tier = qualityTier(task);
  const common = ['source_revision_bound','done_when_present','result_status_explicit'];
  if (tier === 'FAST') return {tier, checks:[...common,'targeted_check'], fail_closed:true};
  if (tier === 'STANDARD') return {tier, checks:[...common,'requirement_traceability','regression_check','work_result_receipt'], fail_closed:true};
  return {tier, checks:[...common,'requirement_traceability','regression_check','independent_review','rollback_plan','human_gate_if_external'], fail_closed:true};
}

export function validateOutcomeRecord(record={}) {
  const findings=[];
  if (!record.task_signature) findings.push('MISSING_TASK_SIGNATURE');
  if (!record.route) findings.push('MISSING_ROUTE');
  if (!record.subject_revision) findings.push('MISSING_SUBJECT_REVISION');
  if (!['VERIFIED','FAILED','PARTIAL'].includes(record.verification_status)) findings.push('BAD_VERIFICATION_STATUS');
  if (!Number.isFinite(record.elapsed_seconds) || record.elapsed_seconds < 0) findings.push('BAD_ELAPSED_SECONDS');
  if (!Number.isInteger(record.rework_count) || record.rework_count < 0) findings.push('BAD_REWORK_COUNT');
  if (!Number.isInteger(record.context_items_loaded) || record.context_items_loaded < 0) findings.push('BAD_CONTEXT_ITEMS');
  if (typeof record.first_pass_success !== 'boolean') findings.push('MISSING_FIRST_PASS_FLAG');
  if (typeof record.false_pass !== 'boolean') findings.push('MISSING_FALSE_PASS_FLAG');
  if (typeof record.regression !== 'boolean') findings.push('MISSING_REGRESSION_FLAG');
  return {valid:findings.length===0, findings};
}

export function summarizeRoute(records=[], route) {
  const valid = records.filter(r => r.route === route && validateOutcomeRecord(r).valid);
  const n = valid.length;
  if (!n) return {route,samples:0};
  const avg = key => valid.reduce((a,r)=>a+Number(r[key]??0),0)/n;
  const rate = fn => valid.filter(fn).length/n;
  return {
    route,
    samples:n,
    verified_rate:rate(r=>r.verification_status==='VERIFIED'),
    first_pass_rate:rate(r=>r.first_pass_success===true),
    false_pass_rate:rate(r=>r.false_pass===true),
    regression_rate:rate(r=>r.regression===true),
    avg_rework_count:avg('rework_count'),
    avg_elapsed_seconds:avg('elapsed_seconds'),
    avg_context_items_loaded:avg('context_items_loaded')
  };
}

export function learnRoutingPolicy(task={}, history=[], options={}) {
  const minSamples = Number(options.min_samples ?? 5);
  const signature = taskSignature(task);
  const comparable = history.filter(r => r.task_signature === signature && validateOutcomeRecord(r).valid);
  const currentRoute = options.current_route ?? baselineRoute(task);
  if (['HUMAN_GATE','LOCAL_REQUIRED'].includes(currentRoute)) return {status:'NO_AUTONOMOUS_ROUTE_CHANGE', current_route:currentRoute, reason:'protected_or_environment_bound'};
  const alternatives = ['GPT_DIRECT','WORK_CODEX'];
  const baseline = summarizeRoute(comparable,currentRoute);
  if (baseline.samples < minSamples) return {status:'INSUFFICIENT_EVIDENCE', current_route:currentRoute, baseline, min_samples:minSamples};
  const candidates=[];
  for (const route of alternatives) {
    if (route===currentRoute) continue;
    const s=summarizeRoute(comparable,route);
    if (s.samples < minSamples) continue;
    if (s.false_pass_rate > 0) continue;
    if (s.regression_rate > baseline.regression_rate) continue;
    if (s.verified_rate < baseline.verified_rate) continue;
    if (s.first_pass_rate + 0.02 < baseline.first_pass_rate) continue;
    const faster = s.avg_elapsed_seconds <= baseline.avg_elapsed_seconds * 0.85;
    const lessRework = s.avg_rework_count < baseline.avg_rework_count;
    const lessContext = s.avg_context_items_loaded <= baseline.avg_context_items_loaded * 0.8;
    const moreAccurate = s.verified_rate >= baseline.verified_rate + 0.05 || s.first_pass_rate >= baseline.first_pass_rate + 0.05;
    if (faster || lessRework || lessContext || moreAccurate) {
      candidates.push({route,summary:s,reason:{faster,less_rework:lessRework,less_context:lessContext,more_accurate:moreAccurate}});
    }
  }
  if (!candidates.length) return {status:'KEEP_CURRENT', current_route:currentRoute, baseline};
  candidates.sort((a,b)=>score(b.summary,baseline)-score(a.summary,baseline));
  return {
    status:'SHADOW_CANDIDATE',
    current_route:currentRoute,
    candidate_route:candidates[0].route,
    baseline,
    candidate:candidates[0],
    auto_adopt:false,
    authorization:'NOT_GRANTED',
    next_step:'RUN_SHADOW_PILOT'
  };
}

function score(s,b) {
  const quality = (s.verified_rate-b.verified_rate)*100 + (s.first_pass_rate-b.first_pass_rate)*40;
  const speed = b.avg_elapsed_seconds > 0 ? (b.avg_elapsed_seconds-s.avg_elapsed_seconds)/b.avg_elapsed_seconds*25 : 0;
  const rework = (b.avg_rework_count-s.avg_rework_count)*15;
  const context = b.avg_context_items_loaded > 0 ? (b.avg_context_items_loaded-s.avg_context_items_loaded)/b.avg_context_items_loaded*10 : 0;
  return quality+speed+rework+context;
}

export function precisionSpeedPlan(task={}, history=[]) {
  const route=baselineRoute(task);
  const learning=learnRoutingPolicy(task,history,{current_route:route});
  return {
    task_signature:taskSignature(task),
    quality:verificationPlan(task),
    execution_route:route,
    learning,
    hard_invariants:{false_pass_tolerance:0,stale_source_tolerance:0,approval_bypass_tolerance:0,unverified_success_tolerance:0},
    operating_principle:'FASTEST_PATH_THAT_PRESERVES_REQUIRED_EVIDENCE',
    uncertainty_policy:'FAIL_CLOSED_OR_ESCALATE',
    authorization:'NOT_GRANTED'
  };
}
