const evidenceRank = {
  NONE: 0,
  STATIC_ONLY: 1,
  SYNTHETIC: 2,
  EXECUTED: 3,
  INDEPENDENT: 4,
  SHADOW: 5,
  OUTCOME: 6,
};

const immatureLifecycle = new Set(['DISCOVERED', 'DESCRIBED', 'HOLD', 'REJECTED', 'DEPRECATED', 'SUPERSEDED']);

export function validateCapabilityCell(cell) {
  const problems = [];
  if (!cell?.capability_id) problems.push('MISSING_CAPABILITY_ID');
  if (!cell?.semantic_key) problems.push('MISSING_SEMANTIC_KEY');
  if (!Array.isArray(cell?.implementation_refs) || cell.implementation_refs.length === 0) problems.push('MISSING_IMPLEMENTATION_REF');
  if (!cell?.contract) problems.push('MISSING_CONTRACT');
  if (!cell?.semantic_provenance) problems.push('MISSING_SEMANTIC_PROVENANCE');
  if (!cell?.evidence_state) problems.push('MISSING_EVIDENCE_STATE');

  const sideEffect = cell?.contract?.side_effect;
  if (sideEffect?.class === 'WRITE_EXTERNAL' || sideEffect?.class === 'MIXED') {
    if (sideEffect.idempotency !== 'SUPPORTED') problems.push('SIDE_EFFECT_IDEMPOTENCY_NOT_PROVEN');
    if (sideEffect.authority_required !== true) problems.push('SIDE_EFFECT_AUTHORITY_BOUNDARY_MISSING');
  }

  if (cell?.semantic_provenance === 'AI_INFERRED' && ['ADOPTED_WITHIN_SCOPE', 'OUTCOME_OBSERVED'].includes(cell?.lifecycle)) {
    problems.push('AI_INFERRED_SEMANTICS_CANNOT_SELF_ADOPT');
  }

  if (cell?.lifecycle === 'DISCOVERED' && cell?.evidence_state !== 'STATIC_ONLY' && cell?.evidence_state !== 'NONE') {
    problems.push('DISCOVERED_CAPABILITY_EVIDENCE_OVERCLAIM');
  }

  return { ok: problems.length === 0, problems };
}

export function capabilityEdges(cell) {
  const edges = [];
  for (const id of cell.implements_ports ?? []) edges.push({ from: cell.capability_id, type: 'IMPLEMENTS_PORT', to: id });
  for (const id of cell.depends_on ?? []) edges.push({ from: cell.capability_id, type: 'DEPENDS_ON', to: id });
  for (const id of cell.wraps_connectors ?? []) edges.push({ from: cell.capability_id, type: 'WRAPS_CONNECTOR', to: id });
  if (cell.supersedes) edges.push({ from: cell.capability_id, type: 'SUPERSEDES', to: cell.supersedes });
  return edges;
}

function names(items = []) {
  return new Set(items.map((x) => x.name));
}

function covers(required = [], available = new Set()) {
  return required.every((x) => available.has(x));
}

function sideEffectAllowed(policy, sideEffectClass) {
  if (policy === 'WRITE_OK') return true;
  if (policy === 'READ_OK') return sideEffectClass === 'NONE' || sideEffectClass === 'READ_EXTERNAL';
  return sideEffectClass === 'NONE';
}

export function resolveCapability(query, cell) {
  const validation = validateCapabilityCell(cell);
  if (!validation.ok) return { decision: 'HOLD_SEMANTICS_UNKNOWN', reasons: validation.problems };

  if (immatureLifecycle.has(cell.lifecycle)) {
    return { decision: 'HOLD_SEMANTICS_UNKNOWN', reasons: [`LIFECYCLE_${cell.lifecycle}`] };
  }

  const requiredEvidence = evidenceRank[query.minimum_evidence] ?? 99;
  const actualEvidence = evidenceRank[cell.evidence_state] ?? 0;
  if (actualEvidence < requiredEvidence) {
    return { decision: 'HOLD_EVIDENCE_INSUFFICIENT', reasons: [`EVIDENCE_${cell.evidence_state}_LT_${query.minimum_evidence}`] };
  }

  const sideEffectClass = cell.contract?.side_effect?.class ?? 'NONE';
  if (!sideEffectAllowed(query.side_effect_policy, sideEffectClass)) {
    return { decision: 'HOLD_SIDE_EFFECT_MISMATCH', reasons: [`SIDE_EFFECT_${sideEffectClass}_NOT_ALLOWED`] };
  }

  if (!query.allowed_kinds.includes(cell.kind)) {
    return { decision: 'NEW_REQUIRED', reasons: ['KIND_MISMATCH'] };
  }

  if (query.target_runtime && cell.compatibility?.runtimes?.length && !cell.compatibility.runtimes.includes(query.target_runtime)) {
    return { decision: 'HOLD_COMPATIBILITY_UNKNOWN', reasons: ['RUNTIME_MISMATCH'] };
  }

  const inNames = names(cell.contract.inputs);
  const outNames = names(cell.contract.outputs);
  const inputFit = covers(query.required_inputs ?? [], inNames);
  const outputFit = covers(query.required_outputs ?? [], outNames);
  const semanticFit = query.semantic_key === cell.semantic_key;
  const portFit = !query.required_port || (cell.implements_ports ?? []).includes(query.required_port) || cell.capability_id === query.required_port;

  if (semanticFit && inputFit && outputFit && portFit) {
    return { decision: 'REUSE_EXACT', reasons: ['SEMANTIC_AND_CONTRACT_MATCH'] };
  }

  if (semanticFit && query.adapter_allowed && portFit) {
    return { decision: 'REUSE_WITH_ADAPTER', reasons: ['SEMANTIC_MATCH_SHAPE_OR_REPRESENTATION_MISMATCH'] };
  }

  return { decision: 'NEW_REQUIRED', reasons: ['NO_SAFE_SEMANTIC_MATCH'] };
}

export function resolveBest(query, cells) {
  const priority = {
    REUSE_EXACT: 0,
    REUSE_WITH_ADAPTER: 1,
    COMPOSE: 2,
    EXTEND_CANDIDATE: 3,
    NEW_REQUIRED: 4,
    HOLD_EVIDENCE_INSUFFICIENT: 5,
    HOLD_COMPATIBILITY_UNKNOWN: 6,
    HOLD_SIDE_EFFECT_MISMATCH: 7,
    HOLD_SEMANTICS_UNKNOWN: 8,
  };

  const results = cells.map((cell) => ({ capability_id: cell.capability_id, ...resolveCapability(query, cell) }));
  return results.sort((a, b) => (priority[a.decision] ?? 99) - (priority[b.decision] ?? 99));
}