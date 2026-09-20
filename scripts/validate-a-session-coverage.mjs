import { readFile } from 'node:fs/promises';

const SHA40 = /^[0-9a-f]{40}$/;
const REPO = /^[^/\\s]+\\/[^/\\s]+$/;
const VALID_STATES = new Set([
  'CORE_BASELINE',
  'DEEP_EVIDENCE',
  'SAMPLED_NO_PROMOTION',
  'LINEAGE_OVERLAP',
  'MINIMAL_NO_TECH_ASSET',
]);

function push(errors, code, path, detail) {
  errors.push({ code, path, ...(detail ? { detail } : {}) });
}

export function validateASessionCoverage(registry, headSnapshot = null) {
  const errors = [];
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    return { status: 'INVALID', errors: [{ code: 'REGISTRY_NOT_OBJECT', path: '$' }] };
  }
  if (registry.schema !== 'ai-core-a-session-repo-coverage/v1') {
    push(errors, 'SCHEMA_ID_INVALID', '/schema');
  }
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(registry.observed_on ?? '')) {
    push(errors, 'OBSERVED_ON_INVALID', '/observed_on');
  }
  if (!Array.isArray(registry.repositories)) {
    push(errors, 'REPOSITORIES_NOT_ARRAY', '/repositories');
    return { status: 'INVALID', errors };
  }
  if (registry.repository_count !== registry.repositories.length) {
    push(errors, 'REPOSITORY_COUNT_MISMATCH', '/repository_count', `${registry.repository_count} != ${registry.repositories.length}`);
  }

  const seenRepos = new Set();
  let coreCount = 0;
  for (const [index, entry] of registry.repositories.entries()) {
    const path = `/repositories/${index}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      push(errors, 'REPOSITORY_ENTRY_INVALID', path);
      continue;
    }
    if (!REPO.test(entry.repository ?? '')) {
      push(errors, 'REPOSITORY_NAME_INVALID', `${path}/repository`);
    } else {
      const key = entry.repository.toLowerCase();
      if (seenRepos.has(key)) push(errors, 'REPOSITORY_DUPLICATE', `${path}/repository`);
      seenRepos.add(key);
    }
    if (typeof entry.default_branch !== 'string' || !entry.default_branch.trim()) {
      push(errors, 'DEFAULT_BRANCH_INVALID', `${path}/default_branch`);
    }
    if (!VALID_STATES.has(entry.audit_state)) {
      push(errors, 'AUDIT_STATE_INVALID', `${path}/audit_state`);
    }
    if (!Array.isArray(entry.findings)) {
      push(errors, 'FINDINGS_NOT_ARRAY', `${path}/findings`);
    } else {
      const seenFindings = new Set();
      for (const [findingIndex, finding] of entry.findings.entries()) {
        const fPath = `${path}/findings/${findingIndex}`;
        if (typeof finding !== 'string' || !finding.trim()) {
          push(errors, 'FINDING_INVALID', fPath);
          continue;
        }
        if (seenFindings.has(finding)) push(errors, 'FINDING_DUPLICATE', fPath);
        seenFindings.add(finding);
        if ((finding.startsWith('BACKPORT:') || finding.startsWith('Different:')) && entry.audit_state !== 'DEEP_EVIDENCE') {
          push(errors, 'MATERIAL_FINDING_REQUIRES_DEEP_EVIDENCE', fPath);
        }
      }
    }

    if (entry.audit_state === 'CORE_BASELINE') {
      coreCount += 1;
      if (entry.repository !== 'freepass-creator/ai-core') {
        push(errors, 'CORE_BASELINE_REPOSITORY_INVALID', `${path}/repository`);
      }
      if (entry.observed_head !== null) {
        push(errors, 'CORE_BASELINE_HEAD_MUST_BE_NULL', `${path}/observed_head`);
      }
      if (entry.independence !== 'SELF') {
        push(errors, 'CORE_BASELINE_INDEPENDENCE_INVALID', `${path}/independence`);
      }
    } else if (!SHA40.test(entry.observed_head ?? '')) {
      push(errors, 'OBSERVED_HEAD_INVALID', `${path}/observed_head`);
    }
  }
  if (coreCount !== 1) push(errors, 'CORE_BASELINE_COUNT_INVALID', '/repositories', `expected 1, got ${coreCount}`);

  if (headSnapshot !== null) {
    if (!headSnapshot || typeof headSnapshot !== 'object' || Array.isArray(headSnapshot)) {
      push(errors, 'HEAD_SNAPSHOT_NOT_OBJECT', '$snapshot');
    } else if (headSnapshot.schema !== 'ai-core-a-session-head-snapshot/v1') {
      push(errors, 'HEAD_SNAPSHOT_SCHEMA_INVALID', '$snapshot/schema');
    } else if (!Array.isArray(headSnapshot.repositories)) {
      push(errors, 'HEAD_SNAPSHOT_REPOSITORIES_NOT_ARRAY', '$snapshot/repositories');
    } else {
      const snapshotMap = new Map();
      for (const [index, item] of headSnapshot.repositories.entries()) {
        const sPath = `$snapshot/repositories/${index}`;
        if (!REPO.test(item?.repository ?? '')) {
          push(errors, 'HEAD_SNAPSHOT_REPOSITORY_INVALID', `${sPath}/repository`);
          continue;
        }
        if (!SHA40.test(item.head ?? '')) push(errors, 'HEAD_SNAPSHOT_SHA_INVALID', `${sPath}/head`);
        if (snapshotMap.has(item.repository)) push(errors, 'HEAD_SNAPSHOT_DUPLICATE', `${sPath}/repository`);
        snapshotMap.set(item.repository, item.head);
      }
      for (const [index, entry] of registry.repositories.entries()) {
        if (entry.audit_state === 'CORE_BASELINE') continue;
        const current = snapshotMap.get(entry.repository);
        if (!current) {
          push(errors, 'HEAD_SNAPSHOT_MISSING_REPOSITORY', `/repositories/${index}/repository`);
        } else if (current !== entry.observed_head) {
          push(errors, 'STALE_OBSERVED_HEAD', `/repositories/${index}/observed_head`, `${entry.observed_head} -> ${current}`);
        }
      }
      for (const repo of snapshotMap.keys()) {
        if (repo === 'freepass-creator/ai-core') continue;
        if (!seenRepos.has(repo.toLowerCase())) push(errors, 'HEAD_SNAPSHOT_UNKNOWN_REPOSITORY', '$snapshot/repositories', repo);
      }
    }
  }

  return { status: errors.length ? 'INVALID' : 'VALID', errors };
}

if (process.argv[1]?.endsWith('validate-a-session-coverage.mjs')) {
  if (!process.argv[2]) {
    console.error('Usage: node scripts/validate-a-session-coverage.mjs <coverage.json> [head-snapshot.json]');
    process.exit(2);
  }
  const registry = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const snapshot = process.argv[3] ? JSON.parse(await readFile(process.argv[3], 'utf8')) : null;
  const result = validateASessionCoverage(registry, snapshot);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'VALID') process.exitCode = 1;
}
