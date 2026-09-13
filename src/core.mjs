import { resolveSourceRequirements, bindResolvedSources } from './source-resolver.mjs';
import { compileContext } from './context-compiler.mjs';
import { resolveCapabilities } from './capability-resolver.mjs';
import {
  compileEvolutionPlan,
  derivePreflightSignals,
  reviewLensesFor
} from './evolution-kernel.mjs';
import { compileConversationLearning } from './conversation-learning.mjs';
import { compileProofContract } from './domain-quality.mjs';
import { compileHumanOrchestration } from './human-orchestrator.mjs';
import {
  effectiveDomains,
  effectiveRisk,
  inferApplicableDomains
} from './domain-policy.mjs';

export { inferApplicableDomains } from './domain-policy.mjs';

export const CORE_VERSION = '0.5.0-candidate.0';

const APPROVAL_ORDER = [
  'CLAUDE_DESIGN',
  'OWNER_SYSTEM_APPROVAL',
  'RESPONSIBLE_HUMAN_FINAL_REVIEW',
  'CLAUDE_FINAL',
  'USER_JUST_IN_TIME'
];

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function rejectUnknownFields(value, allowed, label) {
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length) throw new Error(`${label} has unsupported fields: ${unknown.sort().join(', ')}`);
}

function normalizedString(value, label, { optional = false } = {}) {
  if (value == null && optional) return null;
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized && !optional) throw new Error(`${label} must not be empty`);
  return normalized || null;
}

function normalizedPointerInput(pointer, label) {
  assertRecord(pointer, label);
  rejectUnknownFields(pointer, ['location', 'revision_or_sha', 'observed_at'], label);
  const location = normalizedString(pointer.location, `${label}.location`);
  const revision = pointer.revision_or_sha == null
    ? null
    : normalizedString(pointer.revision_or_sha, `${label}.revision_or_sha`);
  const observedAt = pointer.observed_at == null
    ? null
    : normalizedString(pointer.observed_at, `${label}.observed_at`);
  if (!revision && !observedAt) {
    throw new Error(`${label} requires revision_or_sha or observed_at`);
  }
  if (observedAt && Number.isNaN(Date.parse(observedAt))) {
    throw new Error(`${label}.observed_at must be a valid date-time`);
  }
  return {
    location,
    ...(revision ? { revision_or_sha: revision } : {}),
    ...(observedAt ? { observed_at: observedAt } : {})
  };
}

function normalizedOptionalBoolean(value, label) {
  if (value == null) return null;
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
  return value;
}

function normalizedOptionalNumber(value, label, minimum, maximum = Number.POSITIVE_INFINITY) {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a number from ${minimum} to ${maximum}`);
  }
  return value;
}

function normalizeDoneWhen(doneWhen) {
  if (doneWhen == null) return [];
  if (!Array.isArray(doneWhen)) throw new Error('done_when must be an array');
  return doneWhen.map((entry, index) => {
    if (typeof entry === 'string') {
      if (!entry.trim()) throw new Error(`done_when[${index}] must not be empty`);
      return entry.trim();
    }
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      rejectUnknownFields(entry, ['id', 'text', 'mode', 'required'], `done_when[${index}]`);
      const text = normalizedString(entry.text, `done_when[${index}].text`);
      const id = entry.id == null
        ? `REQ-${String(index + 1).padStart(3, '0')}`
        : normalizedString(entry.id, `done_when[${index}].id`);
      const mode = entry.mode == null
        ? 'automated'
        : normalizedString(entry.mode, `done_when[${index}].mode`);
      if (!['automated', 'manual', 'external'].includes(mode)) {
        throw new Error(`done_when[${index}].mode is unsupported`);
      }
      const required = normalizedOptionalBoolean(
        entry.required,
        `done_when[${index}].required`
      );
      return {
        id,
        text,
        mode,
        required: required !== false
      };
    }
    throw new Error(`done_when[${index}] must be a string or requirement object`);
  });
}

function normalizeIntentHypotheses(input) {
  return normalizeArrayField(input, 'intent_hypotheses').map((hypothesis, index) => {
    const label = `intent_hypotheses[${index}]`;
    assertRecord(hypothesis, label);
    rejectUnknownFields(hypothesis, [
      'id', 'field', 'statement', 'confirmation_prompt', 'confidence',
      'changes_decision', 'confirmed', 'confirmation'
    ], label);
    const confirmation = hypothesis.confirmation == null
      ? null
      : (() => {
          assertRecord(hypothesis.confirmation, `${label}.confirmation`);
          rejectUnknownFields(
            hypothesis.confirmation,
            ['authority', 'source_ref'],
            `${label}.confirmation`
          );
          return {
            authority: normalizedString(
              hypothesis.confirmation.authority,
              `${label}.confirmation.authority`
            ),
            source_ref: normalizedPointerInput(
              hypothesis.confirmation.source_ref,
              `${label}.confirmation.source_ref`
            )
          };
        })();
    return {
      ...(hypothesis.id != null
        ? { id: normalizedString(hypothesis.id, `${label}.id`) }
        : {}),
      ...(hypothesis.field != null
        ? { field: normalizedString(hypothesis.field, `${label}.field`) }
        : {}),
      statement: normalizedString(hypothesis.statement, `${label}.statement`),
      ...(hypothesis.confirmation_prompt != null
        ? {
            confirmation_prompt: normalizedString(
              hypothesis.confirmation_prompt,
              `${label}.confirmation_prompt`
            )
          }
        : {}),
      ...(hypothesis.confidence != null
        ? {
            confidence: normalizedOptionalNumber(
              hypothesis.confidence,
              `${label}.confidence`,
              0,
              1
            )
          }
        : {}),
      ...(hypothesis.changes_decision != null
        ? {
            changes_decision: normalizedOptionalBoolean(
              hypothesis.changes_decision,
              `${label}.changes_decision`
            )
          }
        : {}),
      ...(hypothesis.confirmed != null
        ? {
            confirmed: normalizedOptionalBoolean(
              hypothesis.confirmed,
              `${label}.confirmed`
            )
          }
        : {}),
      ...(confirmation ? { confirmation } : {})
    };
  });
}

function normalizeDecisionQuestions(input) {
  return normalizeArrayField(input, 'decision_questions').map((question, index) => {
    const label = `decision_questions[${index}]`;
    assertRecord(question, label);
    rejectUnknownFields(question, [
      'id', 'prompt', 'decision_impact', 'irreversibility', 'uncertainty',
      'user_effort', 'already_known', 'externally_resolvable', 'changes_decision',
      'user_judgment_required', 'resolution_ref'
    ], label);
    const output = {
      ...(question.id != null ? { id: normalizedString(question.id, `${label}.id`) } : {}),
      prompt: normalizedString(question.prompt, `${label}.prompt`)
    };
    for (const field of ['decision_impact', 'irreversibility', 'uncertainty']) {
      if (question[field] != null) {
        output[field] = normalizedOptionalNumber(question[field], `${label}.${field}`, 0, 5);
      }
    }
    if (question.user_effort != null) {
      output.user_effort = normalizedOptionalNumber(
        question.user_effort,
        `${label}.user_effort`,
        1
      );
    }
    for (const field of [
      'already_known', 'externally_resolvable', 'changes_decision', 'user_judgment_required'
    ]) {
      if (question[field] != null) {
        output[field] = normalizedOptionalBoolean(question[field], `${label}.${field}`);
      }
    }
    if (question.resolution_ref != null) {
      output.resolution_ref = normalizedPointerInput(
        question.resolution_ref,
        `${label}.resolution_ref`
      );
    }
    return output;
  });
}

function normalizeProposedActions(input) {
  return normalizeArrayField(input, 'proposed_actions').map((action, index) => {
    const label = `proposed_actions[${index}]`;
    assertRecord(action, label);
    rejectUnknownFields(
      action,
      ['id', 'description', 'effect', 'reversible', 'approval_required', 'depends_on'],
      label
    );
    if (!Array.isArray(action.depends_on ?? [])) {
      throw new Error(`${label}.depends_on must be an array`);
    }
    const dependsOn = (action.depends_on ?? []).map((value, dependencyIndex) => (
      normalizedString(value, `${label}.depends_on[${dependencyIndex}]`)
    ));
    return {
      ...(action.id != null ? { id: normalizedString(action.id, `${label}.id`) } : {}),
      description: normalizedString(action.description, `${label}.description`),
      effect: normalizedString(action.effect, `${label}.effect`),
      reversible: normalizedOptionalBoolean(action.reversible, `${label}.reversible`),
      ...(action.approval_required != null
        ? {
            approval_required: normalizedOptionalBoolean(
              action.approval_required,
              `${label}.approval_required`
            )
          }
        : {}),
      ...(dependsOn.length ? { depends_on: dependsOn } : {})
    };
  });
}

function normalizeArrayField(input, field) {
  if (input[field] == null) return [];
  if (!Array.isArray(input[field])) throw new Error(`${field} must be an array`);
  return input[field];
}

function normalizeBooleanField(input, field, fallback) {
  if (input[field] == null) return fallback;
  if (typeof input[field] !== 'boolean') throw new Error(`${field} must be a boolean`);
  return input[field];
}

function sortApprovals(approvals) {
  return [...new Set(approvals)].sort((left, right) => {
    const leftIndex = APPROVAL_ORDER.indexOf(left);
    const rightIndex = APPROVAL_ORDER.indexOf(right);
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex)
      - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
}

function environmentArray(environment, field, issues) {
  if (environment[field] == null) return [];
  if (Array.isArray(environment[field])) return environment[field];
  issues.push(`${field} must be an array`);
  return [];
}

function environmentBoolean(environment, field, issues, fallback = false) {
  if (environment[field] == null) return fallback;
  if (typeof environment[field] === 'boolean') return environment[field];
  issues.push(`${field} must be a boolean`);
  return fallback;
}

function environmentRevision(environment, field, issues) {
  if (environment[field] == null) return null;
  if (typeof environment[field] !== 'string' || !environment[field].trim()) {
    issues.push(`${field} must be a non-empty string`);
    return null;
  }
  return environment[field].trim();
}

export function normalizeTask(input = {}) {
  if (!input.goal || typeof input.goal !== 'string' || !input.goal.trim()) {
    throw new Error('goal is required');
  }

  const inferredDomains = inferApplicableDomains(input.goal);
  const domain = input.domain ?? inferredDomains[0];
  const applicableDomains = effectiveDomains({
    goal: input.goal,
    domain,
    applicable_domains: input.applicable_domains
  });
  const requestedRisk = input.risk ?? (applicableDomains.includes('legal') ? 'C' : 'A');
  const risk = effectiveRisk({ ...input, domain, applicable_domains: applicableDomains });

  const changedFilesEstimate = Number(input.changed_files_estimate ?? 0);
  if (!Number.isInteger(changedFilesEstimate) || changedFilesEstimate < 0) {
    throw new Error('changed_files_estimate must be a non-negative integer');
  }

  if (input.task_id != null) normalizedString(input.task_id, 'task_id');
  if (input.project != null) normalizedString(input.project, 'project');
  if (input.project_ref != null) normalizedString(input.project_ref, 'project_ref');
  if (input.desired_outcome != null) normalizedString(
    input.desired_outcome,
    'desired_outcome',
    { optional: true }
  );
  if (input.external_effect != null) normalizedString(input.external_effect, 'external_effect');
  const constraints = normalizeArrayField(input, 'constraints').map((value, index) => (
    normalizedString(value, `constraints[${index}]`)
  ));

  return {
    task_id: input.task_id?.trim() ?? `CORE-${Date.now()}`,
    goal: input.goal.trim(),
    desired_outcome: input.desired_outcome == null
      ? null
      : String(input.desired_outcome).trim() || null,
    project: input.project?.trim() ?? null,
    project_ref: input.project_ref?.trim() ?? 'main',
    domain,
    applicable_domains: applicableDomains,
    domain_assessment: input.domain == null ? 'HEURISTIC' : 'DECLARED_ADDITIVE_HINT',
    risk,
    risk_adjustment: risk !== requestedRisk ? 'LEGAL_MINIMUM_C' : null,
    authority_required: normalizeBooleanField(input, 'authority_required', false),
    done_when: normalizeDoneWhen(input.done_when),
    constraints,
    changed_files_estimate: changedFilesEstimate,
    needs_build: normalizeBooleanField(input, 'needs_build', false),
    needs_dependency_install: normalizeBooleanField(input, 'needs_dependency_install', false),
    needs_runtime_debug: normalizeBooleanField(input, 'needs_runtime_debug', false),
    cloud_reproducible: normalizeBooleanField(input, 'cloud_reproducible', true),
    external_effect: input.external_effect == null
      ? 'unknown'
      : String(input.external_effect).trim() || 'unknown',
    external_effect_assessment: input.external_effect == null
      ? 'MISSING_ASSUMED_CONSEQUENTIAL'
      : 'DECLARED',
    intent_hypotheses: normalizeIntentHypotheses(input),
    decision_questions: normalizeDecisionQuestions(input),
    proposed_actions: normalizeProposedActions(input)
  };
}

export function inferDomain(goal) {
  return inferApplicableDomains(goal)[0];
}

export function capabilityPlan(task) {
  const domains = effectiveDomains(task);
  if (!domains.some(domain => ['development', 'document'].includes(domain))) return [];

  const scopes = ['dev.repo.lifecycle'];
  const goal = task.goal.toLowerCase();
  if (['ui', 'ux', '화면', '상품'].some(hint => goal.includes(hint))) {
    scopes.push('dev.design.token', 'dev.design.atom');
  }
  if (['상품', '카드'].some(hint => goal.includes(hint))) {
    scopes.push('dev.design.atom.product_card');
  }
  if (domains.includes('document')) scopes.push('dev.doc.form');
  return [...new Set(scopes)];
}

export function executionRoute(task) {
  const domains = effectiveDomains(task);
  const risk = effectiveRisk(task, domains);
  const hasExternalEffect = task.external_effect !== 'none';
  const requiredApprovals = [];
  const approvalReasons = [];
  const addApprovals = (...approvals) => {
    for (const approval of approvals) {
      if (!requiredApprovals.includes(approval)) requiredApprovals.push(approval);
    }
  };
  if (risk === 'D' || hasExternalEffect) {
    addApprovals('CLAUDE_DESIGN', 'CLAUDE_FINAL', 'USER_JUST_IN_TIME');
    approvalReasons.push('live, unknown, or external effect');
  }
  if (risk === 'C') {
    addApprovals('CLAUDE_DESIGN');
    approvalReasons.push('new workflow or protected structure');
  }
  if (domains.includes('legal')) {
    addApprovals('RESPONSIBLE_HUMAN_FINAL_REVIEW');
    approvalReasons.push('legal work requires responsible human review');
  }
  if (task.authority_required) {
    addApprovals('OWNER_SYSTEM_APPROVAL');
    approvalReasons.push('owner-system authority');
  }
  if (requiredApprovals.length) {
    return {
      route: 'HUMAN_GATE',
      reason: `${approvalReasons.join('; ')} requires approval`,
      required_approvals: sortApprovals(requiredApprovals)
    };
  }
  if (!task.cloud_reproducible) {
    return {
      route: 'LOCAL_REQUIRED',
      reason: 'not reproducible in cloud',
      required_approvals: []
    };
  }
  if (
    task.changed_files_estimate >= 10
    || task.needs_build
    || task.needs_dependency_install
    || task.needs_runtime_debug
  ) {
    return {
      route: 'WORK_CODEX',
      reason: 'repository execution/build/test/debug loop required',
      required_approvals: []
    };
  }
  return {
    route: 'GPT_DIRECT',
    reason: 'bounded GitHub-native work',
    required_approvals: []
  };
}

function contextPointersFromBindings(sourceBindings) {
  return sourceBindings.map(binding => {
    if (binding.status === 'BOUND') {
      return { ...binding.pointer, required: binding.required };
    }
    return {
      system: binding.system,
      kind: binding.kind,
      status: 'unresolved',
      location: binding.location ?? `${binding.system}:${binding.kind}`,
      reason: binding.reason ?? binding.status,
      required: binding.required
    };
  });
}

export function orchestrate(input, environment = {}) {
  const evaluationTime = new Date().toISOString();
  const task = normalizeTask(input);
  const environmentInputIssues = [];
  const proofInputIssues = [];
  const resolvedSourcesInput = environmentArray(
    environment, 'resolved_sources', environmentInputIssues
  );
  const capabilityRefsInput = environmentArray(
    environment, 'capability_refs', environmentInputIssues
  );
  const failuresInput = environmentArray(environment, 'failures', environmentInputIssues);
  const decisionsInput = environmentArray(environment, 'decisions', environmentInputIssues);
  const conversationObservationsInput = environmentArray(
    environment, 'conversation_observations', environmentInputIssues
  );
  const observationsInput = environmentArray(
    environment, 'observations', environmentInputIssues
  );
  const proofReceiptsInput = environmentArray(environment, 'proof_receipts', proofInputIssues);
  const proofEvaluationFlag = environmentBoolean(
    environment, 'proof_evaluation_requested', proofInputIssues, false
  );
  const liveContextAttempted = environmentBoolean(
    environment, 'live_context_attempted', environmentInputIssues, false
  );
  const liveContextHold = environmentBoolean(
    environment, 'live_context_hold', environmentInputIssues, false
  );
  const subjectRevision = environmentRevision(
    environment, 'subject_revision', environmentInputIssues
  );
  const requirements = resolveSourceRequirements(task);
  const sourceBindings = bindResolvedSources(
    requirements,
    resolvedSourcesInput
  );
  const requestedScopes = capabilityPlan(task);
  const capabilityBindings = environment.devcenter_registry
    ? resolveCapabilities(requestedScopes, environment.devcenter_registry)
    : requestedScopes.map(scope => ({ scope, status: 'RESOLVE_REQUIRED' }));
  const compiledContext = compileContext({
    task,
    sourcePointers: contextPointersFromBindings(sourceBindings),
    capabilityRefs: capabilityRefsInput,
    failures: failuresInput,
    decisions: decisionsInput
  });
  const baseExecution = executionRoute(task);
  const humanOrchestration = compileHumanOrchestration(task, {
    memoryClaims: environment.memory_claims ?? [],
    revokedMemoryIds: environment.revoked_memory_ids ?? [],
    verifiedIntentConfirmations: environment.verified_intent_confirmations ?? [],
    verifiedQuestionResolutions: environment.verified_question_resolutions ?? [],
    currentTime: evaluationTime,
    maximumQuestions: 1
  });
  const context = {
    ...compiledContext,
    human_memory_context: humanOrchestration.memory?.applicable ?? [],
    human_memory_usage: 'CONTEXT_ONLY_NOT_INSTRUCTION'
  };
  const actionApprovalRequired = humanOrchestration.status === 'APPROVAL_REQUIRED'
    || Boolean(humanOrchestration.actions?.approval_required?.length);
  const actionAwareExecution = actionApprovalRequired
    ? executionRoute({ ...task, external_effect: 'proposed_consequential_action' })
    : baseExecution;
  const combinedActionApprovals = sortApprovals([
    ...(baseExecution.required_approvals ?? []),
    ...(actionAwareExecution.required_approvals ?? [])
  ]);
  const actionApprovalContracts = actionApprovalRequired
    ? humanOrchestration.actions.approval_required.map(action => ({
        action_id: action.id,
        action_digest: action.action_digest,
        effect: action.effect,
        subject_revision: subjectRevision,
        required_approvals: combinedActionApprovals
      }))
    : [];
  const execution = actionApprovalRequired
    ? {
        route: 'HUMAN_GATE',
        reason: 'one or more proposed consequential actions require explicit approval',
        required_approvals: combinedActionApprovals,
        approval_action_ids: humanOrchestration.actions.approval_required.map(item => item.id),
        approval_contracts: actionApprovalContracts,
        prior_route: baseExecution.route
      }
    : baseExecution;
  const holds = [];
  if (environmentInputIssues.length) holds.push('ENVIRONMENT_INPUT_REJECTED');
  if (proofInputIssues.length) holds.push('PROOF_INPUT_REJECTED');
  if (liveContextHold) holds.push('LIVE_CONTEXT_HOLD');

  if (!task.project && effectiveDomains(task).includes('development')) {
    holds.push('PROJECT_UNRESOLVED');
  }
  if (task.project && !subjectRevision) {
    holds.push('SUBJECT_REVISION_UNRESOLVED');
  }
  if (!task.done_when.length) holds.push('DONE_WHEN_UNSPECIFIED');
  if (sourceBindings.some(binding => binding.required && binding.status !== 'BOUND')) {
    holds.push('SOURCE_HOLD');
  }
  if (capabilityBindings.some(binding => binding.status === 'HOLD')) {
    holds.push('CAPABILITY_CONFLICT');
  }
  if (capabilityBindings.some(binding => (
    ['RESOLVE_REQUIRED', 'SELECTED', 'CANDIDATE_ONLY', 'MISSING'].includes(binding.status)
  ))) {
    holds.push('CAPABILITY_UNRESOLVED');
  }
  if (context.status === 'HOLD') holds.push('CONTEXT_HOLD');
  if (humanOrchestration.status === 'HOLD_INVALID_INPUT') {
    holds.push('HUMAN_CONTEXT_INPUT_REJECTED');
  }
  if (
    humanOrchestration.status === 'DECISION_REQUIRED'
    || humanOrchestration.intent?.unresolved_hypothesis_ids?.length
    || humanOrchestration.questions_to_ask?.length
    || humanOrchestration.deferred_questions?.length
  ) {
    holds.push('INTENT_CONFIRMATION_REQUIRED');
  }
  if (humanOrchestration.research_now?.length) {
    holds.push('HUMAN_CONTEXT_RESEARCH_REQUIRED');
  }

  const learning = compileConversationLearning(conversationObservationsInput, {
    currentTime: evaluationTime
  });
  if (learning.status === 'HOLD_CONFLICT') holds.push('LEARNING_CONFLICT');
  if (learning.status === 'HOLD_INVALID_INPUT') holds.push('LEARNING_INPUT_REJECTED');

  const pinnedSources = sourceBindings
    .filter(binding => binding.status === 'BOUND')
    .map(binding => binding.pointer);
  const resolvedCapabilities = capabilityBindings
    .filter(binding => binding.status === 'RESOLVED')
    .map(binding => binding.asset);
  const proofEvaluationRequested = proofEvaluationFlag
    || Object.hasOwn(environment, 'proof_receipts');
  const assurance = compileProofContract(task, {
    subjectRevision,
    sourceRevisionSet: pinnedSources,
    capabilityRevisionSet: resolvedCapabilities,
    receipts: proofReceiptsInput,
    evaluationRequested: proofEvaluationRequested,
    currentTime: evaluationTime
  });
  if (assurance.requirement_set.status !== 'DEFINED') {
    holds.push('REQUIREMENT_SET_INVALID');
  }
  if (proofEvaluationRequested && assurance.gate.status === 'FAIL') {
    holds.push('PROOF_GATE_FAILED');
  } else if (proofEvaluationRequested && assurance.gate.status !== 'PASS') {
    holds.push('PROOF_GATE_HOLD');
  }

  const preliminaryHolds = [...new Set(holds)];
  const proactiveReviewLenses = reviewLensesFor(task);
  const preflightSignals = liveContextAttempted
    ? derivePreflightSignals({
        task,
        sourceBindings,
        capabilityBindings,
        holds: preliminaryHolds
      })
    : [];
  const evolution = compileEvolutionPlan({
    task,
    observations: [
      ...preflightSignals,
      ...learning.signals,
      ...observationsInput
    ],
    subjectRevision,
    sourcePointers: pinnedSources,
    capabilityRefs: resolvedCapabilities,
    policyRevision: assurance.policy_revision
  });
  if (evolution.rejected.length) holds.push('EVOLUTION_INPUT_REJECTED');

  const uniqueHolds = [...new Set(holds)];
  const status = uniqueHolds.length
    ? 'HOLD'
    : execution.route === 'HUMAN_GATE'
      || humanOrchestration.status === 'APPROVAL_REQUIRED'
      ? 'APPROVAL_REQUIRED'
      : 'READY';
  const preparationBlockers = uniqueHolds.filter(hold => ![
    'INTENT_CONFIRMATION_REQUIRED',
    'EVOLUTION_INPUT_REJECTED'
  ].includes(hold));
  const preparationActionIds = humanOrchestration.actions?.prepare_now?.map(item => item.id) ?? [];
  const preparationAllowed = preparationActionIds.length > 0 && preparationBlockers.length === 0;
  const preparationGate = {
    status: preparationAllowed ? 'ALLOWED' : 'BLOCKED',
    allowed_action_ids: preparationAllowed ? preparationActionIds : [],
    blockers: preparationBlockers,
    note: 'This final gate supersedes the component-local human_orchestration phase gate.'
  };

  return {
    core_version: CORE_VERSION,
    input_issues: {
      environment: environmentInputIssues,
      proof: proofInputIssues
    },
    task,
    source_requirements: requirements,
    source_bindings: sourceBindings,
    requested_capability_scopes: requestedScopes,
    capability_bindings: capabilityBindings,
    context,
    execution,
    human_orchestration: humanOrchestration,
    learning,
    assurance,
    evolution,
    status,
    holds: uniqueHolds,
    work_packet: {
      task_id: task.task_id,
      project: task.project,
      subject_revision: subjectRevision,
      goal: task.goal,
      allowed_scope: task.constraints,
      done_when: task.done_when,
      source_bindings: pinnedSources,
      capabilities: resolvedCapabilities,
      execution_route: execution.route,
      approval_requirements: execution.required_approvals,
      human_agency_contract: humanOrchestration,
      preparation_gate: preparationGate,
      execution_gate: {
        status,
        authorized: false,
        blockers: uniqueHolds,
        required_approvals: execution.required_approvals,
        approval_action_ids: execution.approval_action_ids ?? [],
        approval_contracts: execution.approval_contracts ?? []
      },
      proactive_review_lenses: proactiveReviewLenses,
      proof_contract: {
        policy_revision: assurance.policy_revision,
        evaluation_time: assurance.evaluation_time,
        domain: assurance.domain,
        applicable_domains: assurance.applicable_domains,
        requirement_set: assurance.requirement_set,
        source_revision_set: assurance.source_revision_set,
        capability_revision_set: assurance.capability_revision_set,
        obligations: assurance.obligations,
        gate: assurance.gate
      },
      learning_contract: {
        lifecycle: learning.lifecycle,
        candidate_rules: learning.candidates.map(candidate => ({
          rule_key: candidate.rule_key,
          fingerprint: candidate.fingerprint,
          domains: candidate.domains,
          maturity: candidate.maturity,
          governance_status: candidate.governance_status,
          source_refs: candidate.source_refs
        })),
        conflicts: learning.conflicts,
        resolved_conflicts: learning.resolved_conflicts,
        raw_conversation_stored: false,
        semantic_sanitization_verified: false,
        auto_adopted: false
      },
      feedback_contract: {
        destination: 'AI_CORE_EVOLUTION_KERNEL',
        accepts: [
          'failures',
          'friction',
          'unexpected_results',
          'metrics',
          'review_findings',
          'sanitized_conversation_observations'
        ]
      },
      evidence_required: [
        'subject_revision',
        'source_revision_set',
        'capability_revision_set',
        'requirement_set_digest',
        'checks_executed',
        'failures_and_skips',
        'proof_receipts',
        'review_status',
        'authorization_evidence',
        'execution_evidence',
        'outcome_evidence'
      ]
    },
    execution_authorized: false
  };
}
