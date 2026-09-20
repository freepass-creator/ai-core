import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProjectAuditHandoffPacket, renderProjectAuditHandoffMarkdown } from '../src/engine/project-audit-handoff.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

function currentFreshness(result) {
  return {
    status:'CURRENT',
    project_revision:{ audited:result.subject_revision, live:result.subject_revision, moved:false },
    standard_baseline:{ status:'CURRENT', audited_baseline_revision:result.standard_baseline_revision, current_baseline_revision:result.standard_baseline_revision },
  };
}

test('Admin handoff creates project work only from migration gaps', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-v2-2026-09-20.json'),
  ]);

  const packet = buildProjectAuditHandoffPacket({
    result,
    readinessRegistry:readiness,
    liveFreshness:currentFreshness(result),
  });

  assert.equal(packet.status, 'READY');
  assert.equal(packet.counts.project_implementation, 4);
  assert.equal(packet.counts.project_discovery, 0);
  assert.equal(packet.counts.no_project_action, 4);
  assert.equal(packet.project_work.implementation.every(item => item.verdict === 'MIGRATION_GAP'), true);
  assert.equal(packet.no_project_action.every(item => item.verdict === 'CORE_MATCH'), true);
  assert.equal(packet.execution_boundary.auto_write_project_repo, false);
  assert.equal(packet.execution_boundary.production_mutation, false);
});

test('Estimate and AIOps UNKNOWN findings become discovery, not implementation', async () => {
  const [readiness, estimate, aiops] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-estimate-v2-2026-09-20.json'),
    readJson('../docs/audits/aiops-v2-2026-09-20.json'),
  ]);

  for (const result of [estimate, aiops]) {
    const packet = buildProjectAuditHandoffPacket({
      result,
      readinessRegistry:readiness,
      liveFreshness:currentFreshness(result),
    });
    assert.equal(packet.counts.project_discovery, 1);
    assert.equal(packet.project_work.discovery[0].verdict, 'UNKNOWN');
    assert.match(packet.project_work.discovery[0].instruction, /revision-bound evidence/i);
  }
});

test('PROJECT_AHEAD routes to standard owner and never auto-promotes Core', async () => {
  const [readiness, source] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-v2-2026-09-20.json'),
  ]);
  const result = structuredClone(source);
  result.findings[0].verdict = 'PROJECT_AHEAD';

  const packet = buildProjectAuditHandoffPacket({
    result,
    readinessRegistry:readiness,
    liveFreshness:currentFreshness(result),
  });

  assert.equal(packet.counts.core_candidate_review, 1);
  assert.equal(packet.standard_work.core_candidate_review[0].bucket, 'CORE_CANDIDATE_REVIEW');
  assert.equal(packet.execution_boundary.auto_promote_core_standard, false);
});

test('stale project or standard binding blocks handoff execution', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-v2-2026-09-20.json'),
  ]);

  const staleProject = buildProjectAuditHandoffPacket({
    result,
    readinessRegistry:readiness,
    liveFreshness:{
      status:'STALE',
      project_revision:{live:'a'.repeat(40),moved:true},
      standard_baseline:{status:'CURRENT'},
    },
  });
  assert.equal(staleProject.status, 'HOLD_STALE_AUDIT');
  assert.ok(staleProject.blockers.includes('PROJECT_REVISION_STALE'));

  const staleStandard = structuredClone(result);
  staleStandard.standard_baseline_revision = 'b'.repeat(40);
  const packet = buildProjectAuditHandoffPacket({
    result:staleStandard,
    readinessRegistry:readiness,
    liveFreshness:null,
  });
  assert.equal(packet.status, 'HOLD_STALE_AUDIT');
  assert.ok(packet.blockers.includes('STANDARD_BASELINE_STALE'));
});

test('markdown renderer carries revision binding and project tasks', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-v2-2026-09-20.json'),
  ]);
  const packet = buildProjectAuditHandoffPacket({
    result,
    readinessRegistry:readiness,
    liveFreshness:currentFreshness(result),
  });

  const md = renderProjectAuditHandoffMarkdown(packet);
  assert.match(md, /Project Audit Handoff — freepass-admin/);
  assert.match(md, new RegExp(result.subject_revision));
  assert.match(md, /Project implementation/);
  assert.match(md, /no automatic project write/i);
});
