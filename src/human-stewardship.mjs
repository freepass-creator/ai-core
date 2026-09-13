const HIGH_IMPACT = new Set(['legal','finance','health','permissions','production','payment','external_commitment']);

export function supportVector(input={}) {
  return {
    goal_alignment: input.goal_alignment ?? 'UNKNOWN',
    decision_quality: input.decision_quality ?? 'UNKNOWN',
    execution_reliability: input.execution_reliability ?? 'UNKNOWN',
    resource_efficiency: input.resource_efficiency ?? 'UNKNOWN',
    reversibility: input.reversibility ?? 'UNKNOWN',
    human_agency_preserved: input.human_agency_preserved ?? 'UNKNOWN',
    cognitive_load_reduced: input.cognitive_load_reduced ?? 'UNKNOWN',
    learning_transfer: input.learning_transfer ?? 'UNKNOWN',
    follow_through_completeness: input.follow_through_completeness ?? 'UNKNOWN'
  };
}

export function stewardshipGate({request={}, portfolio={}, context={}}={}) {
  const findings=[];
  const goal=request.goal ?? null;
  const desired=request.desired_outcome ?? null;
  if (!goal) findings.push('GOAL_UNCLEAR');
  if (!desired) findings.push('OUTCOME_UNCLEAR');
  if (request.conflicts_with_commitment) findings.push('COMMITMENT_CONFLICT');
  if (request.irreversible && !request.rollback_plan) findings.push('NO_ROLLBACK_FOR_IRREVERSIBLE_STEP');
  if (request.high_uncertainty && !request.reversible_next_step) findings.push('UNCERTAINTY_WITHOUT_REVERSIBLE_STEP');
  if (request.requires_user_value_judgment && request.assumed_value_choice) findings.push('USER_VALUE_ASSUMED');
  if (request.domain && HIGH_IMPACT.has(request.domain) && !request.evidence_plan) findings.push('HIGH_IMPACT_WITHOUT_EVIDENCE_PLAN');

  const active=(portfolio.active_commitments ?? []).length;
  const capacity=Number.isFinite(portfolio.capacity_limit) ? portfolio.capacity_limit : null;
  if (capacity !== null && active >= capacity && !request.replaces_existing_commitment) findings.push('PORTFOLIO_CAPACITY_CONFLICT');

  const hard = findings.some(x => [
    'COMMITMENT_CONFLICT','NO_ROLLBACK_FOR_IRREVERSIBLE_STEP','USER_VALUE_ASSUMED','HIGH_IMPACT_WITHOUT_EVIDENCE_PLAN'
  ].includes(x));

  const status = hard ? 'REFRAME_OR_ESCALATE' : findings.length ? 'PROCEED_WITH_GAPS' : 'READY';
  return {
    status,
    findings,
    should_execute_now: status === 'READY',
    preserve_agency: true,
    authorization: 'NOT_GRANTED',
    context_reuse_hint: context.source_revisions?.length ? 'REUSE_BOUND_SOURCES' : 'RESOLVE_MINIMUM_SOURCES'
  };
}

export function foresightPlan(task={}) {
  const important = Boolean(task.irreversible || task.high_uncertainty || task.external_dependency || HIGH_IMPACT.has(task.domain));
  if (!important) return {depth:'LIGHT', checks:['expected_case']};
  return {
    depth:'DEEP',
    checks:['best_case','expected_case','failure_case','irreversible_step','rollback_path','second_order_effect','external_dependency'],
    forecasts_are_facts:false
  };
}

export function nextBestAction({unknowns=[], actions=[]}={}) {
  const scored = actions.map(a => {
    const impact=Number(a.decision_impact ?? 0);
    const reversibility=a.reversible === false ? 2 : 1;
    const info=Number(a.information_gain ?? 0);
    const cost=Math.max(1, Number(a.user_effort ?? 1) + Number(a.execution_cost ?? 0));
    return {...a, value:(impact * reversibility + info) / cost};
  }).sort((a,b)=>b.value-a.value);
  if (!scored.length) return {action:null,reason:'NO_ACTIONS'};
  return {action:scored[0],reason:'HIGHEST_DECISION_VALUE_PER_COST',unresolved_unknowns:unknowns};
}

export function followThroughPlan(task={}) {
  const terminal = task.outcome_observed === true;
  if (terminal) return {status:'COMPLETE',next_observation:null,follow_up_trigger:null};
  return {
    status:'FOLLOW_UP_REQUIRED',
    next_observation:task.next_observation ?? 'Observe whether desired outcome occurred',
    follow_up_trigger:task.follow_up_trigger ?? 'after_execution_or_at_deadline'
  };
}

export function stewardshipPlan(input={}) {
  return {
    architecture_version:'human-stewardship/0.1-candidate',
    gate:stewardshipGate(input),
    foresight:foresightPlan(input.request ?? {}),
    next_action:nextBestAction({unknowns:input.unknowns ?? [], actions:input.actions ?? []}),
    follow_through:followThroughPlan(input.request ?? {}),
    support_quality:supportVector(input.support_quality ?? {}),
    operating_principle:'IMPROVE_HUMAN_OUTCOMES_WITH_MINIMUM_NECESSARY_BURDEN_WHILE_PRESERVING_AGENCY'
  };
}
