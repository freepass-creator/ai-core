import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeProjectAuditResult, validateProjectAuditResult } from '../src/engine/project-audit-result.mjs';
import { assessProjectAuditFreshness } from '../src/engine/project-audit-freshness.mjs';
import { buildProjectAuditRefreshQueue } from '../src/engine/project-audit-refresh-queue.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

const V2_FILES = [
  '../docs/audits/freepass-admin-v2-2026-09-20.json',
  '../docs/audits/freepasserp4-v2-2026-09-20.json',
  '../docs/audits/freepasserp4-v2-2026-09-20-r2.json',
  '../docs/audits/freepasserp4-v2-2026-09-20-r3.json',
  '../docs/audits/freepasserp4-v2-2026-09-20-r4.json',
  '../docs/audits/freepasserp4-v2-2026-09-20-r5.json',
  '../docs/audits/freepass-estimate-v2-2026-09-20.json',
  '../docs/audits/aiops-v2-2026-09-20.json',
];

const V1_FILES = [
  '../docs/audits/freepass-admin-pilot-2026-09-20.json',
  '../docs/audits/freepasserp4-pilot-2026-09-20.json',
  '../docs/audits/freepass-estimate-pilot-2026-09-20.json',
  '../docs/audits/aiops-pilot-2026-09-20.json',
];

test('all four current pilot projects now have structurally valid v2 audits', async () => {
  const readiness = await readJson('../registry/project-audit-readiness.json');
  const results = await Promise.all(V2_FILES.map(readJson));

  assert.equal(results.length, 8);
  for (const result of results) {
    assert.equal(result.schema, 'ai-core-project-audit-result/v2');
    assert.equal(result.standard_baseline_revision, readiness.baseline_revision);
    assert.doesNotThrow(() => validateProjectAuditResult(result, readiness));

    const summary = summarizeProjectAuditResult(result, readiness);
    assert.equal(summary.standard_binding.status, 'CURRENT');
    assert.equal(summary.full_conformance_eligible, false);
    assert.equal(summary.auto_remediation_allowed, false);
    assert.equal(summary.production_mutation_allowed, false);
  }
});

test('v2 portfolio supersedes all four legacy v1 pilot records', async () => {
  const [readinessRegistry, projectRegistry, v2, v1] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../registry/projects.json'),
    Promise.all(V2_FILES.map(readJson)),
    Promise.all(V1_FILES.map(readJson)),
  ]);

  const queue = buildProjectAuditRefreshQueue({
    readinessRegistry,
    projectRegistry,
    auditResults: [...v1, ...v2],
  });

  assert.equal(queue.totals.audit_records, 12);
  assert.equal(queue.totals.active_audits, 4);
  assert.equal(queue.totals.superseded_history, 8);
  assert.equal(queue.items.every(item => item.audit_result_schema === 'ai-core-project-audit-result/v2'), true);
  assert.equal(queue.superseded_history.filter(item => item.audit_result_schema === 'ai-core-project-audit-result/v1').length, 4);
  assert.ok(queue.superseded_history.some(item => item.project_id === 'freepasserp4' && item.audit_result_schema === 'ai-core-project-audit-result/v2'));

  const byId = new Map(queue.items.map(item => [item.project_id, item]));
  assert.equal(byId.get('freepass-admin').registry_status, 'REGISTRY_MATCH');
  assert.equal(byId.get('freepass-estimate').registry_status, 'REGISTRY_MATCH');
  assert.equal(byId.get('aiops').registry_status, 'REGISTRY_MATCH');

  // ERP4 live HEAD advanced beyond the central registry observation.
  // This is a freshness-review request, not a definite re-audit claim.
  assert.equal(byId.get('freepasserp4').audited_revision, '0cf39d7c639b8583c5d1244cff1ea8ce51a07329');
  assert.equal(byId.get('freepasserp4').registry_status, 'REGISTRY_DRIFT');
  assert.equal(byId.get('freepasserp4').freshness_review_required, true);
  assert.equal(byId.get('freepasserp4').re_audit_candidate, false);
});

test('Estimate v2 is CURRENT against its live-revision fixture but keeps CI UNKNOWN', async () => {
  const [readiness, projects, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../registry/projects.json'),
    readJson('../docs/audits/freepass-estimate-v2-2026-09-20.json'),
  ]);
  const project = projects.projects.find(item => item.project_id === 'freepass-estimate');
  assert.ok(project);

  const freshness = assessProjectAuditFreshness({
    result,
    readinessRegistry: readiness,
    capsule: {
      schema:'ai-core-project-capsule/v1',
      project_id:result.project_id,
      repository:result.repository,
      default_branch:'main',
      subject_revision:result.subject_revision,
      observed_at:'2026-09-20T11:35:00.000Z',
      readiness:{status:'READY_FOR_REGISTRY_REVIEW',blockers:[],review_required:true},
      evidence_refs:[`GIT:${result.repository}@${result.subject_revision}`],
    },
    registryProject:project,
  });

  assert.equal(freshness.status, 'CURRENT');
  assert.equal(result.source_proof.ci.status, 'UNKNOWN');
});

test('AIOps v2 is CURRENT against its live-revision fixture but keeps CI UNKNOWN', async () => {
  const [readiness, projects, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../registry/projects.json'),
    readJson('../docs/audits/aiops-v2-2026-09-20.json'),
  ]);
  const project = projects.projects.find(item => item.project_id === 'aiops');
  assert.ok(project);

  const freshness = assessProjectAuditFreshness({
    result,
    readinessRegistry: readiness,
    capsule: {
      schema:'ai-core-project-capsule/v1',
      project_id:result.project_id,
      repository:result.repository,
      default_branch:'main',
      subject_revision:result.subject_revision,
      observed_at:'2026-09-20T11:36:00.000Z',
      readiness:{status:'READY_FOR_REGISTRY_REVIEW',blockers:[],review_required:true},
      evidence_refs:[`GIT:${result.repository}@${result.subject_revision}`],
    },
    registryProject:project,
  });

  assert.equal(freshness.status, 'CURRENT');
  assert.equal(result.source_proof.ci.status, 'UNKNOWN');
});
