/** Pure intake validation. No parsing, persistence, authorization or execution. */
export function normalizeOrderIntent(candidate, context = {}) {
  const issues = [];
  const add = (code, field) => issues.push({ code, field });
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;
  const c = object(candidate) ? candidate : {};
  if (!object(candidate)) add('INVALID_CANDIDATE', 'candidate');
  const source = object(c.source) ? c.source : {};
  const sourceValid = nonempty(source.message_id) && nonempty(source.text)
    && ['user', 'agent', 'document'].includes(source.origin);
  if (!sourceValid) add('MISSING_SOURCE', 'source');
  // Offsets are UTF-16 code units, matching JavaScript String.slice.
  const claim = (input, field, valid) => {
    if (input === undefined || input === null) return null;
    if (!object(input) || !valid(input.value)) {
      add('INVALID_VALUE', field);
      return null;
    }
    if (!sourceValid || !Array.isArray(input.evidence) || input.evidence.length === 0
      || !input.evidence.every((e) => object(e) && Number.isSafeInteger(e.start)
        && Number.isSafeInteger(e.end) && e.start >= 0 && e.end > e.start
        && e.end <= source.text.length && nonempty(e.quote)
        && source.text.slice(e.start, e.end) === e.quote)) {
      add('INVALID_EVIDENCE', field);
      return null;
    }
    return { value: input.value, evidence: input.evidence.map(({ start, end, quote }) => ({ start, end, quote })) };
  };
  const intent = claim(c.intent, 'intent', (v) => ['new', 'resume', 'change', 'status', 'stop'].includes(v));
  if (!intent) add('MISSING_INTENT', 'intent');
  const request = claim(c.request, 'request', nonempty);
  if (['new', 'change'].includes(intent?.value) && !request) add('MISSING_REQUEST', 'request');
  const location = claim(c.execution_location, 'execution_location', (v) => ['local', 'server', 'unspecified'].includes(v));
  const deadline = claim(c.deadline, 'deadline', nonempty);
  const completion = claim(c.completion_condition, 'completion_condition', nonempty);
  const approval = claim(c.approval, 'approval', nonempty);
  const targets = [];
  if (c.targets !== undefined && !Array.isArray(c.targets)) add('INVALID_TARGETS', 'targets');
  for (const [index, input] of (Array.isArray(c.targets) ? c.targets : []).entries()) {
    const target = claim(input, `targets[${index}]`, nonempty);
    if (target && !targets.some((t) => t.value === target.value)) targets.push(target);
  }
  const snapshot = object(context) && object(context.target_snapshot) ? context.target_snapshot : null;
  const snapshotValid = snapshot && nonempty(snapshot.ref) && nonempty(snapshot.revision)
    && Array.isArray(snapshot.order_ids) && snapshot.order_ids.every(nonempty);
  if (targets.length && !snapshotValid) add('TARGET_LOOKUP_REQUIRED', 'targets');
  if (snapshotValid) for (const target of targets) {
    if (!snapshot.order_ids.includes(target.value)) add('UNKNOWN_TARGET', 'targets');
  }
  if (intent && intent.value !== 'new' && targets.length === 0) add('MISSING_TARGET', 'targets');
  if (targets.length > 1) add('AMBIGUOUS_TARGET', 'targets');
  if (intent?.value === 'new' && targets.length) add('NEW_WITH_EXISTING_TARGET', 'targets');
  if (sourceValid && source.origin !== 'user') add('USER_CONFIRMATION_REQUIRED', 'source.origin');
  const clarification = issues.length ? {
    question: targets.length > 1 ? '어느 작업을 말씀하셨나요?' : '대상 작업과 원하시는 작업을 짧게 확인해 주세요.',
    choices: targets.map((t) => ({ order_id: t.value })),
    reasons: [...new Set(issues.map((i) => i.code))],
  } : null;
  return {
    status: issues.length ? 'NEEDS_CLARIFICATION' : 'CANDIDATE_VALIDATED',
    execution_authorized: false,
    authorization_status: 'NOT_EVALUATED',
    semantic_confirmation: 'REQUIRED',
    source: sourceValid ? { message_id: source.message_id, origin: source.origin, text: source.text } : null,
    intent, request, targets, execution_location: location,
    deadline, completion_condition: completion, approval_candidate: approval,
    target_snapshot: snapshotValid ? { ref: snapshot.ref, revision: snapshot.revision } : null,
    issues, clarification,
  };
}
