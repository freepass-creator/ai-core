import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReleaseAutomation, releaseAttemptKey } from '../src/governance/release-automation.mjs';

const revision = 'a'.repeat(40);
const manifest = {
  schema_version: 'release-automation-manifest/v1',
  repository: 'freepass-creator/ai-core', canonical_branch: 'main',
  preview: { enabled: false, provider: 'UNCONFIGURED', environment: 'preview' },
  production: { enabled: false, provider: 'UNCONFIGURED', environment: 'production' },
  revision_readback: { mode: 'NONE' }, live_verification: { mode: 'NONE' }
};

test('pull request is admitted to CI without pretending preview exists', () => {
  const out = evaluateReleaseAutomation(manifest, {
    event: 'pull_request', ref: 'refs/pull/1/merge', revision, repository: manifest.repository
  });
  assert.equal(out.status, 'READY_FOR_CI');
  assert.equal(out.deploy_authorized, false);
  assert.deepEqual(out.failures, ['PREVIEW_PROVIDER_UNCONFIGURED']);
});

test('canonical push without a provider is explicit HOLD', () => {
  const out = evaluateReleaseAutomation(manifest, {
    event: 'push', ref: 'refs/heads/main', revision, repository: manifest.repository
  });
  assert.equal(out.status, 'HOLD');
  assert.deepEqual(out.failures, ['PRODUCTION_PROVIDER_UNCONFIGURED']);
});

test('non-canonical push cannot release', () => {
  const out = evaluateReleaseAutomation(manifest, {
    event: 'push', ref: 'refs/heads/feature', revision, repository: manifest.repository
  });
  assert.equal(out.status, 'HOLD');
  assert.ok(out.failures.includes('EVENT_NOT_RELEASE_ELIGIBLE'));
});

test('configured provider still requires exact revision readback and live verification', () => {
  const configured = {
    ...manifest,
    production: { enabled: true, provider: 'VERCEL', environment: 'production' }
  };
  const out = evaluateReleaseAutomation(configured, {
    event: 'push', ref: 'refs/heads/main', revision, repository: manifest.repository
  });
  assert.equal(out.status, 'HOLD');
  assert.deepEqual(out.failures, ['REVISION_READBACK_UNCONFIGURED', 'LIVE_VERIFICATION_UNCONFIGURED']);
});

test('configured provider holds when declared secrets were not injected', () => {
  const configured = {
    ...manifest,
    production: {
      enabled: true, provider: 'VERCEL', environment: 'production',
      required_secret_names: ['VERCEL_TOKEN']
    },
    revision_readback: { mode: 'HTTP_JSON' }, live_verification: { mode: 'HTTP' }
  };
  const out = evaluateReleaseAutomation(configured, {
    event: 'push', ref: 'refs/heads/main', revision, repository: manifest.repository,
    available_secret_names: []
  });
  assert.equal(out.status, 'HOLD');
  assert.deepEqual(out.failures, ['REQUIRED_SECRETS_UNAVAILABLE']);
});

test('rerun beyond the manifest attempt limit is HOLD', () => {
  const withPolicy = { ...manifest, retry_policy: { max_attempts_per_revision: 1 } };
  const out = evaluateReleaseAutomation(withPolicy, {
    event: 'push', ref: 'refs/heads/main', revision, repository: manifest.repository, attempt: 2
  });
  assert.equal(out.status, 'HOLD');
  assert.ok(out.failures.includes('RETRY_LIMIT_EXCEEDED'));
});

test('attempt key is deterministic and revision-specific', () => {
  const first = releaseAttemptKey({ repository: manifest.repository, environment: 'production', revision });
  const second = releaseAttemptKey({ repository: manifest.repository, environment: 'production', revision });
  const changed = releaseAttemptKey({ repository: manifest.repository, environment: 'production', revision: 'b'.repeat(40) });
  assert.equal(first, second);
  assert.notEqual(first, changed);
});
