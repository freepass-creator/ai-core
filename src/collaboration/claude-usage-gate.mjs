const LIMIT_PATTERNS = [
  /usage limit/i,
  /rate limit/i,
  /hit your limit/i,
  /사용량.*한도/,
  /한도.*초과/,
];

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
