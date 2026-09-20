import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeProjectAuditResult, validateProjectAuditResult } from '../src/engine/project-audit-result.mjs';
import { assessProjectAuditFreshness } from '../src/engine/project-audit-freshness.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

test('ERP4 v2 audit validates with exact-head executable CI proof', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepasserp4-v2-2026-09-20-r5.json'),
  ]);

  assert.doesNotThrow(() => validateProjectAuditResult(result, readiness));
  const summary = summarizeProjectAuditResult(result, readiness);

  assert.equal(summary.audit_result_schema, 'ai-core-project-audit-result/v2');
  assert.equal(summary.subject_revision, '0cf39d7c639b8583c5d1244cff1ea8ce51a07329');
  assert.equal(summary.standard_binding.status, 'CURRENT');
  assert.equal(summary.source_proof.ci_status, 'PASS');
  assert.equal(summary.source_proof.ci_run_id, 35509593784);
  assert.equal(summary.source_proof.ci_revision_match, true);
  assert.equal(summary.source_proof.branch_protected, false);
  assert.equal(summary.counts.core_match, 4);
  assert.equal(summary.counts.migration_gap, 4);
  assert.equal(summary.full_conformance_eligible, false);
});

test('ERP4 live audit stays CURRENT even when central project registry observation lags', async () => {
  const [readiness, projects, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../registry/projects.json'),
    readJson('../docs/audits/freepasserp4-v2-2026-09-20-r5.json'),
  ]);
  const project = projects.projects.find(item => item.project_id === 'freepasserp4');
  assert.ok(project);
  assert.notEqual(project.head_revision, result.subject_revision, 'fixture expects registry lag to exercise live-over-registry semantics');

  const capsule = {
    schema: 'ai-core-project-capsule/v1',
    project_id: result.project_id,
    repository: result.repository,
    default_branch: result.source_proof.default_branch,
    subject_revision: result.subject_revision,
    observed_at: '2026-09-20T12:18:00.000Z',
    readiness: {
      status: 'READY_FOR_REGISTRY_REVIEW',
      blockers: [],
      review_required: true,
    },
    evidence_refs: [`GIT:${result.repository}@${result.subject_revision}`],
  };

  const freshness = assessProjectAuditFreshness({
    result,
    readinessRegistry: readiness,
    capsule,
    registryProject: project,
  });

  assert.equal(freshness.status, 'CURRENT');
  assert.equal(freshness.audit_usable_as_current, true);
  assert.equal(freshness.project_revision.moved, false);
  assert.equal(freshness.standard_baseline.status, 'CURRENT');
  assert.equal(freshness.registry_observation.status, 'STALE');
  assert.ok(freshness.reasons.includes('PROJECT_REGISTRY_OBSERVATION_STALE'));
});
