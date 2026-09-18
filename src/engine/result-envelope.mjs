export const WORK_RESULT_SCHEMA = 'ai-core-work-result/v1';

const nowIso = clock => new Date(clock()).toISOString();

export function createWorkResult({
  plan,
  status,
  summary = '',
  adapterResult = null,
  performed = false,
  startedAt = null,
  endedAt = null,
  blockers = [],
  nextAction = null,
  clock = Date.now,
}) {
  const result = adapterResult ?? {};
  const allBlockers = [...new Set([...(blockers ?? []), ...(result.blockers ?? [])])];
  return {
    schema: WORK_RESULT_SCHEMA,
    order_id: plan?.order_id ?? null,
    work_id: plan?.work_id ?? null,
    project_id: plan?.project_id ?? null,
    capability_id: plan?.capability_id ?? null,
    subject_revision: plan?.subject_revision ?? null,
    mode: plan?.mode ?? null,
    status,
    summary: summary || result.summary || '',
    artifact_refs: [...(result.artifacts ?? [])],
    evidence_refs: [...(result.evidence ?? [])],
    checks: [...(result.checks ?? [])],
    execution: {
      performed,
      external_effect: result.external_effect === true,
      started_at: startedAt ?? null,
      ended_at: endedAt ?? (performed ? nowIso(clock) : null),
      authorization_source: plan?.authorization_source ?? null,
    },
    outcome: {
      observed: status === 'SUCCEEDED',
      data: result.data ?? null,
    },
    blockers: allBlockers,
    next_action: nextAction ?? result.next_action ?? null,
    walls: [...(plan?.walls ?? [])],
  };
}
