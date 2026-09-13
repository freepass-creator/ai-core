import { createHash } from 'node:crypto';

const LEARNING_DOMAINS = new Set([
  'development',
  'legal',
  'business',
  'document',
  'communication',
  'general',
  'core'
]);
const LEARNING_AUTHORITIES = new Set([
  'user_directive',
  'observed_outcome',
  'verified_source',
  'assistant_inference'
]);
const FORBIDDEN_RAW_FIELDS = new Set([
  'raw_content',
  'transcript',
  'message_body',
  'full_text',
  'sensitive_payload'
]);

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function hasForbiddenRawField(value) {
  if (!value || typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_RAW_FIELDS.has(key)) return true;
    if (hasForbiddenRawField(child)) return true;
  }
  return false;
}

function normalizeSourceRef(sourceRef) {
  const location = String(sourceRef?.location ?? '').trim();
  const revision = String(sourceRef?.revision_or_sha ?? '').trim();
  const observedAt = String(sourceRef?.observed_at ?? '').trim();
  if (!location || (!revision && !observedAt)) {
    throw new Error('source_ref requires location and revision_or_sha or observed_at');
  }
  if (observedAt && Number.isNaN(Date.parse(observedAt))) {
    throw new Error('source_ref observed_at must be a valid timestamp');
  }
  return {
    location,
    ...(revision ? { revision_or_sha: revision } : {}),
    ...(observedAt ? { observed_at: observedAt } : {}),
    kind: String(sourceRef.kind ?? 'conversation_pointer')
  };
}

function confidenceFor(observation) {
  if (Number.isFinite(observation.confidence)) {
    return Math.max(0, Math.min(1, observation.confidence));
  }
  if (observation.authority === 'user_directive') return 0.9;
  if (observation.authority === 'verified_source') return 0.85;
  if (observation.authority === 'observed_outcome') return 0.7;
  return 0.4;
}

export function normalizeLearningObservation(observation = {}) {
  if (hasForbiddenRawField(observation)) {
    throw new Error('raw conversation or sensitive payload fields are forbidden');
  }
  if (observation.sanitized !== true) {
    throw new Error('conversation observations must be explicitly sanitized');
  }
  for (const field of ['observation_id', 'rule_key', 'summary', 'expected_behavior']) {
    if (!String(observation[field] ?? '').trim()) throw new Error(`${field} is required`);
  }
  const domains = Array.isArray(observation.domains)
    ? [...new Set(observation.domains.map(String))]
    : [];
  if (!domains.length || domains.some(domain => !LEARNING_DOMAINS.has(domain))) {
    throw new Error('one or more supported domains are required');
  }
  const authority = observation.authority ?? 'assistant_inference';
  if (!LEARNING_AUTHORITIES.has(authority)) throw new Error(`unsupported authority: ${authority}`);

  const sourceRef = normalizeSourceRef(observation.source_ref);
  const normalized = {
    observation_id: String(observation.observation_id).trim(),
    rule_key: String(observation.rule_key).trim(),
    summary: String(observation.summary).trim(),
    expected_behavior: String(observation.expected_behavior).trim(),
    domains,
    authority,
    confidence: confidenceFor({ ...observation, authority }),
    source_ref: sourceRef,
    causal_principle: String(observation.causal_principle ?? '').trim() || null,
    required_conditions: Array.isArray(observation.required_conditions)
      ? observation.required_conditions.map(String).filter(Boolean)
      : [],
    failure_conditions: Array.isArray(observation.failure_conditions)
      ? observation.failure_conditions.map(String).filter(Boolean)
      : [],
    counterexample: String(observation.counterexample ?? '').trim() || null,
    small_test: String(observation.small_test ?? '').trim() || null,
    sanitized: true
  };
  return {
    ...normalized,
    fingerprint: `sha256:${stableHash({
      rule_key: normalized.rule_key,
      expected_behavior: normalized.expected_behavior,
      domains: [...normalized.domains].sort()
    })}`
  };
}

function ownerForDomains(domains) {
  const owners = new Set(domains.map(domain => {
    if (domain === 'development') return 'devcenter';
    if (['legal', 'business', 'document', 'communication'].includes(domain)) return 'aiops';
    return 'ai-core';
  }));
  return owners.size === 1 ? [...owners][0] : 'ai-core';
}

function sourceIdentity(sourceRef) {
  return `${sourceRef.location}@${sourceRef.revision_or_sha ?? sourceRef.observed_at}`;
}

function authorityRank(authority) {
  return {
    user_directive: 4,
    verified_source: 3,
    observed_outcome: 2,
    assistant_inference: 1
  }[authority] ?? 0;
}

function resolveCompetingBehaviors(behaviors) {
  const items = [...behaviors.values()].flat();
  const highestRank = Math.max(...items.map(item => authorityRank(item.authority)));
  const strongest = items.filter(item => authorityRank(item.authority) === highestRank);
  const strongestBehaviors = new Set(strongest.map(item => item.expected_behavior));
  if (strongestBehaviors.size === 1) {
    return {
      selected_behavior: [...strongestBehaviors][0],
      reason: 'higher_authority_evidence'
    };
  }

  const dated = strongest
    .map(item => ({ item, time: Date.parse(item.source_ref.observed_at ?? '') }))
    .filter(entry => Number.isFinite(entry.time))
    .sort((a, b) => b.time - a.time);
  if (dated.length === strongest.length && dated.length > 1 && dated[0].time > dated[1].time) {
    return {
      selected_behavior: dated[0].item.expected_behavior,
      reason: 'latest_explicit_instruction_at_same_authority'
    };
  }
  return null;
}

function maturityFor(cluster) {
  const direct = cluster.authorities.includes('user_directive');
  const repeated = cluster.source_refs.length >= 2;
  const principleComplete = Boolean(
    cluster.causal_principle
    && cluster.required_conditions.length
    && cluster.failure_conditions.length
    && cluster.counterexample
  );
  if (principleComplete && cluster.small_test) return 'SYSTEM_CANDIDATE';
  if (principleComplete) return 'PRINCIPLE';
  if (direct || repeated) return 'PATTERN';
  return 'OBSERVATION';
}

function clusterObservations(items) {
  const first = items[0];
  const sourceMap = new Map();
  for (const item of items) sourceMap.set(sourceIdentity(item.source_ref), item.source_ref);
  const sourceRefs = [...sourceMap.values()];
  const authorities = [...new Set(items.map(item => item.authority))];
  const best = [...items].sort((a, b) => b.confidence - a.confidence)[0];
  const cluster = {
    rule_key: first.rule_key,
    fingerprint: first.fingerprint,
    summary: best.summary,
    expected_behavior: first.expected_behavior,
    domains: [...new Set(items.flatMap(item => item.domains))],
    authorities,
    confidence: Math.max(...items.map(item => item.confidence)),
    observation_ids: items.map(item => item.observation_id),
    source_refs: sourceRefs,
    causal_principle: best.causal_principle,
    required_conditions: best.required_conditions,
    failure_conditions: best.failure_conditions,
    counterexample: best.counterexample,
    small_test: best.small_test,
    owner_system: ownerForDomains(items.flatMap(item => item.domains)),
    governance_status: 'CANDIDATE',
    auto_adopted: false,
    execution_authorized: false
  };
  return { ...cluster, maturity: maturityFor(cluster) };
}

function buildSignal(cluster) {
  return {
    signal_id: `learning:${cluster.fingerprint.slice('sha256:'.length, 'sha256:'.length + 16)}`,
    kind: 'conversation_lesson',
    summary: cluster.summary,
    scope: cluster.domains.join(','),
    domains: cluster.domains,
    target_system_hint: cluster.owner_system,
    severity: cluster.maturity === 'OBSERVATION' ? 'notice' : 'hold',
    change_class: cluster.owner_system === 'ai-core' ? 'C' : 'B',
    created_by: 'AI_CORE_CONVERSATION_LEARNING',
    evidence_refs: cluster.source_refs
  };
}

export function compileConversationLearning(observations = []) {
  const accepted = [];
  const rejected = [];
  const seenObservationIds = new Set();

  for (const observation of observations) {
    try {
      const normalized = normalizeLearningObservation(observation);
      if (seenObservationIds.has(normalized.observation_id)) {
        throw new Error('duplicate observation_id');
      }
      seenObservationIds.add(normalized.observation_id);
      accepted.push(normalized);
    } catch (error) {
      rejected.push({
        observation_id: observation?.observation_id ?? null,
        reason: error?.message ?? 'invalid learning observation'
      });
    }
  }

  const byRule = new Map();
  for (const item of accepted) {
    const items = byRule.get(item.rule_key) ?? [];
    items.push(item);
    byRule.set(item.rule_key, items);
  }

  const conflicts = [];
  const resolvedConflicts = [];
  const candidates = [];
  for (const [ruleKey, items] of byRule.entries()) {
    const behaviors = new Map();
    for (const item of items) {
      const group = behaviors.get(item.expected_behavior) ?? [];
      group.push(item);
      behaviors.set(item.expected_behavior, group);
    }
    if (behaviors.size > 1) {
      const resolution = resolveCompetingBehaviors(behaviors);
      if (resolution) {
        const selectedGroup = behaviors.get(resolution.selected_behavior);
        const selectedFingerprint = selectedGroup[0].fingerprint;
        resolvedConflicts.push({
          rule_key: ruleKey,
          status: 'RESOLVED_BY_PRECEDENCE',
          selected_fingerprint: selectedFingerprint,
          superseded_fingerprints: [...behaviors.values()]
            .map(group => group[0].fingerprint)
            .filter(fingerprint => fingerprint !== selectedFingerprint),
          reason: resolution.reason
        });
        candidates.push(clusterObservations(selectedGroup));
        continue;
      }
      conflicts.push({
        rule_key: ruleKey,
        status: 'HOLD_CONFLICT',
        competing_fingerprints: [...behaviors.values()].map(group => group[0].fingerprint),
        resolution: 'Apply the latest explicit user instruction or owner-system authoritative source; preserve superseded evidence'
      });
      continue;
    }
    candidates.push(clusterObservations(items));
  }

  const signals = candidates.map(buildSignal);
  for (const conflict of conflicts) {
    signals.push({
      signal_id: `learning-conflict:${stableHash(conflict.rule_key).slice(0, 16)}`,
      kind: 'governance_gap',
      summary: `Conversation-derived rules conflict: ${conflict.rule_key}`,
      scope: 'ai-core',
      severity: 'hold',
      change_class: 'C',
      created_by: 'AI_CORE_CONVERSATION_LEARNING'
    });
  }

  return {
    status: conflicts.length
      ? 'HOLD_CONFLICT'
      : rejected.length
        ? 'HOLD_INVALID_INPUT'
        : candidates.length
          ? 'LEARNING_CANDIDATES'
          : 'NO_INPUT',
    lifecycle: [
      'OBSERVATION',
      'PATTERN',
      'PRINCIPLE',
      'SYSTEM_CANDIDATE',
      'TRANSFER_READY',
      'ADOPTED',
      'PROPAGATED',
      'OUTCOME_OBSERVED'
    ],
    candidates,
    conflicts,
    resolved_conflicts: resolvedConflicts,
    rejected,
    signals,
    raw_conversation_stored: false,
    semantic_sanitization_verified: false,
    auto_adopted: false,
    execution_authorized: false
  };
}
