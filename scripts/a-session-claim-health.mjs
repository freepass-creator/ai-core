import { readRemoteRegistry, writeRemoteRegistry } from './a-session-claim.mjs';

export function claimHealth(registry, now = new Date()) {
  const nowMs = now.getTime();
  const summary = { live:[], expired_active:[], completed:[], abandoned:[], superseded:[], anomalies:[] };
  const liveByKey = new Map();
  const liveByOwner = new Map();
  for (const claim of registry.claims || []) {
    if (claim.state === 'ACTIVE') {
      if (Date.parse(claim.lease_until) > nowMs) {
        summary.live.push(claim);
        const prior = liveByKey.get(claim.claim_key);
        if (prior) summary.anomalies.push({ code:'MULTIPLE_LIVE_CLAIMS', claim_key:claim.claim_key, claim_ids:[prior.claim_id,claim.claim_id] });
        else liveByKey.set(claim.claim_key, claim);
        const ownerPrior = liveByOwner.get(claim.owner_session);
        if (ownerPrior) summary.anomalies.push({ code:'MULTIPLE_LIVE_CLAIMS_FOR_OWNER', owner_session:claim.owner_session, claim_ids:[ownerPrior.claim_id,claim.claim_id] });
        else liveByOwner.set(claim.owner_session, claim);
      } else {
        summary.expired_active.push(claim);
      }
    } else if (claim.state === 'COMPLETED') summary.completed.push(claim);
    else if (claim.state === 'ABANDONED') summary.abandoned.push(claim);
    else if (claim.state === 'SUPERSEDED') summary.superseded.push(claim);
  }
  return {
    status:summary.anomalies.length ? 'ATTENTION' : 'OK',
    as_of:now.toISOString(),
    counts:{
      live:summary.live.length,
      expired_active:summary.expired_active.length,
      completed:summary.completed.length,
      abandoned:summary.abandoned.length,
      superseded:summary.superseded.length,
      anomalies:summary.anomalies.length
    },
    ...summary
  };
}

export function reapExpiredClaims(registry, now = new Date()) {
  const next = structuredClone(registry);
  const expired = [];
  for (const claim of next.claims || []) {
    if (claim.state !== 'ACTIVE') continue;
    if (Date.parse(claim.lease_until) > now.getTime()) continue;
    claim.state = 'ABANDONED';
    claim.completed_at = now.toISOString();
    claim.abandon_reason = 'LEASE_EXPIRED';
    expired.push(claim.claim_id);
  }
  if (expired.length) next.observed_at = now.toISOString();
  return { registry:next, reaped_claim_ids:expired };
}

export async function reapRemote(options = {}) {
  const attempts = options.attempts ?? 2;
  for (let attempt=0; attempt<attempts; attempt++) {
    const current = await readRemoteRegistry(options.coordRepo, options.branch);
    const prepared = reapExpiredClaims(current.registry, options.now ?? new Date());
    if (!prepared.reaped_claim_ids.length) {
      return { action:'NOOP', reaped_claim_ids:[], health:claimHealth(current.registry, options.now ?? new Date()) };
    }
    try {
      const result = await writeRemoteRegistry(
        prepared.registry, current.sha,
        `A: reap ${prepared.reaped_claim_ids.length} expired claims`,
        options.coordRepo, options.branch
      );
      return {
        action:'REAPED',
        reaped_claim_ids:prepared.reaped_claim_ids,
        commit_sha:result.commit?.sha ?? null,
        health:claimHealth(prepared.registry, options.now ?? new Date())
      };
    } catch (error) {
      const text = String(error?.stderr || error?.message || error);
      if (attempt + 1 < attempts && /(409|422|sha|does not match|conflict)/i.test(text)) continue;
      throw error;
    }
  }
  throw new Error('CLAIM_REAPER_CONFLICT_RETRY_EXHAUSTED');
}

function value(args, name) { const i=args.indexOf(name); return i < 0 ? null : (args[i+1] ?? null); }

if (process.argv[1]?.endsWith('a-session-claim-health.mjs')) {
  const args=process.argv.slice(2);
  const command=args[0] || 'health';
  const coordRepo=value(args,'--coord-repo') || undefined;
  const branch=value(args,'--branch') || undefined;
  try {
    if (command === 'health') {
      const current=await readRemoteRegistry(coordRepo,branch);
      const result=claimHealth(current.registry,new Date());
      console.log(JSON.stringify(result,null,2));
      if (result.counts.expired_active || result.counts.anomalies) process.exitCode=2;
    } else if (command === 'reap') {
      const result=await reapRemote({coordRepo,branch});
      console.log(JSON.stringify(result,null,2));
    } else {
      console.error('Usage: node scripts/a-session-claim-health.mjs health|reap [--coord-repo owner/repo] [--branch main]');
      process.exit(2);
    }
  } catch (error) {
    console.error(`A claim health error: ${error.message}`);
    process.exit(1);
  }
}
