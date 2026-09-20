import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildProjectAuditClosureQueue,
  renderProjectAuditClosureQueueMarkdown,
} from '../src/engine/project-audit-closure-queue.mjs';

const readJson = path => readFile(new URL(path, import.meta.url),'utf8').then(JSON.parse);

const handoffFiles = [
  '../docs/handoffs/project-4/freepass-admin.handoff.json',
  '../docs/handoffs/project-4/freepasserp4.handoff.json',
  '../docs/handoffs/project-4/freepass-estimate.handoff.json',
  '../docs/handoffs/project-4/aiops.handoff.json',
];

async function handoffs() {
  return Promise.all(handoffFiles.map(readJson));
}

function completionFor(handoff,{status='DONE',revision=handoff.audit_binding.subject_revision}={}) {
  const tasks = [
    ...(handoff.project_work.implementation ?? []),
    ...(handoff.project_work.discovery ?? []),
  ];
  return {
    schema:'ai-core-project-audit-completion-report/v1',
    project_id:handoff.project_id,
    repository:handoff.repository,
    handoff_subject_revision:handoff.audit_binding.subject_revision,
    standard_baseline_revision:handoff.audit_binding.standard_baseline_revision,
    result_revision:revision,
    completed_at:'2026-09-20T12:20:00.000Z',
    task_results:tasks.map((task,index) => ({
      bucket:task.bucket,
      axis:task.axis,
      status:index===0 ? status : 'DONE',
      summary:'synthetic completion result',
      evidence:['GIT:fixture'],
      remaining_gaps:index===0 && status!=='DONE' ? ['still open'] : [],
    })),
  };
}

test('current issued handoffs produce four-project zero-completion queue', async () => {
  const queue = buildProjectAuditClosureQueue({
    handoffs:await handoffs(),
  });

  assert.equal(queue.totals.projects,4);
  assert.equal(queue.totals.implementation_tasks,15);
  assert.equal(queue.totals.discovery_tasks,2);
  assert.equal(queue.totals.actionable_tasks,17);
  assert.equal(queue.totals.reported_complete_tasks,0);
  assert.equal(queue.totals.reported_complete_percent,0);
  assert.equal(queue.totals.audit_closed_tasks,0);
  assert.equal(queue.totals.audit_closed_percent,0);
  assert.equal(queue.totals.handoff_issued,4);
  assert.equal(queue.totals.action_required,4);
  assert.equal(queue.items.every(item => item.stage==='HANDOFF_ISSUED'),true);
});

test('100 percent project completion becomes REAUDIT_REQUIRED, not closed', async () => {
  const hs = await handoffs();
  const admin = hs.find(item => item.project_id==='freepass-admin');
  const completion = completionFor(admin);

  const queue = buildProjectAuditClosureQueue({
    handoffs:hs,
    completionReports:[completion],
  });
  const item = queue.items.find(item => item.project_id==='freepass-admin');

  assert.equal(item.stage,'REAUDIT_REQUIRED');
  assert.equal(item.completion_progress.reported_complete_percent,100);
  assert.equal(item.audit_closure_progress.closed_percent,0);
  assert.match(item.next_action,/successor v2 audit/i);
});

test('partial completion stays OPEN_PARTIAL', async () => {
  const hs = await handoffs();
  const estimate = hs.find(item => item.project_id==='freepass-estimate');
  const completion = completionFor(estimate,{status:'PARTIAL'});

  const queue = buildProjectAuditClosureQueue({
    handoffs:hs,
    completionReports:[completion],
  });
  const item = queue.items.find(item => item.project_id==='freepass-estimate');

  assert.equal(item.stage,'OPEN_PARTIAL');
  assert.equal(item.completion_progress.partial,1);
  assert.ok(item.completion_progress.reported_complete_percent < 100);
});

test('closure receipt drives verified audit-closure progress separately', async () => {
  const hs = await handoffs();
  const admin = hs.find(item => item.project_id==='freepass-admin');
  const completion = completionFor(admin);
  const closure = {
    schema:'ai-core-project-audit-closure-receipt/v1',
    status:'CLOSED_VERIFIED',
    project_id:admin.project_id,
    repository:admin.repository,
    handoff_binding:{
      subject_revision:admin.audit_binding.subject_revision,
      standard_baseline_revision:admin.audit_binding.standard_baseline_revision,
    },
    completion_binding:{
      result_revision:completion.result_revision,
      completed_at:completion.completed_at,
    },
    successor_audit_binding:{
      subject_revision:completion.result_revision,
      standard_baseline_revision:admin.audit_binding.standard_baseline_revision,
      audited_at:'2026-09-20T12:21:00.000Z',
      live_status:'CURRENT',
    },
    counts:{
      tasks:4,done:4,partial:0,not_done:0,not_applicable:0,audit_closed:4,
    },
    tasks:[],
    blockers:[],
    next_action:'No further Project 4 action.',
    execution_boundary:{},
    rule:'fixture',
  };

  const queue = buildProjectAuditClosureQueue({
    handoffs:hs,
    completionReports:[completion],
    closureReceipts:[closure],
  });
  const item = queue.items.find(item => item.project_id==='freepass-admin');

  assert.equal(item.stage,'CLOSED_VERIFIED');
  assert.equal(item.closed,true);
  assert.equal(item.action_required,false);
  assert.equal(item.completion_progress.reported_complete_percent,100);
  assert.equal(item.audit_closure_progress.closed_percent,100);
});

test('live project movement overrides stored stage with HANDOFF_STALE', async () => {
  const hs = await handoffs();
  const liveByProject = new Map([
    ['freepasserp4',{
      status:'STALE',
      live_revision:'a'.repeat(40),
      blockers:['HANDOFF_PROJECT_REVISION_MOVED'],
    }],
  ]);

  const queue = buildProjectAuditClosureQueue({
    handoffs:hs,
    liveByProject,
  });
  const item = queue.items.find(item => item.project_id==='freepasserp4');

  assert.equal(item.stage,'HANDOFF_STALE');
  assert.equal(item.live_status,'STALE');
  assert.ok(item.blockers.includes('HANDOFF_PROJECT_REVISION_MOVED'));
  assert.match(item.next_action,/fresh handoff/i);
});

test('newer handoff supersedes older handoff for same project', async () => {
  const hs = await handoffs();
  const admin = hs.find(item => item.project_id==='freepass-admin');
  const newer = structuredClone(admin);
  newer.audit_binding.subject_revision='a'.repeat(40);
  newer.audit_binding.audited_at='2026-09-20T13:00:00.000Z';
  newer.audit_binding.live_revision='a'.repeat(40);

  const queue = buildProjectAuditClosureQueue({
    handoffs:[...hs,newer],
  });

  assert.equal(queue.totals.projects,4);
  assert.equal(queue.totals.handoffs,5);
  assert.equal(queue.totals.superseded_handoffs,1);
  assert.equal(queue.items.find(item=>item.project_id==='freepass-admin').handoff_revision,'a'.repeat(40));
});

test('markdown dashboard exposes portfolio and project progress', async () => {
  const queue = buildProjectAuditClosureQueue({
    handoffs:await handoffs(),
  });
  const md = renderProjectAuditClosureQueueMarkdown(queue);

  assert.match(md,/Project 4 — Closure Status/);
  assert.match(md,/actionable tasks: \*\*17\*\*/);
  assert.match(md,/freepass-admin/);
  assert.match(md,/HANDOFF_ISSUED/);
  assert.match(md,/audit-closed:/);
});
