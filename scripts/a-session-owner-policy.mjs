const OWNER = /^A-session-[a-z0-9][a-z0-9._-]{5,}$/;
const FORBIDDEN = new Set(['A_SESSION','A-session-current-chat','A-session-default','A-session-generic']);

export function isValidASessionOwner(owner) {
  return typeof owner === 'string' && OWNER.test(owner) && !FORBIDDEN.has(owner);
}

export function resolveASessionOwner(explicitOwner, env = process.env) {
  const candidate = explicitOwner || env.AI_CORE_A_SESSION_ID || null;
  if (!candidate) throw new Error('A_SESSION_OWNER_REQUIRED');
  if (!isValidASessionOwner(candidate)) throw new Error('A_SESSION_OWNER_INVALID');
  return candidate;
}

export const A_SESSION_OWNER_POLICY = Object.freeze({
  source:'--owner or AI_CORE_A_SESSION_ID',
  format:'A-session-<stable-unique-id>',
  forbidden:['A_SESSION','A-session-current-chat','A-session-default','A-session-generic'],
  requirement:'Every claim mutation is owner-bound except automated lease-expiry reaping.'
});
