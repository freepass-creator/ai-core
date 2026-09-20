const need = (condition, code) => { if (!condition) throw new Error(code); };

const FINAL = new Set(['CLOSED_VERIFIED']);
const OPEN = new Set(['HANDOFF_ISSUED','OPEN_PARTIAL','REAUDIT_REQUIRED','REAUDIT_GAPS_REMAIN','HANDOFF_STALE','HOLD']);

function time(value) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function handoffKey(handoff) {
  return [
    handoff.project_id,
    handoff.repository,
    handoff.audit_binding?.subject_revision,
    handoff.audit_binding?.standard_baseline_revision,
  ].join('|');
}

function completionMatches(completion, handoff) {
  return completion?.schema === 'ai-core-project-audit-completion-report/v1'
    && completion.project_id === handoff.project_id
    && completion.repository === handoff.repository
    && completion.handoff_subject_revision === handoff.audit_binding.subject_revision
    && completion.standard_baseline_revision === handoff.audit_binding.standard_baseline_revision;
}

function closureMatches(receipt, handoff) {
  return receipt?.schema === 'ai-core-project-audit-closure-receipt/v1'
    && receipt.project_id === handoff.project_id
    && receipt.repository === handoff.repository
    && receipt.handoff_binding?.subject_revision === handoff.audit_binding.subject_revision
    && receipt.handoff_binding?.standard_baseline_revision === handoff.audit_binding.standard_baseline_revision;
}

export function selectActiveProjectAuditHandoffs(handoffs) {
  const byProject = new Map();
  const superseded = [];

  for (const handoff of handoffs) {
    need(handoff?.schema === 'ai-core-project-audit-handoff/v1', 'AUDIT_CLOSURE_QUEUE_HANDOFF_SCHEMA_INVALID');
    const current = byProject.get(handoff.project_id);
    if (!current || time(handoff.audit_binding?.audited_at) > time(current.audit_binding?.audited_at)) {
      if (current) superseded.push(current);
      byProject.set(handoff.project_id, handoff);
    } else {
      superseded.push(handoff);
    }
  }

  return {
    active: [...byProject.values()].sort((a,b) => a.project_id.localeCompare(b.project_id)),
    superseded,
  };
}

function latestCompletion(completionReports, handoff) {
  return completionReports
    .filter(report => completionMatches(report,handoff))
    .sort((a,b) => time(b.completed_at) - time(a.completed_at))[0] ?? null;
}

function latestClosure(closureReceipts, handoff) {
  return closureReceipts
    .filter(receipt => closureMatches(receipt,handoff))
    .sort((a,b) => time(b.completion_binding?.completed_at) - time(a.completion_binding?.completed_at))[0] ?? null;
}

function completionCounts(handoff, completion) {
  const implementation = handoff.project_work?.implementation?.length ?? 0;
  const discovery = handoff.project_work?.discovery?.length ?? 0;
  const total = implementation + discovery;

  if (!completion) {
    return {
      total,
      done:0,
      partial:0,
      not_done:total,
      not_applicable:0,
      returned:0,
      returned_percent:0,
      reported_complete:0,
      reported_complete_percent:0,
    };
  }

  const results = completion.task_results ?? [];
  const done = results.filter(item => item.status === 'DONE').length;
  const partial = results.filter(item => item.status === 'PARTIAL').length;
  const notDone = results.filter(item => item.status === 'NOT_DONE').length;
  const notApplicable = results.filter(item => item.status === 'NOT_APPLICABLE').length;
  const returned = results.length;
  const reportedComplete = done + notApplicable;

  return {
    total,
    done,
    partial,
    not_done:notDone,
    not_applicable:notApplicable,
    returned,
    returned_percent:total ? Math.round(returned / total * 100) : 100,
    reported_complete:reportedComplete,
    reported_complete_percent:total ? Math.round(reportedComplete / total * 100) : 100,
  };
}

function auditClosureCounts(handoff, closure) {
  const total = (handoff.project_work?.implementation?.length ?? 0)
    + (handoff.project_work?.discovery?.length ?? 0);
  const closed = closure?.counts?.audit_closed ?? 0;
  return {
    total,
    closed,
    closed_percent:total ? Math.round(closed / total * 100) : 100,
  };
}

function stageFor({handoff,completion,closure,live}) {
  if (handoff.status !== 'READY') return 'HOLD';

  if (live) {
    if (live.status === 'STALE' || live.status === 'HOLD') return 'HANDOFF_STALE';
    if (live.status !== 'CURRENT') return 'HOLD';
  }

  if (closure) return closure.status;
  if (!completion) return 'HANDOFF_ISSUED';

  const open = (completion.task_results ?? []).some(item =>
    item.status === 'PARTIAL' || item.status === 'NOT_DONE'
  );
  return open ? 'OPEN_PARTIAL' : 'REAUDIT_REQUIRED';
}

function nextAction(stage, closure) {
  if (closure?.next_action) return closure.next_action;
  switch (stage) {
    case 'HANDOFF_ISSUED':
      return 'Project owner should implement/discover the issued tasks and return a completion report bound to the resulting revision.';
    case 'OPEN_PARTIAL':
      return 'Finish remaining project work and return updated evidence before re-audit.';
    case 'REAUDIT_REQUIRED':
      return 'Run a successor v2 audit at the completion result revision, then re-check live freshness.';
    case 'REAUDIT_GAPS_REMAIN':
      return 'Issue a new handoff from the successor audit for the still-open axes.';
    case 'HANDOFF_STALE':
      return 'Re-audit the live project revision and issue a fresh handoff before further execution.';
    case 'CLOSED_VERIFIED':
      return 'No Project 4 action unless project or standard revisions move.';
    default:
      return 'Resolve HOLD blockers before continuing.';
  }
}

export function buildProjectAuditClosureQueue({
  handoffs,
  completionReports = [],
  closureReceipts = [],
  liveByProject = new Map(),
}) {
  need(Array.isArray(handoffs), 'AUDIT_CLOSURE_QUEUE_HANDOFFS_REQUIRED');
  need(Array.isArray(completionReports), 'AUDIT_CLOSURE_QUEUE_COMPLETIONS_REQUIRED');
  need(Array.isArray(closureReceipts), 'AUDIT_CLOSURE_QUEUE_RECEIPTS_REQUIRED');

  const {active,superseded} = selectActiveProjectAuditHandoffs(handoffs);

  const items = active.map(handoff => {
    const completion = latestCompletion(completionReports,handoff);
    const closure = latestClosure(closureReceipts,handoff);
    const live = liveByProject instanceof Map
      ? liveByProject.get(handoff.project_id) ?? null
      : liveByProject?.[handoff.project_id] ?? null;
    const stage = stageFor({handoff,completion,closure,live});
    const completionProgress = completionCounts(handoff,completion);
    const auditProgress = auditClosureCounts(handoff,closure);

    return {
      project_id:handoff.project_id,
      repository:handoff.repository,
      handoff_revision:handoff.audit_binding.subject_revision,
      standard_baseline_revision:handoff.audit_binding.standard_baseline_revision,
      handoff_audited_at:handoff.audit_binding.audited_at,
      live_status:live?.status ?? 'UNOBSERVED',
      live_revision:live?.live_revision ?? live?.project_revision?.live ?? null,
      stage,
      completion_revision:completion?.result_revision ?? null,
      completion_at:completion?.completed_at ?? null,
      successor_audit_revision:closure?.successor_audit_binding?.subject_revision ?? null,
      completion_progress:completionProgress,
      audit_closure_progress:auditProgress,
      implementation_tasks:handoff.counts.project_implementation,
      discovery_tasks:handoff.counts.project_discovery,
      blockers:[...(closure?.blockers ?? []), ...(live?.blockers ?? [])],
      next_action:nextAction(stage,closure),
      closed:FINAL.has(stage),
      action_required:OPEN.has(stage),
    };
  });

  const totals = {
    projects:items.length,
    handoffs:handoffs.length,
    superseded_handoffs:superseded.length,
    implementation_tasks:items.reduce((sum,item)=>sum+item.implementation_tasks,0),
    discovery_tasks:items.reduce((sum,item)=>sum+item.discovery_tasks,0),
    actionable_tasks:items.reduce((sum,item)=>sum+item.completion_progress.total,0),
    reported_complete_tasks:items.reduce((sum,item)=>sum+item.completion_progress.reported_complete,0),
    audit_closed_tasks:items.reduce((sum,item)=>sum+item.audit_closure_progress.closed,0),
    handoff_issued:items.filter(item=>item.stage==='HANDOFF_ISSUED').length,
    open_partial:items.filter(item=>item.stage==='OPEN_PARTIAL').length,
    re_audit_required:items.filter(item=>item.stage==='REAUDIT_REQUIRED').length,
    re_audit_gaps_remain:items.filter(item=>item.stage==='REAUDIT_GAPS_REMAIN').length,
    handoff_stale:items.filter(item=>item.stage==='HANDOFF_STALE').length,
    hold:items.filter(item=>item.stage==='HOLD').length,
    closed_verified:items.filter(item=>item.stage==='CLOSED_VERIFIED').length,
    action_required:items.filter(item=>item.action_required).length,
  };

  totals.reported_complete_percent = totals.actionable_tasks
    ? Math.round(totals.reported_complete_tasks / totals.actionable_tasks * 100)
    : 100;
  totals.audit_closed_percent = totals.actionable_tasks
    ? Math.round(totals.audit_closed_tasks / totals.actionable_tasks * 100)
    : 100;

  return {
    schema:'ai-core-project-audit-closure-queue/v1',
    totals,
    items,
    superseded_handoffs:superseded.map(handoff => ({
      project_id:handoff.project_id,
      repository:handoff.repository,
      subject_revision:handoff.audit_binding.subject_revision,
      audited_at:handoff.audit_binding.audited_at,
    })),
    permissions:{
      auto_write_project_repo:false,
      auto_merge_project_pr:false,
      auto_promote_core_standard:false,
      auto_deploy:false,
      production_mutation:false,
    },
    rule:'Completion progress and audit closure progress are intentionally separate. A project may report 100% complete while audit closure remains 0% until a successor v2 audit and live freshness verify the original handoff axes.',
  };
}


export function renderProjectAuditClosureQueueMarkdown(queue) {
  need(queue?.schema === 'ai-core-project-audit-closure-queue/v1', 'AUDIT_CLOSURE_QUEUE_SCHEMA_INVALID');

  const t = queue.totals;
  const lines = [
    '# Project 4 — Closure Status',
    '',
    '## Portfolio',
    '',
    `- projects: **${t.projects}**`,
    `- actionable tasks: **${t.actionable_tasks}** (implementation ${t.implementation_tasks} / discovery ${t.discovery_tasks})`,
    `- project-reported complete: **${t.reported_complete_tasks}/${t.actionable_tasks} (${t.reported_complete_percent}%)**`,
    `- audit-closed: **${t.audit_closed_tasks}/${t.actionable_tasks} (${t.audit_closed_percent}%)**`,
    `- handoff issued: **${t.handoff_issued}**`,
    `- partial: **${t.open_partial}**`,
    `- re-audit required: **${t.re_audit_required}**`,
    `- re-audit gaps remain: **${t.re_audit_gaps_remain}**`,
    `- stale handoff: **${t.handoff_stale}**`,
    `- closed verified: **${t.closed_verified}**`,
    '',
    '## Projects',
    '',
    '| Project | Stage | Live | Reported | Audit closed | Next |',
    '|---|---|---|---:|---:|---|',
  ];

  for (const item of queue.items) {
    lines.push(
      `| ${item.project_id} | ${item.stage} | ${item.live_status} | ${item.completion_progress.reported_complete_percent}% | ${item.audit_closure_progress.closed_percent}% | ${item.next_action.replace(/\|/g,'/')} |`
    );
  }

  lines.push(
    '',
    '## Detail',
    '',
  );

  for (const item of queue.items) {
    lines.push(
      `### ${item.project_id}`,
      '',
      `- repository: \`${item.repository}\``,
      `- handoff revision: \`${item.handoff_revision}\``,
      `- live revision: ${item.live_revision ? `\`${item.live_revision}\`` : 'unobserved'}`,
      `- stage: **${item.stage}**`,
      `- project-reported complete: ${item.completion_progress.reported_complete}/${item.completion_progress.total} (${item.completion_progress.reported_complete_percent}%)`,
      `- audit closed: ${item.audit_closure_progress.closed}/${item.audit_closure_progress.total} (${item.audit_closure_progress.closed_percent}%)`,
      `- implementation tasks: ${item.implementation_tasks}`,
      `- discovery tasks: ${item.discovery_tasks}`,
      `- next: ${item.next_action}`,
    );
    if (item.blockers.length) {
      lines.push('- blockers:', ...item.blockers.map(blocker => `  - ${blocker}`));
    }
    lines.push('');
  }

  lines.push(
    '## Interpretation',
    '',
    'Project-reported completion and audit closure are deliberately different. A project can report 100% completion while audit closure stays 0% until a successor v2 audit at that result revision is live-current and closes the original handoff axes.',
    '',
    '## Safety boundary',
    '',
    '- no automatic project write',
    '- no automatic project merge',
    '- no automatic Core promotion',
    '- no deployment',
    '- no production mutation',
  );

  return lines.join('\n') + '\n';
}
