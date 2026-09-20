import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { claimRemote, finishRemote } from './a-session-claim.mjs';

const run = promisify(execFile);
const DEFAULT_COORD_REPO = process.env.AI_CORE_COORDINATION_REPOSITORY || 'freepass-creator/ai-core';
const DEFAULT_BRANCH = process.env.AI_CORE_COORDINATION_BRANCH || 'main';
const COVERAGE_PATH = 'docs/research/a-session-repo-coverage.v1.json';

async function ghApi(args) {
  return (await run('gh', ['api', ...args], { encoding:'utf8', maxBuffer:32*1024*1024 })).stdout;
}

async function readRemoteJson(repo, path, branch) {
  const raw = JSON.parse(await ghApi([`repos/${repo}/contents/${path}`, '-X', 'GET', '-f', `ref=${branch}`]));
  return JSON.parse(Buffer.from(raw.content.replace(/\n/g,''), 'base64').toString('utf8'));
}

async function repoHead(repository, branch) {
  return (await ghApi([`repos/${repository}/commits/${encodeURIComponent(branch)}`, '--jq', '.sha'])).trim();
}

const priority = {
  DEEP_EVIDENCE:0,
  SAMPLED_NO_PROMOTION:1,
  LINEAGE_OVERLAP:2,
  MINIMAL_NO_TECH_ASSET:3,
  CORE_BASELINE:99
};

export function changedCandidates(coverage, currentHeads) {
  return (coverage.repositories || [])
    .filter(x => x.audit_state !== 'CORE_BASELINE')
    .filter(x => currentHeads[x.repository] && currentHeads[x.repository] !== x.observed_head)
    .map(x => ({
      repository:x.repository,
      default_branch:x.default_branch,
      audit_state:x.audit_state,
      previous_revision:x.observed_head,
      current_revision:currentHeads[x.repository],
      findings:[...(x.findings || [])]
    }))
    .sort((a,b) => (priority[a.audit_state] ?? 50) - (priority[b.audit_state] ?? 50) || a.repository.localeCompare(b.repository));
}

export async function allocateNext({
  owner, scope='repo-rescan', leaseMinutes=60, coordRepo=DEFAULT_COORD_REPO, branch=DEFAULT_BRANCH
} = {}) {
  if (!owner) throw new Error('OWNER_REQUIRED');
  const coverage = await readRemoteJson(coordRepo, COVERAGE_PATH, branch);
  const currentHeads = {};

  await Promise.all((coverage.repositories || []).filter(x => x.audit_state !== 'CORE_BASELINE').map(async entry => {
    try { currentHeads[entry.repository] = await repoHead(entry.repository, entry.default_branch); }
    catch (error) { currentHeads[entry.repository] = null; }
  }));

  const unknown = (coverage.repositories || []).filter(x => x.audit_state !== 'CORE_BASELINE' && !currentHeads[x.repository]).map(x => x.repository);
  const candidates = changedCandidates(coverage, currentHeads);

  for (const candidate of candidates) {
    const result = await claimRemote({
      repository:candidate.repository,
      revision:candidate.current_revision,
      scope,
      owner
    }, { leaseMinutes, coordRepo, branch });

    if (result.action === 'SKIP_DUPLICATE' || result.action === 'SKIP_ALREADY_COMPLETED') continue;
    if (result.action !== 'ACQUIRED') continue;

    const after = await repoHead(candidate.repository, candidate.default_branch);
    if (after !== candidate.current_revision) {
      await finishRemote(result.claim.claim_id, 'SUPERSEDED', { coordRepo, branch });
      currentHeads[candidate.repository] = after;
      const retry = await claimRemote({ repository:candidate.repository, revision:after, scope, owner }, { leaseMinutes, coordRepo, branch });
      if (retry.action === 'ACQUIRED') {
        return {
          status:'ASSIGNED',
          repository:candidate.repository,
          revision:after,
          previous_revision:candidate.previous_revision,
          audit_state:candidate.audit_state,
          claim:retry.claim,
          coordination_commit:retry.commit_sha ?? null,
          unknown_repositories:unknown
        };
      }
      continue;
    }

    return {
      status:'ASSIGNED',
      repository:candidate.repository,
      revision:candidate.current_revision,
      previous_revision:candidate.previous_revision,
      audit_state:candidate.audit_state,
      claim:result.claim,
      coordination_commit:result.commit_sha ?? null,
      unknown_repositories:unknown
    };
  }

  return {
    status:candidates.length ? 'NO_UNCLAIMED_CHANGED_REPOSITORY' : 'NO_CHANGED_REPOSITORY',
    changed_repository_count:candidates.length,
    unknown_repositories:unknown
  };
}

function value(args, name) { const i=args.indexOf(name); return i < 0 ? null : (args[i+1] ?? null); }

if (process.argv[1]?.endsWith('a-session-next.mjs')) {
  const args=process.argv.slice(2);
  try {
    const result=await allocateNext({
      owner:value(args,'--owner') || process.env.AI_CORE_ACTOR || 'A_SESSION',
      scope:value(args,'--scope') || 'repo-rescan',
      leaseMinutes:Number(value(args,'--lease-minutes') || 60),
      coordRepo:value(args,'--coord-repo') || DEFAULT_COORD_REPO,
      branch:value(args,'--branch') || DEFAULT_BRANCH
    });
    console.log(JSON.stringify(result,null,2));
    if (result.status === 'NO_UNCLAIMED_CHANGED_REPOSITORY') process.exitCode=3;
    if (result.unknown_repositories?.length) process.exitCode=Math.max(process.exitCode || 0,2);
  } catch (error) {
    console.error(`A allocator error: ${error.message}`);
    process.exit(1);
  }
}
