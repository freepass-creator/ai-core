import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeProjectAuditResult, validateProjectAuditResult } from '../src/engine/project-audit-result.mjs';
import { assessProjectAuditFreshness } from '../src/engine/project-audit-freshness.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

test('first Admin v2 audit validates against current audit baseline', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-v2-2026-09-20.json'),
  ]);

  assert.doesNotThrow(() => validateProjectAuditResult(result, readiness));
  const summary = summarizeProjectAuditResult(result, readiness);

  assert.equal(summary.audit_result_schema, 'ai-core-project-audit-result/v2');
  assert.equal(summary.subject_revision, '2747ef32e96c550d7dea05c58ee012880cb42dd3');
  assert.equal(summary.standard_binding.status, 'CURRENT');
  assert.equal(summary.source_proof.ci_status, 'UNKNOWN');
  assert.equal(summary.source_proof.ci_run_id, 35506433512);
  assert.equal(summary.source_proof.branch_protected, false);
  assert.equal(summary.full_conformance_eligible, false);
  assert.equal(summary.counts.core_match, 4);
  assert.equal(summary.counts.migration_gap, 4);
});

test('Admin v2 audit is CURRENT against the registry-bound live revision fixture', async () => {
  const [readiness, projects, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../registry/projects.json'),
    readJson('../docs/audits/freepass-admin-v2-2026-09-20.json'),
  ]);
  const project = projects.projects.find(item => item.project_id === 'freepass-admin');
  assert.ok(project);

  const capsule = {
    schema: 'ai-core-project-capsule/v1',
    project_id: result.project_id,
    repository: result.repository,
    default_branch: result.source_proof.default_branch,
    subject_revision: result.subject_revision,
    observed_at: '2026-09-20T11:20:00.000Z',
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
  assert.equal(freshness.registry_observation.status, 'CURRENT');
});
