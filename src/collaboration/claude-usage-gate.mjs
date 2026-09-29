const LIMIT_PATTERNS = [
  /usage limit/i,
  /rate limit/i,
  /hit your limit/i,
  /사용량.*한도/,
  /한도.*초과/,
];

/** 검토 호출의 인자를 «고정된 모양»으로 만든다.
 *
 *  권한모드와 출력형식을 여기서 못 박는 것은 의도다 — 부르는 쪽이 `--permission-mode bypassPermissions`
 *  같은 걸 넘겨도 검토 세션은 언제나 읽기 전용(plan)이다. 그 잠금은 그대로 둔다.
 *
 *  ★그런데 «모르는 인자»를 조용히 흘리면 안 된다 (2026-09-28 Claude 검토에서 실측).
 *    옛 판은 `-` 로 시작하지 않는 값을 전부 물음으로 이어 붙였다. 그래서
 *      `--model opus "질문"`  → 물음이 `"opus 질문"` 이 됐다.
 *    부르는 쪽은 `질문` 을 물었다고 믿는데 상대는 `opus 질문` 을 받는다. 검토 자체가 오염되고,
 *    아무 데도 표시가 남지 않는다. 막힘을 통과로 세지 않는 것과 같은 이유로 여기서 멈춘다.
 */
export function claudeReviewArgs(rawArgs = []) {
  const args = rawArgs.filter((value) => value !== '--');
  const promptFlag = args.findIndex((value) => value === '-p' || value === '--print');
  let prompt;
  let 남은것;

  if (promptFlag >= 0) {
    prompt = args[promptFlag + 1];
    남은것 = [...args.slice(0, promptFlag), ...args.slice(promptFlag + 2)];
  } else {
    남은것 = args.filter((value) => value.startsWith('-'));
    prompt = args.filter((value) => !value.startsWith('-')).join(' ').trim();
  }

  if (!prompt) throw new Error('CLAUDE_REVIEW_PROMPT_REQUIRED');
  /** 고정하는 둘은 넘겨도 받는다 — 어차피 같은 값으로 덮으므로 «무시»가 아니라 «일치»다. */
  const 받아주는것 = new Set(['--permission-mode', 'plan', '--output-format', 'text']);
  const 모르는것 = 남은것.filter((value) => !받아주는것.has(value));
  if (모르는것.length) throw new Error(`CLAUDE_REVIEW_UNSUPPORTED_ARG:${모르는것.join(',')}`);

  return [
    '-p', prompt,
    '--permission-mode', 'plan',
    '--output-format', 'text',
  ];
}

export function claudeRunOutcome(result) {
  const stdout = String(result?.stdout ?? '').trim();
  const stderr = String(result?.stderr ?? '').trim();
  const error = result?.error?.message ? String(result.error.message) : '';
  const combined = [stdout, stderr, error].filter(Boolean).join('\n');

  if (isClaudeUsageLimit(combined)) return { status: 'USAGE_LIMIT', stdout, combined };
  if (result?.status !== 0) return { status: 'FAILED', stdout, combined };
  if (!stdout) return { status: 'EMPTY_RESPONSE', stdout, combined };
  return { status: 'ANSWERED', stdout, combined };
}

export function isClaudeUsageLimit(text) {
  const normalized = String(text ?? '').replace(/\u001b\[[0-?]*[ -\/]*[@-~]/g, '').replace(/\s+/g, ' ');
  return LIMIT_PATTERNS.some((pattern) => pattern.test(normalized)) || /hit.{0,20}your.{0,20}(?:weekly\s+)?limit/i.test(normalized);
}

function partsInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function zonedIso(year, month, day, hour, minute, timeZone) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const observed = partsInTimeZone(guess, timeZone);
  const observedUtc = Date.UTC(+observed.year, +observed.month - 1, +observed.day, +observed.hour, +observed.minute);
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(guess.getTime() + desiredUtc - observedUtc).toISOString();
}

export function parseClaudeResetAt(text, { now = new Date(), timeZone = 'Asia/Seoul' } = {}) {
  const source = String(text ?? '');
  const absolute = source.match(/resets?\s+(?:on\s+)?(?:[A-Za-z]{3,9}\s+)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?[,\s]+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  const timeOnly = source.match(/resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  const localNow = partsInTimeZone(now, timeZone);
  let year = +localNow.year;
  let month = +localNow.month;
  let day = +localNow.day;
  let hour;
  let minute;

  if (absolute) {
    month = +absolute[1];
    day = +absolute[2];
    if (absolute[3]) year = +absolute[3] < 100 ? 2000 + +absolute[3] : +absolute[3];
    hour = +absolute[4];
    minute = +(absolute[5] ?? 0);
    if (absolute[6]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (absolute[6]?.toLowerCase() === 'am' && hour === 12) hour = 0;
  } else if (timeOnly) {
    hour = +timeOnly[1];
    minute = +(timeOnly[2] ?? 0);
    if (timeOnly[3].toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (timeOnly[3].toLowerCase() === 'am' && hour === 12) hour = 0;
  } else {
    return null;
  }

  let resetAt = new Date(zonedIso(year, month, day, hour, minute, timeZone));
  if (!absolute && resetAt <= now) {
    resetAt = new Date(resetAt.getTime() + 24 * 60 * 60 * 1000);
  }
  return resetAt.toISOString();
}

export function gateStatus(state, now = new Date()) {
  if (!state?.blocked_until) return { available: true, status: 'AVAILABLE' };
  const blockedUntil = new Date(state.blocked_until);
  if (Number.isNaN(blockedUntil.getTime()) || blockedUntil <= now) {
    return { available: true, status: 'RESET_REACHED', blocked_until: state.blocked_until };
  }
  return { available: false, status: 'UNAVAILABLE_UNTIL_RESET', blocked_until: blockedUntil.toISOString(), reason: state.reason };
}
