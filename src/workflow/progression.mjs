function indexOfState(spec, state) {
  return (spec.ordered_states ?? []).indexOf(state);
}

export function planWorkflowProgression(spec, { current_state, target_state, facts = {} } = {}) {
  if (!spec || typeof spec !== 'object') throw new Error('WORKFLOW_PROGRESSION_SPEC_REQUIRED');

  const from = indexOfState(spec, current_state);
  const to = indexOfState(spec, target_state);

  if (from < 0) {
    return { eligible: false, reasons: ['CURRENT_STATE_UNKNOWN'], current_state, target_state };
  }
  if (to < 0) {
    return { eligible: false, reasons: ['TARGET_STATE_UNKNOWN'], current_state, target_state };
  }
  if (to < from) {
    return { eligible: false, reasons: ['BACKWARD_PROGRESSION_FORBIDDEN'], current_state, target_state };
  }

  const skipped_states = spec.ordered_states.slice(from + 1, to);
  if (skipped_states.length && spec.allow_forward_skip !== true) {
    return {
      eligible: false,
      reasons: ['FORWARD_SKIP_FORBIDDEN'],
      current_state,
      target_state,
      skipped_states,
    };
  }

  const inference_requirements = [];
  for (const rule of spec.inference_rules ?? []) {
    const threshold = indexOfState(spec, rule.when_target_at_or_after);
    if (threshold < 0 || to < threshold || facts[rule.inferred_fact_id] === true) continue;
    inference_requirements.push({
      rule_id: rule.rule_id,
      fact_id: rule.inferred_fact_id,
      provenance_required: true,
      basis: {
        kind: 'TARGET_STATE_IMPLIES_PREREQUISITE',
        target_state,
        threshold_state: rule.when_target_at_or_after,
      },
      forbidden_completion_fact_ids: [...rule.forbidden_completion_fact_ids],
    });
  }

  return {
    eligible: true,
    reasons: [],
    kind: to === from ? 'SAME' : skipped_states.length ? 'FORWARD_SKIP' : 'NEXT',
    current_state,
    target_state,
    skipped_states,
    skipped_state_evidence_policy: spec.skipped_state_evidence_policy,
    inference_requirements,
  };
}
