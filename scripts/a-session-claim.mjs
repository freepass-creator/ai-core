import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { isCanonicalASessionScope, aSessionScopesConflict } from './a-session-scope-policy.mjs';
import { isValidASessionOwner, resolveASessionOwner } from './a-session-owner-policy.mjs';

const run = promisify(execFile);
const DEFAULT_COORD_REPO = process.env.AI_CORE_COORDINATION_REPOSITORY || 'freepass-creator/ai-core';
const DEFAULT_BRANCH = process.env.AI_CORE_COORDINATION_BRANCH || 'main';
const CLAIM_PATH = 'docs/research/a-session-work-claims.v1.json';

function iso(value = new Date()) { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
function addMinutes(date, minutes) { return new Date(date.getTime() + minutes * 60_000); }

export function claimKey({ repository, revision, scope }) {
  return `${repository}@${revision}::${scope}`;
}

export function evaluateClaim(registry, request, now = new Date()) {
  if (!isCanonicalASessionScope(request?.scope)) throw new Error('CLAIM_SCOPE_INVALID');
  const key = claimKey(request);
  const nowMs = now.getTime();
  const allClaims = registry.claims || [];
  const ownerLive = allClaims.find(x =>
    x.owner_session === request.owner &&
    x.state === 'ACTIVE' &&
    Date.parse(x.lease_until) > nowMs
  );
  const sameSubject = allClaims.filter(x =>
    x.repository === request.repository &&
    x.subject_revision === request.revision
  );
  const live = sameSubject.find(x =>
    x.state === 'ACTIVE' &&
    Date.parse(x.lease_until) > nowMs &&
    aSessionScopesConflict(x.scope, request.scope)
  );
  if (live) {
    return {
      action:live.claim_key === key ? 'SKIP_DUPLICATE' : 'SKIP_SCOPE_CONFLICT',
      claim:live
    };
  }
  if (ownerLive) {
    return {
      action:'SKIP_OWNER_BUSY',
      claim:ownerLive
    };
  }
  const done = [...sameSubject].reverse().find(x => x.state === 'COMPLETED' && x.claim_key === key);
  if (done) return { action:'SKIP_ALREADY_COMPLETED', claim:done };
  return { action:'ACQUIRE', claim:null };
}

export function acquireClaim(registry, request, { now = new Date(), leaseMinutes = 60, claimId = null } = {}) {
  if (!isValidASessionOwner(request?.owner)) throw new Error('A_SESSION_OWNER_INVALID');
  const decision = evaluateClaim(registry, request, now);
  if (decision.action !== 'ACQUIRE') return { registry, decision };
  const id = claimId || `A-${now.toISOString().replace(/[-:.TZ]/g,'').slice(0,14)}-${randomUUID().slice(0,8)}`;
  const claim = {
    claim_id:id,
    claim_key:claimKey(request),
    repository:request.repository,
    subject_revision:request.revision,
    scope:request.scope,
    owner_session:request.owner,
    state:'ACTIVE',
    claimed_at:iso(now),
    lease_until:iso(addMinutes(now, leaseMinutes)),
    completed_at:null,
    evidence_refs:[]
  };
  const next = structuredClone(registry);
  next.observed_at = iso(now);
  next.claims = [...(next.claims || []), claim];
  return { registry:next, decision:{ action:'ACQUIRED', claim } };
}

export function renewClaim(registry, claimId, owner, { now = new Date(), leaseMinutes = 60 } = {}) {
  if (!isValidASessionOwner(owner)) throw new Error('A_SESSION_OWNER_INVALID');
  const next = structuredClone(registry);
  const claim = next.claims.find(x => x.claim_id === claimId);
  if (!claim) throw new Error('CLAIM_NOT_FOUND');
  if (claim.state !== 'ACTIVE') throw new Error('CLAIM_NOT_ACTIVE');
  if (claim.owner_session !== owner) throw new Error('CLAIM_OWNER_MISMATCH');

  const competing = next.claims.find(x =>
    x.claim_id !== claimId &&
    x.repository === claim.repository &&
    x.subject_revision === claim.subject_revision &&
    x.state === 'ACTIVE' &&
    Date.parse(x.lease_until) > now.getTime() &&
    aSessionScopesConflict(x.scope, claim.scope)
  );
  if (competing) throw new Error('CLAIM_SUPERSEDED_BY_LIVE_OWNER');

  const recovered = Date.parse(claim.lease_until) <= now.getTime();
  claim.lease_until = iso(addMinutes(now, leaseMinutes));
  claim.heartbeat_at = iso(now);
  next.observed_at = iso(now);
  return { registry:next, claim, action:recovered ? 'RECOVERED' : 'RENEWED' };
}

export function transitionClaim(registry, claimId, state, { now = new Date(), evidenceRefs = [], owner = null } = {}) {
  const allowed = new Set(['COMPLETED','ABANDONED','SUPERSEDED']);
  if (!allowed.has(state)) throw new Error('CLAIM_TARGET_STATE_INVALID');
  const next = structuredClone(registry);
  const claim = next.claims.find(x => x.claim_id === claimId);
  if (!claim) throw new Error('CLAIM_NOT_FOUND');
  if (claim.state !== 'ACTIVE') throw new Error('CLAIM_NOT_ACTIVE');
  if (!isValidASessionOwner(owner)) throw new Error('A_SESSION_OWNER_INVALID');
  if (claim.owner_session !== owner) throw new Error('CLAIM_OWNER_MISMATCH');
  if (state === 'COMPLETED' && evidenceRefs.length === 0) throw new Error('COMPLETION_EVIDENCE_REQUIRED');
  claim.state = state;
  claim.completed_at = iso(now);
  claim.evidence_refs = [...evidenceRefs];
  next.observed_at = iso(now);
  return { registry:next, claim };
}

async function ghApi(args) {
  return (await run('gh', ['api', ...args], { encoding:'utf8', maxBuffer:16*1024*1024 })).stdout;
}

export async function readRemoteRegistry(coordRepo = DEFAULT_COORD_REPO, branch = DEFAULT_BRANCH) {
  const raw = JSON.parse(await ghApi([`repos/${coordRepo}/contents/${CLAIM_PATH}`, '-X', 'GET', '-f', `ref=${branch}`]));
  const content = Buffer.from(raw.content.replace(/\n/g,''), 'base64').toString('utf8');
  return { registry:JSON.parse(content), sha:raw.sha };
}

export async function writeRemoteRegistry(registry, sha, message, coordRepo = DEFAULT_COORD_REPO, branch = DEFAULT_BRANCH) {
  const content = Buffer.from(`${JSON.stringify(registry, null, 2)}\n`, 'utf8').toString('base64');
  return JSON.parse(await ghApi([
    `repos/${coordRepo}/contents/${CLAIM_PATH}`, '-X', 'PUT',
    '-f', `message=${message}`, '-f', `content=${content}`, '-f', `sha=${sha}`, '-f', `branch=${branch}`
  ]));
}

function argValue(args, name) { const i=args.indexOf(name); return i < 0 ? null : (args[i+1] ?? null); }
function argValues(args, name) { return args.flatMap((x,i) => x === name && args[i+1] ? [args[i+1]] : []); }

export async function claimRemote(request, options = {}) {
  const attempts = options.attempts ?? 2;
  for (let attempt=0; attempt<attempts; attempt++) {
    const current = await readRemoteRegistry(options.coordRepo, options.branch);
    const prepared = acquireClaim(current.registry, request, options);
    if (prepared.decision.action !== 'ACQUIRED') return prepared.decision;
    try {
      const result = await writeRemoteRegistry(prepared.registry, current.sha, `A: claim ${prepared.decision.claim.claim_key}`, options.coordRepo, options.branch);
      return { ...prepared.decision, commit_sha:result.commit?.sha ?? null };
    } catch (error) {
      const text = String(error?.stderr || error?.message || error);
      if (attempt + 1 < attempts && /(409|422|sha|does not match|conflict)/i.test(text)) continue;
      throw error;
    }
  }
  throw new Error('CLAIM_CONFLICT_RETRY_EXHAUSTED');
}

export async function renewRemote(claimId, owner, options = {}) {
  const attempts = options.attempts ?? 2;
  for (let attempt=0; attempt<attempts; attempt++) {
    const current = await readRemoteRegistry(options.coordRepo, options.branch);
    const prepared = renewClaim(current.registry, claimId, owner, options);
    try {
      const result = await writeRemoteRegistry(prepared.registry, current.sha, `A: heartbeat ${claimId}`, options.coordRepo, options.branch);
      return { action:prepared.action, claim:prepared.claim, commit_sha:result.commit?.sha ?? null };
    } catch (error) {
      const text = String(error?.stderr || error?.message || error);
      if (attempt + 1 < attempts && /(409|422|sha|does not match|conflict)/i.test(text)) continue;
      throw error;
    }
  }
  throw new Error('CLAIM_CONFLICT_RETRY_EXHAUSTED');
}

export async function finishRemote(claimId, state, options = {}) {
  const attempts = options.attempts ?? 2;
  for (let attempt=0; attempt<attempts; attempt++) {
    const current = await readRemoteRegistry(options.coordRepo, options.branch);
    const prepared = transitionClaim(current.registry, claimId, state, options);
    try {
      const result = await writeRemoteRegistry(prepared.registry, current.sha, `A: ${state.toLowerCase()} ${claimId}`, options.coordRepo, options.branch);
      return { action:state, claim:prepared.claim, commit_sha:result.commit?.sha ?? null };
    } catch (error) {
      const text = String(error?.stderr || error?.message || error);
      if (attempt + 1 < attempts && /(409|422|sha|does not match|conflict)/i.test(text)) continue;
      throw error;
    }
  }
  throw new Error('CLAIM_CONFLICT_RETRY_EXHAUSTED');
}

if (process.argv[1]?.endsWith('a-session-claim.mjs')) {
  const args = process.argv.slice(2);
  const command = args[0];
  try {
    if (command === 'claim' || command === 'status') {
      const request = {
        repository:argValue(args,'--repository'),
        revision:argValue(args,'--revision'),
        scope:argValue(args,'--scope'),
        owner:resolveASessionOwner(argValue(args,'--owner'))
      };
      if (!request.repository || !request.revision || !request.scope) throw new Error('CLAIM_ARGUMENT_REQUIRED');
      if (command === 'status') {
        const current = await readRemoteRegistry(argValue(args,'--coord-repo') || undefined, argValue(args,'--branch') || undefined);
        console.log(JSON.stringify(evaluateClaim(current.registry, request, new Date()), null, 2));
      } else {
        const result = await claimRemote(request, {
          leaseMinutes:Number(argValue(args,'--lease-minutes') || 60),
          coordRepo:argValue(args,'--coord-repo') || undefined,
          branch:argValue(args,'--branch') || undefined
        });
        console.log(JSON.stringify(result, null, 2));
        if (result.action.startsWith('SKIP_')) process.exitCode = 3;
      }
    } else if (command === 'renew') {
      const claimId = argValue(args,'--claim-id');
      const owner = resolveASessionOwner(argValue(args,'--owner'));
      if (!claimId) throw new Error('CLAIM_ID_REQUIRED');
      const result = await renewRemote(claimId, owner, {
        leaseMinutes:Number(argValue(args,'--lease-minutes') || 60),
        coordRepo:argValue(args,'--coord-repo') || undefined,
        branch:argValue(args,'--branch') || undefined
      });
      console.log(JSON.stringify(result, null, 2));
    } else if (command === 'complete' || command === 'abandon' || command === 'supersede') {
      const claimId = argValue(args,'--claim-id');
      if (!claimId) throw new Error('CLAIM_ID_REQUIRED');
      const state = command === 'complete' ? 'COMPLETED' : command === 'abandon' ? 'ABANDONED' : 'SUPERSEDED';
      const owner = resolveASessionOwner(argValue(args,'--owner'));
      const result = await finishRemote(claimId, state, {
        owner,
        evidenceRefs:argValues(args,'--evidence'),
        coordRepo:argValue(args,'--coord-repo') || undefined,
        branch:argValue(args,'--branch') || undefined
      });
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('Usage: node scripts/a-session-claim.mjs claim|status --repository owner/repo --revision <sha> --scope <scope> --owner <A-session-id> [--lease-minutes 60]');
      console.error('       node scripts/a-session-claim.mjs renew --claim-id <id> --owner <id> [--lease-minutes 60]');
      console.error('       node scripts/a-session-claim.mjs complete|abandon|supersede --claim-id <id> --owner <id> [--evidence <ref> ...]');
      process.exit(2);
    }
  } catch (error) {
    console.error(`A claim error: ${error.message}`);
    process.exit(1);
  }
}
