import { readFile } from 'node:fs/promises';
import { isCanonicalASessionScope, aSessionScopesConflict } from './a-session-scope-policy.mjs';
import { isValidASessionOwner } from './a-session-owner-policy.mjs';

const SHA40 = /^[0-9a-f]{40}$/;
const STATES = new Set(['ACTIVE','COMPLETED','ABANDONED','SUPERSEDED']);

function add(errors, code, path, detail) {
  errors.push({ code, path, ...(detail ? { detail } : {}) });
}
function validDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function validateAWorkClaims(registry) {
  const errors = [];
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    return { status:'INVALID', errors:[{ code:'REGISTRY_NOT_OBJECT', path:'$' }] };
  }
  if (registry.schema !== 'ai-core-a-session-work-claims/v1') add(errors,'SCHEMA_ID_INVALID','/schema');
  if (registry.status !== 'RESEARCH_COORDINATION_NOT_CANONICAL') add(errors,'CANONICAL_BOUNDARY_INVALID','/status');
  if (!validDate(registry.observed_at)) add(errors,'OBSERVED_AT_INVALID','/observed_at');
  if (!Array.isArray(registry.claims)) return { status:'INVALID', errors:[...errors,{ code:'CLAIMS_NOT_ARRAY', path:'/claims' }] };

  const claimIds = new Set();
  const liveClaims = [];
  const observedAt = Date.parse(registry.observed_at || '');

  registry.claims.forEach((claim, i) => {
    const p = '/claims/' + i;
    if (typeof claim?.claim_id !== 'string' || !claim.claim_id.trim()) add(errors,'CLAIM_ID_INVALID',p + '/claim_id');
    else if (claimIds.has(claim.claim_id)) add(errors,'CLAIM_ID_DUPLICATE',p + '/claim_id');
    else claimIds.add(claim.claim_id);

    const expectedKey = String(claim?.repository) + '@' + String(claim?.subject_revision) + '::' + String(claim?.scope);
    if (claim?.claim_key !== expectedKey) add(errors,'CLAIM_KEY_INVALID',p + '/claim_key');
    if (typeof claim?.repository !== 'string' || !claim.repository.includes('/')) add(errors,'REPOSITORY_INVALID',p + '/repository');
    if (!SHA40.test(claim?.subject_revision || '')) add(errors,'SUBJECT_REVISION_INVALID',p + '/subject_revision');
    if (typeof claim?.scope !== 'string' || !claim.scope.trim()) add(errors,'SCOPE_INVALID',p + '/scope');
    else if (claim?.state === 'ACTIVE' && !isCanonicalASessionScope(claim.scope)) add(errors,'ACTIVE_SCOPE_NOT_CANONICAL',p + '/scope');
    if (typeof claim?.owner_session !== 'string' || !claim.owner_session.trim()) add(errors,'OWNER_SESSION_INVALID',p + '/owner_session');
    else if (claim?.state === 'ACTIVE' && !isValidASessionOwner(claim.owner_session)) add(errors,'ACTIVE_OWNER_NOT_STABLE',p + '/owner_session');
    if (!STATES.has(claim?.state)) add(errors,'STATE_INVALID',p + '/state');
    if (!validDate(claim?.claimed_at)) add(errors,'CLAIMED_AT_INVALID',p + '/claimed_at');
    if (!validDate(claim?.lease_until)) add(errors,'LEASE_UNTIL_INVALID',p + '/lease_until');
    if (claim?.heartbeat_at != null) {
      if (!validDate(claim.heartbeat_at)) add(errors,'HEARTBEAT_AT_INVALID',p + '/heartbeat_at');
      else {
        if (validDate(claim.claimed_at) && Date.parse(claim.heartbeat_at) < Date.parse(claim.claimed_at)) add(errors,'HEARTBEAT_BEFORE_CLAIM',p + '/heartbeat_at');
        if (validDate(claim.lease_until) && Date.parse(claim.heartbeat_at) > Date.parse(claim.lease_until)) add(errors,'HEARTBEAT_AFTER_LEASE',p + '/heartbeat_at');
      }
    }

    if (claim?.state === 'ACTIVE' && validDate(claim.lease_until) && Date.parse(claim.lease_until) > observedAt) {
      for (const prior of liveClaims) {
        if (
          prior.claim.repository === claim.repository &&
          prior.claim.subject_revision === claim.subject_revision &&
          aSessionScopesConflict(prior.claim.scope, claim.scope)
        ) {
          const code = prior.claim.claim_key === claim.claim_key ? 'LIVE_CLAIM_DUPLICATE' : 'LIVE_CLAIM_SCOPE_CONFLICT';
          add(errors,code,p,claim.claim_key + ' conflicts with ' + prior.path);
        }
      }
      liveClaims.push({ claim, path:p });
    }

    if (claim?.state === 'COMPLETED') {
      if (!validDate(claim?.completed_at)) add(errors,'COMPLETED_AT_REQUIRED',p + '/completed_at');
      if (!Array.isArray(claim?.evidence_refs) || claim.evidence_refs.length === 0 ||
          claim.evidence_refs.some(x => typeof x !== 'string' || !x.trim())) {
        add(errors,'COMPLETION_EVIDENCE_REQUIRED',p + '/evidence_refs');
      }
    }
  });

  return { status: errors.length ? 'INVALID' : 'VALID', errors, live_claims: liveClaims.length };
}

if (process.argv[1]?.endsWith('validate-a-session-work-claims.mjs')) {
  if (!process.argv[2]) {
    console.error('Usage: node scripts/validate-a-session-work-claims.mjs <claims.json>');
    process.exit(2);
  }
  const registry = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const result = validateAWorkClaims(registry);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'VALID') process.exitCode = 1;
}
