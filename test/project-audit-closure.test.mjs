import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProjectAuditHandoffPacket } from '../src/engine/project-audit-handoff.mjs';
import {
  validateProjectAuditCompletionReport,
  buildProjectAuditClosureReceipt,
  renderProjectAuditClosureMarkdown,
} from '../src/engine/project-audit-closure.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

function currentFreshness(result) {
  return {
    status:'CURRENT',
    project_revision:{audited:result.subject_revision,live:result.subject_revision,moved:false},
    standard_baseline:{status:'CURRENT'},
    registry_observation:{status:'CURRENT'},
  };
}

function completionFor(handoff, overrides = {}) {
  return {
    schema:'ai-core-project-audit-completion-report/v1',
    project_id:handoff.project_id,
    repository:handoff.repository,
    handoff_subject_revision:handoff.audit_binding.subject_revision,
    standard_baseline_revision:handoff.audit_binding.standard_baseline_revision,
    result_revision:handoff.audit_binding.subject_revision,
    completed_at:'2026-09-20T12:10:00.000Z',
    task_results:[
      ...handoff.project_work.implementation.map(task => ({
        bucket:task.bucket,
        axis:task.axis,
        status:'DONE',
        summary:`${task.axis} implementation evidence returned`,
        evidence:[`GIT:${handoff.repository}@${handoff.audit_binding.subject_revision}`],
        remaining_gaps:[],
      })),
      ...handoff.project_work.discovery.map(task => ({
        bucket:task.bucket,
        axis:task.axis,
        status:'DONE',
        summary:`${task.axis} discovery evidence returned`,
        evidence:[`GIT:${handoff.repository}@${handoff.audit_binding.subject_revision}`],
        remaining_gaps:[],
      })),
    ],
    ...overrides,
  };
}

test('completion report alone never closes a handoff', async () => {
  const [readiness,result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-v2-2026-09-20.json'),
  ]);
  const handoff = buildProjectAuditHandoffPacket({
    result,
    readinessRegistry:readiness,
    liveFreshness:currentFreshness(result),
  });
  const completion = completionFor(handoff);

  assert.doesNotThrow(() => validateProjectAuditCompletionReport(completion,handoff));
  const receipt = buildProjectAuditClosureReceipt({
    handoff,
    completionReport:completion,
    readinessRegistry:readiness,
  });

  assert.equal(receipt.status,'REAUDIT_REQUIRED');
  assert.ok(receipt.blockers.includes('SUCCESSOR_AUDIT_REQUIRED'));
  assert.equal(receipt.counts.done,4);
  assert.equal(receipt.counts.audit_closed,0);
});

test('partial or not-done project work stays OPEN_PARTIAL', async () => {
  const [readiness,result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-v2-2026-09-20.json'),
  ]);
  const handoff = buildProjectAuditHandoffPacket({
    result,
    readinessRegistry:readiness,
    liveFreshness:currentFreshness(result),
  });
  const completion = completionFor(handoff);
  completion.task_results[0] = {
    ...completion.task_results[0],
    status:'PARTIAL',
    remaining_gaps:['consumer conformance receipt still missing'],
  };

  const receipt = buildProjectAuditClosureReceipt({
    handoff,
    completionReport:completion,
    readinessRegistry:readiness,
  });

  assert.equal(receipt.status,'OPEN_PARTIAL');
  assert.equal(receipt.counts.partial,1);
  assert.equal(receipt.counts.audit_closed,0);
});

test('successor audit with unresolved original axis becomes REAUDIT_GAPS_REMAIN', async () => {
  const [readiness,result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-v2-2026-09-20.json'),
  ]);
  const handoff = buildProjectAuditHandoffPacket({
    result,
    readinessRegistry:readiness,
    liveFreshness:currentFreshness(result),
  });
  const completion = completionFor(handoff);
  const successor = structuredClone(result);
  successor.audited_at = '2026-09-20T12:11:00.000Z';

  const receipt = buildProjectAuditClosureReceipt({
    handoff,
    completionReport:completion,
    readinessRegistry:readiness,
    successorAudit:successor,
    liveFreshness:currentFreshness(successor),
  });

  assert.equal(receipt.status,'REAUDIT_GAPS_REMAIN');
  assert.equal(receipt.counts.audit_closed,0);
  assert.equal(receipt.tasks.filter(task => task.re_audit_verdict === 'MIGRATION_GAP').length,4);
});

test('successor v2 audit plus live CURRENT is required for CLOSED_VERIFIED', async () => {
  const [readiness,result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-v2-2026-09-20.json'),
  ]);
  const handoff = buildProjectAuditHandoffPacket({
    result,
    readinessRegistry:readiness,
    liveFreshness:currentFreshness(result),
  });
  const completion = completionFor(handoff);

  const successor = structuredClone(result);
  successor.audited_at = '2026-09-20T12:12:00.000Z';
  const implementationAxes = new Set(handoff.project_work.implementation.map(task => task.axis));
  for (const finding of successor.findings) {
    if (implementationAxes.has(finding.axis)) {
      finding.verdict = 'CORE_MATCH';
    }
  }

  const receipt = buildProjectAuditClosureReceipt({
    handoff,
    completionReport:completion,
    readinessRegistry:readiness,
    successorAudit:successor,
    liveFreshness:currentFreshness(successor),
  });

  assert.equal(receipt.status,'CLOSED_VERIFIED');
  assert.equal(receipt.counts.audit_closed,4);
  assert.equal(receipt.blockers.length,0);
  assert.match(receipt.next_action,/No further Project 4 action/);
});

test('stale successor live state prevents closure even if verdicts improved', async () => {
  const [readiness,result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-v2-2026-09-20.json'),
  ]);
  const handoff = buildProjectAuditHandoffPacket({
    result,
    readinessRegistry:readiness,
    liveFreshness:currentFreshness(result),
  });
  const completion = completionFor(handoff);
  const successor = structuredClone(result);
  successor.audited_at = '2026-09-20T12:13:00.000Z';
  const axes = new Set(handoff.project_work.implementation.map(task => task.axis));
  successor.findings.forEach(finding => {
    if (axes.has(finding.axis)) finding.verdict='CORE_MATCH';
  });

  const receipt = buildProjectAuditClosureReceipt({
    handoff,
    completionReport:completion,
    readinessRegistry:readiness,
    successorAudit:successor,
    liveFreshness:{
      status:'STALE',
      project_revision:{live:'a'.repeat(40),moved:true},
      standard_baseline:{status:'CURRENT'},
    },
  });

  assert.notEqual(receipt.status,'CLOSED_VERIFIED');
  assert.ok(receipt.blockers.includes('SUCCESSOR_PROJECT_STALE'));
});

test('completion report must cover every actionable handoff task exactly once', async () => {
  const [readiness,result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-estimate-v2-2026-09-20.json'),
  ]);
  const handoff = buildProjectAuditHandoffPacket({
    result,
    readinessRegistry:readiness,
    liveFreshness:currentFreshness(result),
  });
  const completion = completionFor(handoff);
  completion.task_results.pop();

  assert.throws(
    () => validateProjectAuditCompletionReport(completion,handoff),
    /AUDIT_COMPLETION_TASK_RESULT_COUNT_MISMATCH/,
  );
});

test('closure markdown makes verification state explicit', async () => {
  const [readiness,result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-v2-2026-09-20.json'),
  ]);
  const handoff = buildProjectAuditHandoffPacket({
    result,
    readinessRegistry:readiness,
    liveFreshness:currentFreshness(result),
  });
  const completion = completionFor(handoff);
  const receipt = buildProjectAuditClosureReceipt({
    handoff,
    completionReport:completion,
    readinessRegistry:readiness,
  });
  const md = renderProjectAuditClosureMarkdown(receipt);

  assert.match(md,/REAUDIT_REQUIRED/);
  assert.match(md,/successor audit: not yet available/i);
  assert.match(md,/no automatic project merge/i);
});
