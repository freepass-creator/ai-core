import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProjectAuditRefreshQueue } from '../src/engine/project-audit-refresh-queue.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

test('registry revision drift places an audit into the re-audit queue', async () => {
  const [readinessRegistry, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);

  const projectRegistry = {
    observed_at: '2026-09-20T11:30:00Z',
    projects: [{
      project_id: result.project_id,
      repository: result.repository,
      default_branch: result.source_proof.default_branch,
      head_revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      repository_lifecycle_status: 'ACTIVE',
      execution_readiness_status: 'HOLD',
    }],
  };

  const queue = buildProjectAuditRefreshQueue({
    readinessRegistry,
    projectRegistry,
    auditResults: [result],
  });

  assert.equal(queue.totals.audits, 1);
  assert.equal(queue.totals.registry_drift, 1);
  assert.equal(queue.totals.re_audit_candidates, 1);
  assert.equal(queue.items[0].registry_status, 'REGISTRY_DRIFT');
  assert.equal(queue.items[0].re_audit_candidate, true);
  assert.equal(queue.items[0].live_check_required, true);
  assert.ok(queue.items[0].reasons.includes('REGISTRY_REVISION_MOVED'));
});

test('registry match still requires live freshness inspection', async () => {
  const [readinessRegistry, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);

  const projectRegistry = {
    projects: [{
      project_id: result.project_id,
      repository: result.repository,
      default_branch: result.source_proof.default_branch,
      head_revision: result.subject_revision,
      repository_lifecycle_status: 'ACTIVE',
      execution_readiness_status: 'ACTIVE',
    }],
  };

  const queue = buildProjectAuditRefreshQueue({
    readinessRegistry,
    projectRegistry,
    auditResults: [result],
  });

  assert.equal(queue.items[0].registry_status, 'REGISTRY_MATCH');
  assert.equal(queue.items[0].re_audit_candidate, false);
  assert.equal(queue.items[0].live_check_required, true);
});

test('identity mismatch is HOLD and ranks ahead of ordinary drift', async () => {
  const [readinessRegistry, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);

  const projectRegistry = {
    projects: [{
      project_id: result.project_id,
      repository: 'freepass-creator/renamed-project',
      default_branch: result.source_proof.default_branch,
      head_revision: result.subject_revision,
      repository_lifecycle_status: 'ACTIVE',
      execution_readiness_status: 'ACTIVE',
    }],
  };

  const queue = buildProjectAuditRefreshQueue({
    readinessRegistry,
    projectRegistry,
    auditResults: [result],
  });

  assert.equal(queue.items[0].registry_status, 'HOLD');
  assert.equal(queue.items[0].priority, 0);
  assert.ok(queue.items[0].reasons.includes('REPOSITORY_IDENTITY_MISMATCH'));
});
