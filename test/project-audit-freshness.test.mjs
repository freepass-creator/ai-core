import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assessProjectAuditFreshness } from '../src/engine/project-audit-freshness.mjs';

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

function capsuleFor(result, revision = result.subject_revision, overrides = {}) {
  return {
    schema: 'ai-core-project-capsule/v1',
    project_id: result.project_id,
    repository: result.repository,
    default_branch: result.source_proof.default_branch,
    subject_revision: revision,
    observed_at: '2026-09-20T11:30:00.000Z',
    readiness: {
      status: 'READY_FOR_REGISTRY_REVIEW',
      blockers: [],
      review_required: true,
    },
    evidence_refs: [
      `GIT:${result.repository}@${revision}`,
    ],
    ...overrides,
  };
}

test('audit is CURRENT only when project revision and standard baseline both match', async () => {
  const [readinessRegistry, legacy] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  const result = asV2(legacy, readinessRegistry);

  const report = assessProjectAuditFreshness({
    result,
    readinessRegistry,
    capsule: capsuleFor(result),
    registryProject: {
      project_id: result.project_id,
      repository: result.repository,
      default_branch: result.source_proof.default_branch,
      head_revision: result.subject_revision,
    },
  });

  assert.equal(report.status, 'CURRENT');
  assert.equal(report.project_revision.moved, false);
  assert.equal(report.standard_baseline.status, 'CURRENT');
  assert.equal(report.re_audit_required, false);
  assert.equal(report.audit_usable_as_current, true);
});

test('moved project head makes a baseline-bound audit STALE', async () => {
  const [readinessRegistry, legacy] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  const result = asV2(legacy, readinessRegistry);
  const liveRevision = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  const report = assessProjectAuditFreshness({
    result,
    readinessRegistry,
    capsule: capsuleFor(result, liveRevision),
    registryProject: {
      project_id: result.project_id,
      repository: result.repository,
      default_branch: result.source_proof.default_branch,
      head_revision: liveRevision,
    },
  });

  assert.equal(report.status, 'STALE');
  assert.equal(report.project_revision.moved, true);
  assert.equal(report.standard_baseline.status, 'CURRENT');
  assert.ok(report.reasons.includes('SUBJECT_REVISION_MOVED'));
});

test('moved AI Core standard baseline makes an unchanged project audit STALE', async () => {
  const [readinessRegistry, legacy] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  const result = asV2(legacy, readinessRegistry, {
    standard_baseline_revision: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  });

  const report = assessProjectAuditFreshness({
    result,
    readinessRegistry,
    capsule: capsuleFor(result),
    registryProject: {
      project_id: result.project_id,
      repository: result.repository,
      default_branch: result.source_proof.default_branch,
      head_revision: result.subject_revision,
    },
  });

  assert.equal(report.status, 'STALE');
  assert.equal(report.project_revision.moved, false);
  assert.equal(report.standard_baseline.status, 'STALE');
  assert.ok(report.reasons.includes('STANDARD_BASELINE_MOVED'));
});

test('legacy v1 audit is STALE because its standard baseline is unbound', async () => {
  const [readinessRegistry, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);

  const report = assessProjectAuditFreshness({
    result,
    readinessRegistry,
    capsule: capsuleFor(result),
    registryProject: {
      project_id: result.project_id,
      repository: result.repository,
      default_branch: result.source_proof.default_branch,
      head_revision: result.subject_revision,
    },
  });

  assert.equal(report.status, 'STALE');
  assert.equal(report.standard_baseline.status, 'UNKNOWN_LEGACY');
  assert.ok(report.reasons.includes('STANDARD_BASELINE_UNBOUND_LEGACY'));
});

test('live revision wins when the project registry observation lags', async () => {
  const [readinessRegistry, legacy] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  const result = asV2(legacy, readinessRegistry);

  const report = assessProjectAuditFreshness({
    result,
    readinessRegistry,
    capsule: capsuleFor(result),
    registryProject: {
      project_id: result.project_id,
      repository: result.repository,
      default_branch: result.source_proof.default_branch,
      head_revision: 'cccccccccccccccccccccccccccccccccccccccc',
    },
  });

  assert.equal(report.status, 'CURRENT');
  assert.equal(report.registry_observation.status, 'STALE');
  assert.ok(report.reasons.includes('PROJECT_REGISTRY_OBSERVATION_STALE'));
});

test('project identity mismatch is HOLD, not stale', async () => {
  const [readinessRegistry, legacy] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  const result = asV2(legacy, readinessRegistry);

  const report = assessProjectAuditFreshness({
    result,
    readinessRegistry,
    capsule: capsuleFor(result, result.subject_revision, {
      repository: 'freepass-creator/other-project',
      evidence_refs: ['GIT:freepass-creator/other-project@' + result.subject_revision],
    }),
    registryProject: null,
  });

  assert.equal(report.status, 'HOLD');
  assert.ok(report.blockers.includes('REPOSITORY_MISMATCH'));
  assert.equal(report.audit_usable_as_current, false);
});
