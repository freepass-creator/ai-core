const STATES=['DESIGN','LOCALLY_TESTED','INDEPENDENTLY_VERIFIED','SHADOW_VALIDATED','OUTCOME_VERIFIED'];

export function evaluateEvolution(candidate={}){
  const holds=[];
  const evidence=candidate.evidence??[];
  const outcomes=candidate.outcomes??[];
  const transfer=candidate.transfer??{};
  const scope=candidate.scope??'LOCAL';

  for(const key of ['candidate_id','origin','before_failure','mechanism','prediction']){
    if(!candidate[key]) holds.push(`MISSING_${key.toUpperCase()}`);
  }
  if(!(candidate.limits??[]).length) holds.push('LIMITS_UNDECLARED');

  const locallyTested=evidence.some(x=>x.kind==='synthetic_test'&&x.executed===true&&x.revision);
  const independent=evidence.some(x=>x.kind==='independent_verification'&&x.executed===true&&x.revision&&x.actor!==candidate.origin_actor);
  const shadow=evidence.some(x=>x.kind==='shadow_pilot'&&x.executed===true&&x.revision);
  const outcomeVerified=outcomes.some(x=>x.observed===true&&x.measurement_window_complete===true&&x.source_revision);

  let state='DESIGN';
  if(locallyTested) state='LOCALLY_TESTED';
  if(independent) state='INDEPENDENTLY_VERIFIED';
  if(shadow&&independent) state='SHADOW_VALIDATED';
  if(outcomeVerified&&shadow&&independent) state='OUTCOME_VERIFIED';

  if(scope==='UNIVERSAL'){
    if(!(transfer.positive_conditions??[]).length) holds.push('TRANSFER_POSITIVE_CONDITIONS_MISSING');
    if(!(transfer.negative_conditions??[]).length) holds.push('TRANSFER_NEGATIVE_CONDITIONS_MISSING');
    if((transfer.outside_origin_successes??0)<1) holds.push('NO_OUTSIDE_ORIGIN_SUCCESS');
    if(state!=='OUTCOME_VERIFIED') holds.push('UNIVERSAL_REQUIRES_OUTCOME_VERIFIED');
  }
  if(scope==='DOMAIN'&&state==='DESIGN') holds.push('DOMAIN_REQUIRES_EXECUTED_EVIDENCE');

  const destination=learningDestination(candidate);
  const adoption=holds.length?'HOLD':scope==='LOCAL'?'ADOPTABLE_LOCAL':scope==='DOMAIN'?'ADOPTABLE_DOMAIN':'ADOPTABLE_UNIVERSAL';
  return {candidate_id:candidate.candidate_id??null,state,scope,adoption,destination,holds,cost:candidate.cost??{},authorization:'NOT_GRANTED'};
}

export function learningDestination(candidate={}){
  const type=candidate.learning_type??'';
  if(['business_meaning','operational_failure','authority_boundary'].includes(type)) return 'AIOPS_CANDIDATE';
  if(['development_standard','reusable_component','verifier','fixer'].includes(type)) return 'DEVCENTER_CANDIDATE';
  if(['routing','context_selection','handoff','evidence_logic','adoption_logic'].includes(type)) return 'AI_CORE_CANDIDATE';
  return 'PROJECT_LOCAL_CANDIDATE';
}

export function compareCost(before={},after={}){
  const keys=['rework_count','blocked_false_positive_count','context_items_loaded','repeated_context_count','work_execution_count','elapsed_seconds'];
  return Object.fromEntries(keys.map(k=>[k,{before:before[k]??null,after:after[k]??null,delta:Number.isFinite(before[k])&&Number.isFinite(after[k])?after[k]-before[k]:null}]));
}
