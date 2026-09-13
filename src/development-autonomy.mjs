export function isCapsuleStale(capsule, currentRevision) {
  if (!capsule?.source_revision || !currentRevision) return true;
  return capsule.source_revision !== currentRevision;
}

export function compileChangePacket({ taskId, projectId, sourceRevision, userIntent, desiredOutcome, acceptanceCriteria = [], nonGoals = [], affectedSurfaces = [], reuseCandidates = [], unresolvedQuestions = [], verificationObligations = [], previewObligations = [], rollbackCondition = null }) {
  if (!taskId || !projectId || !sourceRevision || !userIntent || !desiredOutcome) {
    throw new Error('missing required change context');
  }
  if (!Array.isArray(acceptanceCriteria) || acceptanceCriteria.length === 0) {
    throw new Error('acceptance criteria required');
  }
  if (!Array.isArray(verificationObligations) || verificationObligations.length === 0) {
    throw new Error('verification obligations required');
  }

  return {
    task_id: taskId,
    project_id: projectId,
    source_revision: sourceRevision,
    user_intent: userIntent,
    desired_outcome: desiredOutcome,
    acceptance_criteria: acceptanceCriteria,
    non_goals: nonGoals,
    affected_surfaces: affectedSurfaces,
    reuse_candidates: reuseCandidates,
    unresolved_questions: unresolvedQuestions,
    verification_obligations: verificationObligations,
    preview_obligations: previewObligations,
    rollback_condition: rollbackCondition,
    authorization: {
      execution_authorized: false,
      external_actions: []
    }
  };
}

export function selectVerificationLayers(change) {
  const layers = new Set(['static', 'regression']);
  const text = JSON.stringify(change || {}).toLowerCase();

  if (/ui|screen|page|component|layout|mobile|responsive/.test(text)) {
    layers.add('visual');
    layers.add('responsive');
    layers.add('runtime-smoke');
  }
  if (/api|endpoint|contract|schema/.test(text)) {
    layers.add('contract');
    layers.add('integration');
  }
  if (/state|status|transition|workflow/.test(text)) {
    layers.add('state-transition');
    layers.add('integration');
  }
  if (/permission|auth|role|security/.test(text)) {
    layers.add('permission-boundary');
  }
  if (/build|package|dependency/.test(text)) {
    layers.add('build');
  }

  return [...layers];
}

export function buildProofBundle({ taskId, subjectRevision, requirementResults = [], checks = [], changedFiles = [], previewRefs = [], unknowns = [], rollback = null, deploymentState = 'NOT_DEPLOYED', outcomeState = 'NOT_MEASURED' }) {
  if (!taskId || !subjectRevision) throw new Error('taskId and subjectRevision required');
  return {
    task_id: taskId,
    subject_revision: subjectRevision,
    requirements: requirementResults,
    checks,
    preview_refs: previewRefs,
    changed_files: changedFiles,
    unknowns,
    rollback,
    deployment_state: deploymentState,
    outcome_state: outcomeState
  };
}

export function evaluateProofBundle(bundle) {
  if (!bundle?.subject_revision) return { status: 'HOLD', reason: 'MISSING_REVISION' };
  const checks = bundle.checks || [];
  if (checks.length === 0) return { status: 'HOLD', reason: 'NO_CHECKS' };
  if (checks.some((c) => !c.executed)) return { status: 'HOLD', reason: 'UNEXECUTED_CHECK' };
  if (checks.some((c) => c.status === 'FAIL')) return { status: 'FAILED', reason: 'CHECK_FAILED' };
  if (checks.some((c) => c.status === 'SKIP' || c.status === 'UNKNOWN')) return { status: 'PARTIAL', reason: 'INCOMPLETE_CHECKS' };

  const requirements = bundle.requirements || [];
  if (requirements.length === 0) return { status: 'HOLD', reason: 'NO_REQUIREMENTS' };
  if (requirements.some((r) => r.status === 'FAIL')) return { status: 'FAILED', reason: 'REQUIREMENT_FAILED' };
  if (requirements.some((r) => r.status !== 'PASS')) return { status: 'PARTIAL', reason: 'REQUIREMENT_INCOMPLETE' };
  if ((bundle.unknowns || []).length > 0) return { status: 'PARTIAL', reason: 'REMAINING_UNKNOWNS' };

  return { status: 'PASSED_WITHIN_SCOPE', reason: 'CURRENT_EVIDENCE_SATISFIES_DECLARED_SCOPE' };
}
