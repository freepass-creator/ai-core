import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProjectAuditRefreshQueue } from '../src/engine/project-audit-refresh-queue.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

function asV2(result, readinessRegistry, overrides = {}) {
  return {
    ...structuredClone(result),
    schema: 'ai-core-project-audit-result/v2',
    standard_baseline_revision: readinessRegistry.baseline_revision,
    audited_at: '2026-09-20T11:00:00.000Z',
    ...overrides,
  };
}

test('registry revision drift places an audit into the re-audit queue', async () => {
  const [readinessRegistry, legacy] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  const result = asV2(legacy, readinessRegistry);

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

  assert.equal(queue.totals.audit_records, 1);
  assert.equal(queue.totals.active_audits, 1);
  assert.equal(queue.totals.superseded_history, 0);
  assert.equal(queue.totals.registry_drift, 1);
  assert.equal(queue.totals.re_audit_candidates, 1);
  assert.equal(queue.items[0].registry_status, 'REGISTRY_DRIFT');
  assert.equal(queue.items[0].standard_baseline.status, 'CURRENT');
  assert.equal(queue.items[0].re_audit_candidate, true);
  assert.ok(queue.items[0].reasons.includes('REGISTRY_REVISION_MOVED'));
});

test('registry and standard baseline match still require live freshness inspection', async () => {
  const [readinessRegistry, legacy] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  const result = asV2(legacy, readinessRegistry);

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
  assert.equal(queue.items[0].standard_baseline.status, 'CURRENT');
  assert.equal(queue.items[0].re_audit_candidate, false);
  assert.equal(queue.items[0].live_check_required, true);
});

test('legacy v1 audit is a re-audit candidate even when registry revision matches', async () => {
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
  assert.equal(queue.items[0].standard_baseline.status, 'UNKNOWN_LEGACY');
  assert.equal(queue.items[0].re_audit_candidate, true);
  assert.ok(queue.items[0].reasons.includes('STANDARD_BASELINE_UNBOUND_LEGACY'));
});

test('v2 supersedes legacy v1 history for the same project', async () => {
  const [readinessRegistry, projectRegistry, legacy, currentV2] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../registry/projects.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
    readJson('../docs/audits/freepass-admin-v2-2026-09-20.json'),
  ]);

  const queue = buildProjectAuditRefreshQueue({
    readinessRegistry,
    projectRegistry,
    auditResults: [legacy, currentV2],
  });

  const admin = queue.items.find(item => item.project_id === 'freepass-admin');
  assert.ok(admin);
  assert.equal(admin.audit_result_schema, 'ai-core-project-audit-result/v2');
  assert.equal(admin.audited_revision, '2747ef32e96c550d7dea05c58ee012880cb42dd3');
  assert.equal(admin.registry_status, 'REGISTRY_MATCH');
  assert.equal(admin.standard_baseline.status, 'CURRENT');
  assert.equal(admin.re_audit_candidate, false);
  assert.equal(queue.totals.audit_records, 2);
  assert.equal(queue.totals.active_audits, 1);
  assert.equal(queue.totals.superseded_history, 1);
  assert.equal(queue.superseded_history[0].audit_result_schema, 'ai-core-project-audit-result/v1');
});

test('moved standard baseline queues re-audit even if project revision matches', async () => {
  const [readinessRegistry, legacy] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  const result = asV2(legacy, readinessRegistry, {
    standard_baseline_revision: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  });

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
  assert.equal(queue.items[0].standard_baseline.status, 'STALE');
  assert.equal(queue.items[0].re_audit_candidate, true);
  assert.ok(queue.items[0].reasons.includes('STANDARD_BASELINE_MOVED'));
});

test('identity mismatch is HOLD and ranks ahead of ordinary drift', async () => {
  const [readinessRegistry, legacy] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  const result = asV2(legacy, readinessRegistry);

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
