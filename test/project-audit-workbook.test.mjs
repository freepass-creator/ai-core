import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProjectAuditPlan } from '../src/engine/project-audit-plan.mjs';
import { buildProjectAuditWorkbook } from '../src/engine/project-audit-workbook.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

function capsule() {
  return {
    schema: 'ai-core-project-capsule/v1',
    project_id: 'freepass-sales',
    repository: 'freepass-creator/freepass-sales',
    default_branch: 'main',
    subject_revision: '1111111111111111111111111111111111111111',
    observed_at: '2026-09-20T11:00:00.000Z',
    classification: { kind: 'NODE_APP', framework: 'Next.js', package_manager: 'npm' },
    commands: { install: 'npm ci', test: 'npm test', build: 'npm run build', start: 'npm run dev', absent_reason: {} },
    delivery: { targets: [], workflows: [] },
    instructions: ['README.md'],
    data_evidence: [],
    readiness: { status: 'READY_FOR_REGISTRY_REVIEW', blockers: [], review_required: true },
    evidence_refs: [
      'GIT:freepass-creator/freepass-sales@1111111111111111111111111111111111111111',
    ],
  };
}

test('audit workbook binds both project revision and Core standard baseline', async () => {
  const readiness = await readJson('../registry/project-audit-readiness.json');
  const plan = buildProjectAuditPlan(readiness, capsule());
  const workbook = buildProjectAuditWorkbook(plan, {
    generatedAt: '2026-09-20T11:30:00.000Z',
  });

  assert.equal(workbook.status, 'READY_FOR_REVIEW');
  assert.equal(workbook.final_result_schema, 'ai-core-project-audit-result/v2');
  assert.equal(workbook.project.subject_revision, capsule().subject_revision);
  assert.equal(workbook.standard_baseline_revision, readiness.baseline_revision);
  assert.equal(workbook.source_proof_template.ci.revision, capsule().subject_revision);
  assert.equal(workbook.axes.length, 8);
  assert.equal(workbook.permissions.write_project_files, false);
  assert.equal(workbook.permissions.production_mutation, false);
});

test('canonical partial workbook axes preserve declared gaps and cannot allow conformance pass', async () => {
  const readiness = await readJson('../registry/project-audit-readiness.json');
  const workbook = buildProjectAuditWorkbook(
    buildProjectAuditPlan(readiness, capsule()),
    { generatedAt: '2026-09-20T11:30:00.000Z' },
  );

  const partialAxes = workbook.axes.filter(axis => axis.standard_maturity === 'CANONICAL_PARTIAL');
  assert.ok(partialAxes.length > 0);
  for (const axis of partialAxes) {
    assert.equal(axis.conformance_pass_allowed, false);
    assert.ok(axis.declared_standard_gaps.length > 0);
    assert.deepEqual(axis.finding.gaps, axis.declared_standard_gaps);
  }
});

test('workbook from HOLD plan remains HOLD and preserves blockers', async () => {
  const readiness = await readJson('../registry/project-audit-readiness.json');
  const blockedCapsule = capsule();
  blockedCapsule.readiness = {
    status: 'HOLD',
    blockers: ['README_MISSING'],
    review_required: true,
  };

  const plan = buildProjectAuditPlan(readiness, blockedCapsule);
  const workbook = buildProjectAuditWorkbook(plan, {
    generatedAt: '2026-09-20T11:30:00.000Z',
  });

  assert.equal(workbook.status, 'HOLD');
  assert.ok(workbook.blockers.some(item => item.code === 'PROJECT_CAPSULE_NOT_READY'));
});
