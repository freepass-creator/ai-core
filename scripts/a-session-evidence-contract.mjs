import { createHash } from 'node:crypto';

const SHA40 = /^[0-9a-f]{40}$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function splitRepoSha(value) {
  const at = value.lastIndexOf('@');
  if (at <= 0) return null;
  const repository = value.slice(0, at);
  const sha = value.slice(at + 1);
  if (!REPO.test(repository) || !SHA40.test(sha)) return null;
  return { repository, sha };
}

export function parseACompletionEvidenceRef(ref) {
  if (typeof ref !== 'string' || !ref.trim()) return { valid:false, kind:null };
  if (ref.startsWith('subject:')) {
    const parsed = splitRepoSha(ref.slice('subject:'.length));
    return parsed ? { valid:true, kind:'subject', ...parsed, canonical:ref } : { valid:false, kind:'subject' };
  }
  if (ref.startsWith('commit:')) {
    const parsed = splitRepoSha(ref.slice('commit:'.length));
    return parsed ? { valid:true, kind:'commit', ...parsed, canonical:ref } : { valid:false, kind:'commit' };
  }
  if (ref.startsWith('ci:')) {
    const body = ref.slice('ci:'.length);
    const at = body.lastIndexOf('@');
    const hash = body.lastIndexOf('#', at);
    if (hash <= 0 || at <= hash + 1) return { valid:false, kind:'ci' };
    const repository = body.slice(0, hash);
    const runId = body.slice(hash + 1, at);
    const sha = body.slice(at + 1);
    if (!REPO.test(repository) || !/^\d+$/.test(runId) || !SHA40.test(sha)) return { valid:false, kind:'ci' };
    return { valid:true, kind:'ci', repository, run_id:Number(runId), sha, canonical:ref };
  }
  return { valid:false, kind:'unknown' };
}

export function validateACompletionEvidence(claim, refs, { requiresHeadGuard = false } = {}) {
  const errors = [];
  if (claim?.evidence_contract !== 'v2') return { status:'LEGACY', errors, parsed:[] };
  if (!Array.isArray(refs) || refs.length === 0) return { status:'INVALID', errors:['EVIDENCE_REQUIRED'], parsed:[] };
  const parsed = refs.map(parseACompletionEvidenceRef);
  parsed.forEach((item, i) => { if (!item.valid) errors.push(`EVIDENCE_REF_INVALID:${i}`); });
  const valid = parsed.filter(x => x.valid);
  const proof = valid.filter(x => x.kind === 'commit' || x.kind === 'ci');
  if (!proof.length) errors.push('VERIFIABLE_PROOF_REQUIRED');
  if (requiresHeadGuard) {
    const expected = `subject:${claim.repository}@${claim.subject_revision}`;
    if (!valid.some(x => x.kind === 'subject' && x.canonical === expected)) errors.push('SUBJECT_EVIDENCE_REQUIRED');
  }
  const duplicate = new Set();
  for (const item of valid) {
    if (duplicate.has(item.canonical)) errors.push('EVIDENCE_REF_DUPLICATE');
    duplicate.add(item.canonical);
  }
  return { status:errors.length ? 'INVALID' : 'VALID', errors, parsed:valid };
}

export async function verifyACompletionEvidenceRemote(parsed, adapters) {
  const failures = [];
  for (const item of parsed) {
    if (item.kind === 'subject' || item.kind === 'commit') {
      const ok = await adapters.commitExists(item.repository, item.sha);
      if (!ok) failures.push({ code:'COMMIT_NOT_FOUND', ref:item.canonical });
    } else if (item.kind === 'ci') {
      const run = await adapters.workflowRun(item.repository, item.run_id);
      if (!run) failures.push({ code:'CI_RUN_NOT_FOUND', ref:item.canonical });
      else {
        if (run.head_sha !== item.sha) failures.push({ code:'CI_HEAD_SHA_MISMATCH', ref:item.canonical });
        if (run.conclusion !== 'success') failures.push({ code:'CI_NOT_SUCCESSFUL', ref:item.canonical });
      }
    }
  }
  return { status:failures.length ? 'INVALID' : 'VALID', failures };
}


export function evidenceRefsDigest(refs) {
  const normalized = [...(refs || [])];
  return 'sha256:' + createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
