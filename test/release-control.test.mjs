import assert from 'node:assert/strict';
import test from 'node:test';
import { deployDecisionFromObservation, githubDeploymentContext, governanceProof, initialDecision, observe, statusRecord } from '../src/release/release-control.mjs';

const sha = 'a'.repeat(40);
const project = (overrides = {}) => ({
  project_id: 'demo', repository: 'owner/demo', default_branch: 'main', platform: 'CUSTOM',
  production: { enabled: true, required_env: ['TOKEN'], revision_probe: { url: 'https://example.test/version', format: 'JSON', field: 'git.sha' }, smoke_urls: ['https://example.test/health'], max_run_attempt: 2 },
  rollback: { available: true, plan_ref: 'docs/ROLLBACK.md' }, ...overrides
});

test('unconfigured deployments are explicit HOLD', () => {
  const value = project({ platform: 'NONE', production: { enabled: false, required_env: [], revision_probe: null, smoke_urls: [], max_run_attempt: 2 }, rollback: { available: false, plan_ref: null } });
  assert.deepEqual(initialDecision(value, { expectedRevision: sha, repository: 'owner/demo', ref: 'refs/heads/main', env: {} }), { result: 'HOLD', code: 'HOLD_DEPLOY_TARGET_UNCONFIGURED' });
});

test('preflight fails closed for branch, secrets, rollback, and retry drift', () => {
  assert.equal(initialDecision(project(), { expectedRevision: sha, repository: 'owner/demo', ref: 'refs/heads/topic', env: { TOKEN: 'x' } }).code, 'HOLD_DEFAULT_BRANCH_REQUIRED');
  assert.deepEqual(initialDecision(project(), { expectedRevision: sha, repository: 'owner/demo', ref: 'refs/heads/main', env: {} }).missing_env, ['TOKEN']);
  assert.equal(initialDecision(project({ rollback: { available: false, plan_ref: null } }), { expectedRevision: sha, repository: 'owner/demo', ref: 'refs/heads/main', env: { TOKEN: 'x' } }).code, 'HOLD_ROLLBACK_UNCONFIGURED');
  assert.equal(initialDecision(project(), { expectedRevision: sha, repository: 'owner/demo', ref: 'refs/heads/main', runAttempt: 3, env: { TOKEN: 'x' } }).code, 'HOLD_RETRY_LIMIT');
});

test('exact live revision plus smoke is VERIFIED and prevents duplicate deploy', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    return url.endsWith('/version')
      ? { ok: true, status: 200, json: async () => ({ git: { sha } }) }
      : { ok: true, status: 204 };
  };
  const result = await observe(project(), sha, fakeFetch);
  assert.equal(result.result, 'VERIFIED');
  assert.equal(result.observed_revision, sha);
  assert.equal(calls.length, 2);
});

test('revision mismatch and smoke failure remain HOLD', async () => {
  const mismatch = await observe(project(), sha, async () => ({ ok: true, status: 200, json: async () => ({ git: { sha: 'b'.repeat(40) } }) }));
  assert.equal(mismatch.code, 'HOLD_PRODUCTION_REVISION_MISMATCH');
  const smoke = await observe(project(), sha, async (url) => url.endsWith('/version')
    ? { ok: true, status: 200, json: async () => ({ git: { sha } }) }
    : { ok: false, status: 503 });
  assert.equal(smoke.code, 'HOLD_RUNTIME_SMOKE_FAILED');
  assert.deepEqual(deployDecisionFromObservation(smoke), { result: 'HOLD', code: 'HOLD_RUNTIME_SMOKE_FAILED', deploy: false });
  assert.deepEqual(deployDecisionFromObservation(mismatch), { result: 'READY', code: 'READY_REVISION_DRIFT_CONFIRMED', deploy: true });
});

test('unknown production observation never authorizes a deploy', () => {
  assert.deepEqual(deployDecisionFromObservation({ result: 'HOLD', code: 'HOLD_PRODUCTION_OBSERVATION_FAILED', observed_revision: null }), { result: 'HOLD', code: 'HOLD_PRODUCTION_OBSERVATION_FAILED', deploy: false });
  assert.deepEqual(deployDecisionFromObservation({ result: 'HOLD', code: 'HOLD_REVISION_HTTP_503', observed_revision: null }), { result: 'HOLD', code: 'HOLD_REVISION_HTTP_503', deploy: false });
});

test('production deployment requires a complete push context bound to the same SHA', () => {
  const valid = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push', GITHUB_REPOSITORY: 'owner/demo', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sha, GITHUB_RUN_ID: '1', GITHUB_RUN_ATTEMPT: '1' };
  assert.equal(githubDeploymentContext(valid, sha).ok, true);
  assert.equal(githubDeploymentContext({ ...valid, GITHUB_SHA: 'b'.repeat(40) }, sha).code, 'HOLD_GITHUB_SHA_MISMATCH');
  assert.equal(githubDeploymentContext({ ...valid, GITHUB_EVENT_NAME: 'workflow_dispatch' }, sha).code, 'HOLD_GITHUB_PUSH_CONTEXT_REQUIRED');
  const incomplete = { ...valid };
  delete incomplete.GITHUB_REF;
  assert.deepEqual(githubDeploymentContext(incomplete, sha).missing, ['GITHUB_REF']);
});

test('status records never include secret values', () => {
  const record = statusRecord({ project: project(), expectedRevision: sha, decision: { result: 'HOLD', code: 'HOLD_REQUIRED_ENV_MISSING', missing_env: ['TOKEN'] }, phase: 'PRODUCTION', run: { id: '1' } });
  assert.equal(JSON.stringify(record).includes('super-secret'), false);
  assert.deepEqual(record.limitations, ['Missing environment names: TOKEN']);
});

test('operational status also produces the canonical governance proof shape', () => {
  const proof = governanceProof({ project: project(), expectedRevision: sha, decision: { result: 'VERIFIED', code: 'DEPLOYED_AND_VERIFIED' }, observation: { observed_revision: sha, smoke: [{ url: 'https://example.test/health', status: 204, ok: true }] }, run: { id: '1', url: 'https://github.test/run/1' } });
  assert.equal(proof.schema_version, 'governance-release-proof/v1');
  assert.equal(proof.production_observation.observed_revision, sha);
  assert.equal(proof.result, 'VERIFIED');
});
