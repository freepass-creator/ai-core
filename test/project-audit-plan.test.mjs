import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProjectAuditPlan } from '../src/engine/project-audit-plan.mjs';

const readRegistry = async () => JSON.parse(await readFile(new URL('../registry/project-audit-readiness.json', import.meta.url), 'utf8'));

function capsule(overrides = {}) {
  const base = {
    schema: 'ai-core-project-capsule/v1',
    project_id: 'freepass-sales',
    repository: 'freepass-creator/freepass-sales',
    default_branch: 'main',
    subject_revision: '1111111111111111111111111111111111111111',
    observed_at: '2026-09-20T11:00:00.000Z',
    classification: { kind: 'NODE_APP', framework: 'Next.js', package_manager: 'npm' },
    commands: { install: 'npm ci', test: 'npm test', build: 'npm run build', start: 'npm run dev', absent_reason: {} },
    delivery: { targets: ['Vercel-candidate'], workflows: [] },
    instructions: ['README.md'],
    data_evidence: [],
    readiness: { status: 'READY_FOR_REGISTRY_REVIEW', blockers: [], review_required: true },
    evidence_refs: [
      'GIT:freepass-creator/freepass-sales@1111111111111111111111111111111111111111',
      'READ:freepass-creator/freepass-sales/README.md@1111111111111111111111111111111111111111#sha256:abc',
    ],
  };
  return { ...base, ...overrides };
}

test('builds a revision-bound read-only audit plan for a ready project capsule', async () => {
  const plan = buildProjectAuditPlan(await readRegistry(), capsule());

  assert.equal(plan.status, 'READY_FOR_READ_ONLY_AUDIT');
  assert.equal(plan.project.project_id, 'freepass-sales');
  assert.equal(plan.axes.length, 8);
  assert.equal(plan.permissions.read_only, true);
  assert.equal(plan.permissions.execute_declared_machine_checks, true);
  assert.equal(plan.permissions.write_project_files, false);
  assert.equal(plan.permissions.auto_remediation, false);
  assert.equal(plan.permissions.production_mutation, false);

  const ui = plan.axes.find(axis => axis.id === 'ui-ux');
  assert.equal(ui.standard_maturity, 'MACHINE_ENFORCED');
  assert.equal(ui.assessment_mode, 'MACHINE_CHECK_REQUIRED');
  assert.equal(ui.conformance_pass_allowed, true);
  assert.equal(ui.result, 'NOT_RUN');

  const security = plan.axes.find(axis => axis.id === 'security-audit');
  assert.equal(security.standard_maturity, 'CANONICAL_PARTIAL');
  assert.equal(security.assessment_mode, 'MACHINE_CHECK_WITH_DECLARED_GAPS');
  assert.equal(security.conformance_pass_allowed, false);
  assert.equal(security.result, 'PARTIAL_NOT_RUN');
  assert.ok(security.declared_gaps.length > 0);
});

test('capsule blockers keep the project audit plan on HOLD', async () => {
  const blocked = capsule({
    readiness: {
      status: 'HOLD',
      blockers: ['README_MISSING'],
      review_required: true,
    },
  });
  const plan = buildProjectAuditPlan(await readRegistry(), blocked);

  assert.equal(plan.status, 'HOLD');
  assert.equal(plan.permissions.execute_declared_machine_checks, false);
  assert.deepEqual(plan.blockers, [{
    code: 'PROJECT_CAPSULE_NOT_READY',
    blockers: ['README_MISSING'],
  }]);
});

test('revision evidence is mandatory for every project audit plan', async () => {
  const broken = capsule({ evidence_refs: [] });
  assert.throws(
    () => buildProjectAuditPlan(await readRegistry(), broken),
    /AUDIT_CAPSULE_REVISION_EVIDENCE_MISSING/,
  );
});

test('canonical partial axes can never claim conformance pass in the plan', async () => {
  const plan = buildProjectAuditPlan(await readRegistry(), capsule());
  for (const axis of plan.axes.filter(item => item.standard_maturity === 'CANONICAL_PARTIAL')) {
    assert.equal(axis.conformance_pass_allowed, false);
    assert.match(axis.result, /PARTIAL/);
  }
});
