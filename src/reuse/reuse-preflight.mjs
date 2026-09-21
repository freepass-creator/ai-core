const STOP_WORDS = new Set(['the','and','for','with','from','this','that','있는','없는','위한','관련','기능','작업','생성','만들기']);
export const REUSE_DECISIONS = new Set([
  'REUSE_EXACT',
  'REUSE_WITH_ADAPTER',
  'COMPOSE_OR_EXTEND',
  'KEEP_LOCAL',
  'HOLD_UNKNOWN',
  'CREATE_NEW_JUSTIFIED',
]);

function passReuseDecision(payload) {
  return {
    status: 'PASS',
    decision_scope: 'REUSE_PREFLIGHT_ONLY',
    write_authorized: false,
    write_boundary: 'EXISTING_PROJECT_OR_WORK_OWNERSHIP_REQUIRED',
    ...payload,
  };
}

export function queryTokens(query) {
  return [...new Set(String(query ?? '').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}._-]{1,}/gu) ?? [])]
    .filter((token) => !STOP_WORDS.has(token));
}

export function rankReuseCandidates(query, candidates, limit = 20) {
  const tokens = queryTokens(query);
  return candidates.map((candidate) => {
    const haystack = `${candidate.id ?? ''} ${candidate.title ?? ''} ${candidate.path ?? ''} ${candidate.text ?? ''}`.toLowerCase();
    const matched = tokens.filter((token) => haystack.includes(token));
    return { ...candidate, score: matched.length, matched_tokens: matched };
  }).filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || String(a.path ?? a.id).localeCompare(String(b.path ?? b.id)))
    .slice(0, limit);
}

export function validateReuseDecision({ decision, selected = [], reason = '', candidateCount = 0 }) {
  if (!REUSE_DECISIONS.has(decision)) return { status: 'HOLD', reason: 'REUSE_DECISION_REQUIRED' };
  if (decision === 'CREATE_NEW_JUSTIFIED') {
    if (String(reason).trim().length < 20) return { status: 'HOLD', reason: 'NEW_ASSET_REASON_TOO_SHORT' };
    return passReuseDecision({
      action: decision,
      searched_candidate_count: candidateCount,
      reason: String(reason).trim(),
      creation_requires_ownership: true,
    });
  }
  if (decision === 'HOLD_UNKNOWN') return { status: 'HOLD', reason: 'REUSE_UNKNOWN' };
  if (selected.length === 0) return { status: 'HOLD', reason: 'REUSE_SELECTION_REQUIRED' };
  return passReuseDecision({ action: decision, selected });
}
