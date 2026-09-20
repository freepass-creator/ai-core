function same(a, b) {
  return Object.is(a, b);
}

function conditionMatches(condition, context) {
  if (condition.kind === 'STATE_EQUALS') {
    return context?.states?.[condition.axis_id] === condition.value;
  }
  if (condition.kind === 'FACT_EQUALS') {
    return same(context?.facts?.[condition.fact_id], condition.value);
  }
  return false;
}

export function deriveWorkflowProjection(spec, context = {}) {
  if (!spec || typeof spec !== 'object') throw new Error('WORKFLOW_PROJECTION_SPEC_REQUIRED');
  const rules = [...(spec.rules ?? [])].sort((a, b) => a.priority - b.priority);

  for (const rule of rules) {
    if (rule.all.every(condition => conditionMatches(condition, context))) {
      return {
        projection_id: spec.projection_id,
        projection_ref: spec.output.projection_ref,
        value: rule.result,
        matched_rule_id: rule.rule_id,
      };
    }
  }

  return {
    projection_id: spec.projection_id,
    projection_ref: spec.output.projection_ref,
    value: spec.default_result,
    matched_rule_id: null,
  };
}
