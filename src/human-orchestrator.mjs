import { createHash } from 'node:crypto';
import { effectiveDomains, effectiveRisk } from './domain-policy.mjs';
import { assessActionSemantics } from './action-semantics.mjs';

const MEMORY_SCOPES = new Set(['UNIVERSAL', 'DOMAIN', 'LOCAL']);
const MEMORY_STATES = new Set(['ACTIVE', 'REVOKED', 'SUPERSEDED']);
const MEMORY_AUTHORITIES = new Set(['user_directive', 'approved_source', 'transfer_gate']);
const MEMORY_KINDS = new Set([
  'context', 'principle', 'constraint', 'preference', 'temporary_decision'
]);
const TIME_BOUND_MEMORY_KINDS = new Set(['preference', 'temporary_decision']);
const VAGUE_GOAL_HINTS = [
  '개선', '고도화', '최적화', '알아서', '완벽', '좋게',
  'improve', 'optimize', 'better', 'best'
];
const MINIMUM_QUESTION_SCORE = 1;
const FORBIDDEN_RAW_FIELDS = new Set([
  'raw_content',
  'transcript',
  'message_body',
  'full_text',
  'sensitive_payload'
]);
const HUMAN_CONTEXT_ENVIRONMENT_FIELDS = new Set([
  'memory_claims',
  'revoked_memory_ids',
  'verified_intent_confirmations',
  'verified_question_resolutions'
]);

export function normalizeHumanContextEnvironment(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('human_context must be an object');
  }
  const unsupported = Object.keys(input).filter(key => (
    !HUMAN_CONTEXT_ENVIRONMENT_FIELDS.has(key)
  ));
  if (unsupported.length) {
    throw new Error(`unsupported human_context fields: ${unsupported.sort().join(', ')}`);
  }
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value != null));
}

function hasForbiddenRawField(value, seen = new WeakSet(), depth = 0) {
  if (!value || typeof value !== 'object') return false;
  if (depth > 20 || seen.has(value)) return true;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_RAW_FIELDS.has(key)) return true;
    if (hasForbiddenRawField(child, seen, depth + 1)) return true;
  }
  return false;
}

function stableDigest(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function requiredString(value, label, maximum = Number.POSITIVE_INFINITY) {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maximum) throw new Error(`${label} is too long`);
  return normalized;
}

function dateTimeEpoch(value) {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) return Number.NaN;
  return Date.parse(value);
}

function evidenceIdentity(taskId, id, contentDigest, contextDigest, pointer) {
  return JSON.stringify([
    String(taskId),
    String(id),
    String(contentDigest),
    String(contextDigest),
    pointer.location,
    pointer.revision_or_sha ?? null,
    pointer.observed_at ?? null
  ]);
}

function decisionTaskContext(task = {}) {
  const hasDomainContext = Boolean(
    task.domain
    || (Array.isArray(task.applicable_domains) && task.applicable_domains.length)
    || (typeof task.goal === 'string' && task.goal.trim())
  );
  const domains = hasDomainContext ? effectiveDomains(task) : [];
  const doneWhen = Array.isArray(task.done_when)
    ? task.done_when.map((entry, index) => (
        typeof entry === 'string'
          ? { id: `REQ-${String(index + 1).padStart(3, '0')}`, text: entry.trim(), mode: 'automated', required: true }
          : {
              id: String(entry?.id ?? `REQ-${String(index + 1).padStart(3, '0')}`),
              text: String(entry?.text ?? '').trim(),
              mode: String(entry?.mode ?? 'automated'),
              required: entry?.required !== false
            }
      ))
    : [];
  return {
    task_id: String(task.task_id ?? '').trim() || null,
    project: task.project == null ? null : String(task.project).trim() || null,
    project_ref: String(task.project_ref ?? 'main').trim(),
    goal: String(task.goal ?? '').trim(),
    desired_outcome: task.desired_outcome == null
      ? null
      : String(task.desired_outcome).trim() || null,
    outcome_observation: task.outcome_observation == null
      ? null
      : {
          event_or_metric: String(task.outcome_observation.event_or_metric ?? '').trim(),
          evidence_required: String(task.outcome_observation.evidence_required ?? '').trim()
        },
    constraints: Array.isArray(task.constraints) ? task.constraints.map(String) : [],
    allowed_scope: Array.isArray(task.allowed_scope) ? task.allowed_scope.map(String) : [],
    forbidden_scope: Array.isArray(task.forbidden_scope) ? task.forbidden_scope.map(String) : [],
    related_commitment_ids: Array.isArray(task.related_commitment_ids)
      ? task.related_commitment_ids.map(String)
      : [],
    resource_claims: Array.isArray(task.resource_claims) ? task.resource_claims.map(String) : [],
    portfolio_effect: task.portfolio_effect ?? 'unknown',
    recovery_strategy: task.recovery_strategy ?? null,
    domain: task.domain ?? domains[0] ?? null,
    applicable_domains: [...domains].sort(),
    risk: domains.length ? effectiveRisk(task, domains) : null,
    authority_required: task.authority_required === true,
    external_effect: task.external_effect ?? 'unknown',
    done_when: doneWhen
  };
}

export function intentContextDigestFor(task, hypothesis) {
  return stableDigest(JSON.stringify({
    task: decisionTaskContext(task),
    hypothesis: {
      id: String(hypothesis?.id ?? '').trim(),
      field: String(hypothesis?.field ?? 'desired_outcome'),
      statement: String(hypothesis?.statement ?? '').trim()
    }
  }));
}

export function questionContextDigestFor(task, question) {
  return stableDigest(JSON.stringify({
    task: decisionTaskContext(task),
    question: {
      id: String(question?.id ?? '').trim(),
      prompt: String(question?.prompt ?? '').trim()
    }
  }));
}

function clamp(value, minimum, maximum, fallback = minimum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, numeric));
}

function normalizePointer(pointer, label) {
  if (!pointer || typeof pointer !== 'object' || Array.isArray(pointer)) {
    throw new Error(`${label} must be an object`);
  }
  if (typeof pointer.location !== 'string') {
    throw new Error(`${label}.location must be a string`);
  }
  if (pointer.revision_or_sha != null && typeof pointer.revision_or_sha !== 'string') {
    throw new Error(`${label}.revision_or_sha must be a string`);
  }
  if (pointer.observed_at != null && typeof pointer.observed_at !== 'string') {
    throw new Error(`${label}.observed_at must be a string`);
  }
  const location = pointer.location.trim();
  const revision = pointer.revision_or_sha?.trim() ?? '';
  const observedAt = pointer.observed_at?.trim() ?? '';
  if (!location || (!revision && !observedAt)) {
    throw new Error(`${label} requires location and revision_or_sha or observed_at`);
  }
  if (observedAt && Number.isNaN(dateTimeEpoch(observedAt))) {
    throw new Error(`${label} observed_at must be a valid timestamp`);
  }
  return {
    location,
    ...(revision ? { revision_or_sha: revision } : {}),
    ...(observedAt ? { observed_at: observedAt } : {})
  };
}

function normalizeConfirmation(confirmation, index) {
  if (confirmation == null) return null;
  if (confirmation.authority !== 'user_directive') {
    throw new Error(`intent_hypotheses[${index}] confirmation must be a user_directive`);
  }
  return {
    authority: 'user_directive',
    source_ref: normalizePointer(
      confirmation.source_ref,
      `intent_hypotheses[${index}].confirmation.source_ref`
    )
  };
}

function normalizeVerifiedIntentConfirmations(receipts = [], currentTime = new Date().toISOString()) {
  if (!Array.isArray(receipts)) {
    throw new Error('verified_intent_confirmations must be an array');
  }
  const now = dateTimeEpoch(currentTime);
  if (!Number.isFinite(now)) throw new Error('current_time must be a valid timestamp');
  return new Set(receipts.map((receipt, index) => {
    if (!receipt || typeof receipt !== 'object') {
      throw new Error(`verified_intent_confirmations[${index}] must be an object`);
    }
    const hypothesisId = requiredString(
      receipt.hypothesis_id,
      `verified_intent_confirmations[${index}].hypothesis_id`
    );
    const statementDigest = requiredString(
      receipt.statement_digest,
      `verified_intent_confirmations[${index}].statement_digest`
    );
    const taskId = requiredString(
      receipt.task_id,
      `verified_intent_confirmations[${index}].task_id`
    );
    const intentContextDigest = requiredString(
      receipt.intent_context_digest,
      `verified_intent_confirmations[${index}].intent_context_digest`
    );
    if (
      !/^sha256:[a-f0-9]{64}$/.test(statementDigest)
      || !/^sha256:[a-f0-9]{64}$/.test(intentContextDigest)
    ) {
      throw new Error(`verified_intent_confirmations[${index}] is incomplete`);
    }
    const sourceRef = normalizePointer(
      receipt.source_ref,
      `verified_intent_confirmations[${index}].source_ref`
    );
    if (sourceRef.observed_at && dateTimeEpoch(sourceRef.observed_at) > now) {
      throw new Error('verified intent confirmation timestamp cannot be in the future');
    }
    return evidenceIdentity(
      taskId,
      hypothesisId,
      statementDigest,
      intentContextDigest,
      sourceRef
    );
  }));
}

function normalizeVerifiedQuestionResolutions(receipts = [], currentTime = new Date().toISOString()) {
  if (!Array.isArray(receipts)) {
    throw new Error('verified_question_resolutions must be an array');
  }
  const now = dateTimeEpoch(currentTime);
  if (!Number.isFinite(now)) throw new Error('current_time must be a valid timestamp');
  const normalized = new Map();
  for (const [index, receipt] of receipts.entries()) {
    if (!receipt || typeof receipt !== 'object') {
      throw new Error(`verified_question_resolutions[${index}] must be an object`);
    }
    const questionId = requiredString(
      receipt.question_id,
      `verified_question_resolutions[${index}].question_id`
    );
    const promptDigest = requiredString(
      receipt.prompt_digest,
      `verified_question_resolutions[${index}].prompt_digest`
    );
    const taskId = requiredString(
      receipt.task_id,
      `verified_question_resolutions[${index}].task_id`
    );
    const questionContextDigest = requiredString(
      receipt.question_context_digest,
      `verified_question_resolutions[${index}].question_context_digest`
    );
    if (
      !/^sha256:[a-f0-9]{64}$/.test(promptDigest)
      || !/^sha256:[a-f0-9]{64}$/.test(questionContextDigest)
    ) {
      throw new Error(`verified_question_resolutions[${index}] is incomplete`);
    }
    const resolutionSummary = requiredString(
      receipt.resolution_summary,
      `verified_question_resolutions[${index}].resolution_summary`,
      2000
    );
    if (receipt.sanitized !== true) {
      throw new Error(`verified_question_resolutions[${index}] requires a sanitized resolution_summary`);
    }
    const sourceRef = normalizePointer(
      receipt.source_ref,
      `verified_question_resolutions[${index}].source_ref`
    );
    if (sourceRef.observed_at && dateTimeEpoch(sourceRef.observed_at) > now) {
      throw new Error('verified question resolution timestamp cannot be in the future');
    }
    const key = evidenceIdentity(
      taskId,
      questionId,
      promptDigest,
      questionContextDigest,
      sourceRef
    );
    const value = {
      resolution_summary: resolutionSummary,
      resolution_digest: stableDigest(resolutionSummary),
      source_ref: sourceRef,
      sanitized: true
    };
    const existing = normalized.get(key);
    if (existing && existing.resolution_digest !== value.resolution_digest) {
      throw new Error('verified question resolutions conflict for the same evidence identity');
    }
    if (!existing) normalized.set(key, value);
  }
  return normalized;
}

function normalizeIntentHypothesis(hypothesis, index, verifiedConfirmations, task) {
  if (!hypothesis || typeof hypothesis !== 'object') {
    throw new Error(`intent_hypotheses[${index}] must be an object`);
  }
  const statement = String(hypothesis.statement ?? '').trim();
  if (!statement) throw new Error(`intent_hypotheses[${index}].statement is required`);
  const id = String(
    hypothesis.id ?? `INTENT-HYPOTHESIS-${String(index + 1).padStart(3, '0')}`
  ).trim();
  if (!id) throw new Error(`intent_hypotheses[${index}].id must not be empty`);
  const confirmation = normalizeConfirmation(hypothesis.confirmation, index);
  if (hypothesis.confirmed === true && !confirmation) {
    throw new Error(`intent_hypotheses[${index}] cannot be confirmed without user evidence`);
  }
  if (hypothesis.confirmed === false && confirmation) {
    throw new Error(`intent_hypotheses[${index}] confirmation contradicts confirmed=false`);
  }
  const statementDigest = stableDigest(statement);
  const intentContextDigest = intentContextDigestFor(task, {
    id,
    field: hypothesis.field,
    statement
  });
  const confirmationVerified = Boolean(confirmation && verifiedConfirmations.has(
    evidenceIdentity(
      task.task_id,
      id,
      statementDigest,
      intentContextDigest,
      confirmation.source_ref
    )
  ));
  return {
    id,
    field: String(hypothesis.field ?? 'desired_outcome'),
    statement,
    statement_digest: statementDigest,
    intent_context_digest: intentContextDigest,
    confirmation_prompt: String(
      hypothesis.confirmation_prompt ?? `다음 의도 가설이 맞습니까? ${statement}`
    ).trim(),
    confidence: clamp(hypothesis.confidence, 0, 1, 0.5),
    changes_decision: hypothesis.changes_decision !== false,
    status: confirmationVerified ? 'CONFIRMED' : 'PROVISIONAL',
    ...(confirmation ? {
      confirmation: {
        ...confirmation,
        verification: confirmationVerified ? 'VERIFIED' : 'UNVERIFIED'
      }
    } : {})
  };
}

function inferredHypothesesFor(task) {
  const goal = String(task.goal ?? '').toLowerCase();
  const completionCriteriaPresent = Array.isArray(task.done_when)
    && task.done_when.some(entry => (
      typeof entry === 'string'
        ? Boolean(entry.trim())
        : Boolean(String(entry?.text ?? '').trim())
    ));
  if (
    task.desired_outcome
    || completionCriteriaPresent
    || !VAGUE_GOAL_HINTS.some(hint => goal.includes(hint))
  ) return [];
  return [{
    id: 'INTENT-AUTO-DESIRED-OUTCOME',
    field: 'desired_outcome',
    statement: '이 작업의 최우선 성공 기준이 아직 특정되지 않았다.',
    confirmation_prompt: '가장 우선할 결과는 무엇입니까? 예: 속도, 정확성, 사용성, 비용',
    confidence: 0,
    changes_decision: true
  }];
}

export function buildIntentEnvelope(task = {}, {
  verifiedIntentConfirmations = [],
  currentTime = new Date().toISOString()
} = {}) {
  if (task.intent_hypotheses != null && !Array.isArray(task.intent_hypotheses)) {
    throw new Error('intent_hypotheses must be an array');
  }
  const verifiedConfirmations = normalizeVerifiedIntentConfirmations(
    verifiedIntentConfirmations,
    currentTime
  );
  const explicitHypotheses = task.intent_hypotheses ?? [];
  const coversDesiredOutcome = explicitHypotheses.some(hypothesis => (
    String(hypothesis?.field ?? 'desired_outcome') === 'desired_outcome'
    && hypothesis?.changes_decision !== false
  ));
  const inferredHypotheses = coversDesiredOutcome ? [] : inferredHypothesesFor(task);
  const inputHypotheses = [...explicitHypotheses, ...inferredHypotheses];
  const hypotheses = inputHypotheses.map((hypothesis, index) => (
    normalizeIntentHypothesis(hypothesis, index, verifiedConfirmations, task)
  ));
  const ids = new Set();
  for (const hypothesis of hypotheses) {
    if (ids.has(hypothesis.id)) throw new Error('intent hypothesis IDs must be unique');
    ids.add(hypothesis.id);
  }
  const unresolved = hypotheses.filter(item => (
    item.status === 'PROVISIONAL' && item.changes_decision
  ));
  return {
    stated: {
      goal: task.goal,
      desired_outcome: task.desired_outcome ?? null,
      constraints: Array.isArray(task.constraints) ? task.constraints : [],
      allowed_scope: Array.isArray(task.allowed_scope) ? task.allowed_scope : [],
      forbidden_scope: Array.isArray(task.forbidden_scope) ? task.forbidden_scope : []
    },
    hypotheses,
    unresolved_hypothesis_ids: unresolved.map(item => item.id),
    inferred_intent_confirmed_automatically: false,
    ambiguity_detection: inferredHypotheses.length
      ? 'BOUNDED_HEURISTIC'
      : 'UPSTREAM_OR_EXPLICIT'
  };
}

export function scoreQuestion(question = {}) {
  const impact = clamp(question.decision_impact, 0, 5, 0);
  const irreversibility = clamp(question.irreversibility, 0, 5, 0);
  const uncertainty = clamp(question.uncertainty, 0, 5, 0);
  const userEffort = Math.max(1, Number(question.user_effort ?? 1));
  return (impact * Math.max(1, irreversibility) * uncertainty) / userEffort;
}

export function questionGate(question = {}) {
  const score = scoreQuestion(question);
  if (question.user_judgment_required === true) {
    return { ask: true, reason: 'USER_JUDGMENT_REQUIRED', score };
  }
  if (question.already_known === true && question.resolution_verified === true) {
    return { ask: false, reason: 'ALREADY_KNOWN', score };
  }
  if (question.already_known === true) {
    return { ask: false, reason: 'RESOLVE_WITH_SOURCE_FIRST', score };
  }
  if (question.externally_resolvable === true && question.user_judgment_required !== true) {
    return {
      ask: false,
      reason: question.resolution_verified === true
        ? 'RESOLVED_FROM_SOURCE'
        : 'RESOLVE_WITH_SOURCE_FIRST',
      score
    };
  }
  if (question.changes_decision === false && question.user_judgment_required !== true) {
    return {
      ask: false,
      reason: score < MINIMUM_QUESTION_SCORE
        ? 'BELOW_QUESTION_THRESHOLD'
        : 'LOW_DECISION_VALUE',
      score
    };
  }
  return {
    ask: true,
    reason: 'DECISION_CHANGING_UNKNOWN',
    score
  };
}

function normalizeQuestion(question, index, verifiedResolutions = new Map(), task = {}) {
  if (!question || typeof question !== 'object') {
    throw new Error(`decision_questions[${index}] must be an object`);
  }
  const prompt = String(question.prompt ?? '').trim();
  if (!prompt) throw new Error(`decision_questions[${index}].prompt is required`);
  if (question.already_known === true && !question.resolution_ref) {
    throw new Error(`decision_questions[${index}].resolution_ref is required when already_known`);
  }
  const id = String(question.id ?? `QUESTION-${String(index + 1).padStart(3, '0')}`).trim();
  if (!id) throw new Error(`decision_questions[${index}].id must not be empty`);
  const promptDigest = stableDigest(prompt);
  const questionContextDigest = questionContextDigestFor(task, { id, prompt });
  const resolutionRef = question.resolution_ref
    ? normalizePointer(
        question.resolution_ref,
        `decision_questions[${index}].resolution_ref`
      )
    : null;
  const verifiedResolution = resolutionRef
    ? verifiedResolutions.get(evidenceIdentity(
        task.task_id,
        id,
        promptDigest,
        questionContextDigest,
        resolutionRef
      ))
    : null;
  const resolutionVerified = Boolean(verifiedResolution);
  return {
    id,
    prompt,
    prompt_digest: promptDigest,
    question_context_digest: questionContextDigest,
    decision_impact: clamp(question.decision_impact, 0, 5, 0),
    irreversibility: clamp(question.irreversibility, 0, 5, 0),
    uncertainty: clamp(question.uncertainty, 0, 5, 0),
    user_effort: clamp(question.user_effort, 1, 100, 1),
    already_known: question.already_known === true,
    externally_resolvable: question.externally_resolvable === true,
    changes_decision: question.changes_decision !== false,
    user_judgment_required: question.user_judgment_required === true,
    source: String(question.source ?? 'TASK_INPUT'),
    ...(resolutionRef ? {
      resolution_ref: resolutionRef,
      resolution_verification: resolutionVerified ? 'VERIFIED' : 'UNVERIFIED',
      resolution_verified: resolutionVerified,
      ...(verifiedResolution ? {
        resolution_summary: verifiedResolution.resolution_summary,
        resolution_digest: verifiedResolution.resolution_digest,
        sanitized: true
      } : {})
    } : {})
  };
}

function evaluateQuestions(questions = [], verifiedResolutions = new Map(), task = {}) {
  if (!Array.isArray(questions)) throw new Error('decision_questions must be an array');
  const normalized = questions.map((question, index) => (
    normalizeQuestion(question, index, verifiedResolutions, task)
  ));
  const ids = new Set();
  for (const question of normalized) {
    if (ids.has(question.id)) throw new Error('decision question IDs must be unique');
    ids.add(question.id);
  }
  return normalized.map(question => ({ ...question, ...questionGate(question) }));
}

function normalizeQuestionLimit(maximum) {
  const limit = Number(maximum);
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error('maximumQuestions must be a non-negative integer');
  }
  return limit;
}

export function prioritizeQuestions(questions = [], maximum = 1) {
  const limit = normalizeQuestionLimit(maximum);
  return evaluateQuestions(questions)
    .filter(question => question.ask)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function questionForHypothesis(hypothesis) {
  return {
    id: `CONFIRM-${hypothesis.id}`,
    prompt: hypothesis.confirmation_prompt,
    decision_impact: 5,
    irreversibility: 3,
    uncertainty: Math.max(1, Math.round((1 - hypothesis.confidence) * 5)),
    user_effort: 1,
    changes_decision: true,
    user_judgment_required: true,
    source: 'INTENT_HYPOTHESIS'
  };
}

function normalizeMemoryClaim(claim, index) {
  if (!claim || typeof claim !== 'object') {
    throw new Error(`memory_claims[${index}] must be an object`);
  }
  if (hasForbiddenRawField(claim)) {
    throw new Error(`memory_claims[${index}] contains forbidden raw or sensitive fields`);
  }
  const memoryId = String(claim.memory_id ?? '').trim();
  const ruleKey = String(claim.rule_key ?? '').trim();
  const summary = String(claim.summary ?? '').trim();
  if (!memoryId || !ruleKey || !summary) {
    throw new Error(`memory_claims[${index}] requires memory_id, rule_key and summary`);
  }
  if (summary.length > 2000) throw new Error(`memory_claims[${index}].summary is too long`);
  if (claim.sanitized !== true) {
    throw new Error(`memory_claims[${index}] must be explicitly sanitized`);
  }
  if (!claim.source_ref) {
    throw new Error(`memory_claims[${index}].source_ref is required`);
  }
  const scope = String(claim.scope ?? '').trim();
  const state = String(claim.state ?? '').trim();
  const authority = String(claim.authority ?? '');
  const kind = String(claim.kind ?? 'context').trim();
  if (!MEMORY_SCOPES.has(scope)) throw new Error(`memory_claims[${index}].scope is unsupported`);
  if (!MEMORY_STATES.has(state)) throw new Error(`memory_claims[${index}].state is unsupported`);
  if (!MEMORY_AUTHORITIES.has(authority)) {
    throw new Error(`memory_claims[${index}].authority is unsupported`);
  }
  if (!MEMORY_KINDS.has(kind)) {
    throw new Error(`memory_claims[${index}].kind is unsupported`);
  }
  const domain = claim.domain == null ? null : String(claim.domain).trim();
  const project = claim.project == null ? null : String(claim.project).trim();
  if (scope === 'DOMAIN' && !domain) {
    throw new Error(`memory_claims[${index}].domain is required for DOMAIN scope`);
  }
  if (scope === 'LOCAL' && !project) {
    throw new Error(`memory_claims[${index}].project is required for LOCAL scope`);
  }
  if (scope === 'UNIVERSAL' && authority !== 'transfer_gate') {
    throw new Error(`memory_claims[${index}] UNIVERSAL scope requires transfer_gate authority`);
  }
  const expiresAt = claim.expires_at == null ? null : String(claim.expires_at);
  if (expiresAt && Number.isNaN(dateTimeEpoch(expiresAt))) {
    throw new Error(`memory_claims[${index}].expires_at must be a valid timestamp`);
  }
  if (TIME_BOUND_MEMORY_KINDS.has(kind) && !expiresAt) {
    throw new Error('time-bound memory requires expires_at');
  }
  return {
    memory_id: memoryId,
    rule_key: ruleKey,
    summary,
    scope,
    state,
    domain,
    project,
    kind,
    authority,
    expires_at: expiresAt,
    source_ref: normalizePointer(claim.source_ref, `memory_claims[${index}].source_ref`),
    sanitized: true
  };
}

function memoryExclusionReason(claim, context) {
  if (context.revokedMemoryIds.has(claim.memory_id)) return 'REVOKED_BY_CURRENT_INSTRUCTION';
  if (claim.state === 'REVOKED') return 'REVOKED';
  if (claim.state === 'SUPERSEDED') return 'SUPERSEDED';
  if (claim.expires_at && dateTimeEpoch(claim.expires_at) <= context.now) return 'EXPIRED';
  if (claim.scope === 'DOMAIN' && !context.domains.has(claim.domain)) return 'DOMAIN_MISMATCH';
  if (claim.scope === 'LOCAL' && claim.project !== context.project) return 'PROJECT_MISMATCH';
  return null;
}

export function selectApplicableMemory(claims = [], {
  domain = null,
  domains = null,
  project = null,
  revokedMemoryIds = [],
  now = new Date().toISOString()
} = {}) {
  if (!Array.isArray(claims)) throw new Error('memory_claims must be an array');
  if (!Array.isArray(revokedMemoryIds)) throw new Error('revoked_memory_ids must be an array');
  const applicableDomains = domains == null ? (domain ? [domain] : []) : domains;
  if (!Array.isArray(applicableDomains)) throw new Error('domains must be an array');
  const normalizedRevokedIds = revokedMemoryIds.map((value, index) => {
    const id = String(value).trim();
    if (!id) throw new Error(`revoked_memory_ids[${index}] must not be empty`);
    return id;
  });
  const currentTime = dateTimeEpoch(now);
  if (!Number.isFinite(currentTime)) throw new Error('current_time must be a valid timestamp');
  const context = {
    domains: new Set(applicableDomains.map(value => String(value))),
    project,
    revokedMemoryIds: new Set(normalizedRevokedIds),
    now: currentTime
  };
  const applicable = [];
  const excluded = [];
  const ids = new Set();
  const activeRuleKeys = new Set();
  for (const [index, rawClaim] of claims.entries()) {
    const claim = normalizeMemoryClaim(rawClaim, index);
    if (ids.has(claim.memory_id)) throw new Error('memory IDs must be unique');
    ids.add(claim.memory_id);
    const reason = memoryExclusionReason(claim, context);
    if (reason) {
      excluded.push({
        memory_id: claim.memory_id,
        rule_key: claim.rule_key,
        scope: claim.scope,
        state: claim.state,
        application_status: 'EXCLUDED',
        reason
      });
      continue;
    }
    if (
      claim.source_ref.observed_at
      && dateTimeEpoch(claim.source_ref.observed_at) > currentTime
    ) {
      throw new Error('memory source timestamp cannot be in the future');
    }
    if (activeRuleKeys.has(claim.rule_key)) {
      throw new Error('multiple active memories for one rule_key require explicit supersession');
    }
    activeRuleKeys.add(claim.rule_key);
    applicable.push({
      ...claim,
      application_status: 'APPLICABLE_CONTEXT',
      usage: 'CONTEXT_ONLY_NOT_INSTRUCTION',
      current_user_confirmation_implied: false
    });
  }
  return {
    applicable,
    excluded,
    revocation_set_digest: stableDigest(JSON.stringify([...context.revokedMemoryIds].sort())),
    revoked_memory_applied: false,
    raw_memory_stored: false
  };
}

function normalizeAction(action, index) {
  if (!action || typeof action !== 'object') {
    throw new Error(`proposed_actions[${index}] must be an object`);
  }
  const description = String(action.description ?? '').trim();
  if (!description) throw new Error(`proposed_actions[${index}].description is required`);
  const id = String(action.id ?? `ACTION-${String(index + 1).padStart(3, '0')}`).trim();
  if (!id) throw new Error(`proposed_actions[${index}].id must not be empty`);
  if (action.effect == null || !String(action.effect).trim()) {
    throw new Error(`proposed_actions[${index}].effect is required`);
  }
  if (typeof action.reversible !== 'boolean') {
    throw new Error(`proposed_actions[${index}].reversible must be a boolean`);
  }
  if (action.approval_required != null && typeof action.approval_required !== 'boolean') {
    throw new Error(`proposed_actions[${index}].approval_required must be a boolean`);
  }
  if (action.depends_on != null && !Array.isArray(action.depends_on)) {
    throw new Error(`proposed_actions[${index}].depends_on must be an array`);
  }
  const normalized = {
    id,
    description,
    target: action.target == null ? null : String(action.target).trim() || null,
    operation: action.operation == null ? null : String(action.operation).trim() || null,
    effect: String(action.effect).trim(),
    reversible: action.reversible,
    approval_required: action.approval_required === true,
    depends_on: Array.isArray(action.depends_on)
      ? [...new Set(action.depends_on.map(value => String(value).trim()).filter(Boolean))].sort()
      : []
  };
  return {
    ...normalized,
    action_digest: stableDigest(JSON.stringify(normalized))
  };
}

export function partitionActions(actions = [], {
  taskProject = null,
  taskScope = null
} = {}) {
  if (!Array.isArray(actions)) throw new Error('proposed_actions must be an array');
  const normalized = actions.map(normalizeAction);
  const actionsById = new Map();
  for (const action of normalized) {
    if (actionsById.has(action.id)) throw new Error('proposed action IDs must be unique');
    actionsById.set(action.id, action);
  }
  for (const action of normalized) {
    for (const dependency of action.depends_on) {
      if (!actionsById.has(dependency)) {
        throw new Error('proposed action dependency is unresolved');
      }
      if (dependency === action.id) {
        throw new Error('proposed action cannot depend on itself');
      }
    }
  }

  const dependents = new Map(normalized.map(action => [action.id, []]));
  const dependencyCounts = new Map(normalized.map(action => [action.id, action.depends_on.length]));
  for (const action of normalized) {
    for (const dependency of action.depends_on) dependents.get(dependency).push(action.id);
  }
  const queue = normalized.filter(action => action.depends_on.length === 0).map(action => action.id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift();
    visited += 1;
    for (const dependent of dependents.get(id)) {
      const nextCount = dependencyCounts.get(dependent) - 1;
      dependencyCounts.set(dependent, nextCount);
      if (nextCount === 0) queue.push(dependent);
    }
  }
  if (visited !== normalized.length) throw new Error('proposed action dependencies must be acyclic');

  const assessments = new Map(normalized.map(action => [
    action.id,
    assessActionSemantics(action, { taskProject, taskScope })
  ]));
  const gatedIds = new Set(normalized
    .filter(action => !assessments.get(action.id).safe_preparation_candidate)
    .map(action => action.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const action of normalized) {
      if (!gatedIds.has(action.id) && action.depends_on.some(id => gatedIds.has(id))) {
        gatedIds.add(action.id);
        changed = true;
      }
    }
  }

  const prepareNow = [];
  const approvalRequired = [];
  for (const action of normalized) {
    const assessment = assessments.get(action.id);
    const gatedDependency = action.depends_on.some(id => gatedIds.has(id));
    const safePreparation = !gatedIds.has(action.id);
    if (safePreparation) {
      prepareNow.push({ ...action, decision: 'PREPARE_NOW' });
    } else {
      approvalRequired.push({
        ...action,
        decision: 'AWAIT_APPROVAL',
        reason: assessment.issues.length
          ? 'ACTION_SEMANTICS_CONFLICT'
          : action.approval_required
          ? 'EXPLICIT_APPROVAL_REQUIRED'
          : !action.reversible
            ? 'IRREVERSIBLE_ACTION'
            : gatedDependency
              ? 'BLOCKED_BY_APPROVAL_DEPENDENCY'
              : action.effect === 'unknown'
                ? 'UNCLASSIFIED_EFFECT'
                : 'CONSEQUENTIAL_EFFECT'
      });
    }
  }
  return {
    prepare_now: prepareNow,
    approval_required: approvalRequired,
    consequential_action_authorized: false
  };
}

function invalidResult(error) {
  return {
    architecture_version: 'human-orchestration/0.6-candidate',
    status: 'HOLD_INVALID_INPUT',
    issues: [error.message],
    intent: null,
    questions_to_ask: [],
    deferred_questions: [],
    questions_not_asked: [],
    unresolved_decision_question_ids: [],
    research_now: [],
    resolved_questions: [],
    memory: {
      applicable: [],
      excluded: [],
      revocation_set_digest: stableDigest(JSON.stringify([])),
      revoked_memory_applied: false,
      raw_memory_stored: false
    },
    actions: {
      prepare_now: [],
      approval_required: [],
      consequential_action_authorized: false
    },
    phase_gate: {
      status: 'HOLD',
      preparation_allowed: false,
      execution_blocked: true,
      reasons: ['INVALID_HUMAN_CONTEXT_INPUT']
    },
    authorization: 'NOT_GRANTED'
  };
}

export function compileHumanOrchestration(task = {}, {
  memoryClaims = [],
  revokedMemoryIds = [],
  verifiedIntentConfirmations = [],
  verifiedQuestionResolutions = [],
  currentTime = new Date().toISOString(),
  maximumQuestions = 1
} = {}) {
  try {
    const intent = buildIntentEnvelope(task, {
      verifiedIntentConfirmations,
      currentTime
    });
    const hypothesisQuestions = intent.hypotheses
      .filter(item => item.status === 'PROVISIONAL' && item.changes_decision)
      .map(questionForHypothesis);
    const verifiedResolutions = normalizeVerifiedQuestionResolutions(
      verifiedQuestionResolutions,
      currentTime
    );
    const evaluatedQuestions = evaluateQuestions([
      ...hypothesisQuestions,
      ...(task.decision_questions ?? [])
    ], verifiedResolutions, task);
    const askableQuestions = evaluatedQuestions
      .filter(question => question.ask)
      .sort((left, right) => right.score - left.score);
    const questionLimit = normalizeQuestionLimit(maximumQuestions);
    const questions = askableQuestions.slice(0, questionLimit);
    const deferredQuestions = askableQuestions.slice(questionLimit).map(question => ({
      ...question,
      ask: false,
      reason: 'QUESTION_BUDGET_DEFERRED'
    }));
    const questionsNotAsked = evaluatedQuestions.filter(question => (
      ['BELOW_QUESTION_THRESHOLD', 'LOW_DECISION_VALUE'].includes(question.reason)
    ));
    const researchNow = evaluatedQuestions.filter(question => (
      question.reason === 'RESOLVE_WITH_SOURCE_FIRST'
    ));
    const resolvedQuestions = evaluatedQuestions
      .filter(question => (
        question.reason === 'RESOLVED_FROM_SOURCE' || question.reason === 'ALREADY_KNOWN'
      ))
      .map(question => ({
        id: question.id,
        prompt_digest: question.prompt_digest,
        question_context_digest: question.question_context_digest,
        resolution_ref: question.resolution_ref,
        resolution_verification: question.resolution_verification,
        resolution_summary: question.resolution_summary,
        resolution_digest: question.resolution_digest,
        usage: 'CONTEXT_ONLY_NOT_INSTRUCTION',
        reason: question.reason
      }));
    const memory = selectApplicableMemory(memoryClaims, {
      domain: task.domain ?? null,
      domains: effectiveDomains(task),
      project: task.project ?? null,
      revokedMemoryIds,
      now: currentTime
    });
    const actions = partitionActions(task.proposed_actions ?? [], {
      taskProject: task.project ?? null,
      taskScope: {
        allowed: task.allowed_scope ?? [],
        forbidden: task.forbidden_scope ?? []
      }
    });
    const unresolvedDecisionQuestions = evaluatedQuestions.filter(question => (
      !['RESOLVED_FROM_SOURCE', 'ALREADY_KNOWN', 'RESOLVE_WITH_SOURCE_FIRST'].includes(
        question.reason
      )
      && (question.changes_decision || question.user_judgment_required)
    ));
    const decisionRequired = intent.unresolved_hypothesis_ids.length > 0
      || unresolvedDecisionQuestions.length > 0;
    const researchRequired = researchNow.length > 0;
    const approvalRequired = actions.approval_required.length > 0;
    const reasons = [];
    if (decisionRequired) reasons.push('DECISION_CHANGING_INTENT_UNCONFIRMED');
    if (researchRequired) reasons.push('DECISION_SOURCE_RESEARCH_REQUIRED');
    if (approvalRequired) reasons.push('CONSEQUENTIAL_ACTION_REQUIRES_APPROVAL');
    const executionBlocked = reasons.length > 0;
    const preparationAllowed = actions.prepare_now.length > 0;
    const phaseStatus = executionBlocked
      ? preparationAllowed ? 'PREPARE_ONLY' : 'AWAIT_DECISION_OR_APPROVAL'
      : 'READY_TO_PLAN';

    return {
      architecture_version: 'human-orchestration/0.6-candidate',
      evaluation_time: new Date(dateTimeEpoch(currentTime)).toISOString(),
      status: decisionRequired
        ? 'DECISION_REQUIRED'
        : researchRequired
          ? 'RESEARCH_REQUIRED'
        : approvalRequired
            ? 'APPROVAL_REQUIRED'
            : 'READY',
      issues: [],
      intent,
      questions_to_ask: questions,
      deferred_questions: deferredQuestions,
      questions_not_asked: questionsNotAsked,
      unresolved_decision_question_ids: unresolvedDecisionQuestions.map(item => item.id),
      research_now: researchNow,
      resolved_questions: resolvedQuestions,
      memory,
      actions,
      phase_gate: {
        status: phaseStatus,
        preparation_allowed: preparationAllowed,
        execution_blocked: executionBlocked,
        reasons
      },
      authorization: 'NOT_GRANTED'
    };
  } catch (error) {
    return invalidResult(error);
  }
}
