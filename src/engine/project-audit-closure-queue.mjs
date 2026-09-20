const need = (condition, code) => { if (!condition) throw new Error(code); };

const FINAL = new Set(['CLOSED_VERIFIED']);
const OPEN = new Set(['HANDOFF_ISSUED','OPEN_PARTIAL','REAUDIT_REQUIRED','REAUDIT_GAPS_REMAIN','HANDOFF_STALE','HOLD']);

const DEFAULT_OPS_POLICY = Object.freeze({
  schema:'ai-core-project-audit-ops-policy/v1',
  status:'PROJECT4_LOCAL_POLICY',
  aging_basis:'handoff.audit_binding.audited_at',
  priorities:{
    P1:{sla_hours:72,warning_after_hours:48},
    P2:{sla_hours:168,warning_after_hours:120},
    P3:{sla_hours:336,warning_after_hours:240},
    NONE:{sla_hours:null,warning_after_hours:null},
  },
});

function time(value) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function iso(ms) {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function hoursBetween(laterMs, earlierMs) {
  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) return null;
  return Math.round(Math.max(0,laterMs-earlierMs) / 36e5 * 10) / 10;
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

function validateOpsPolicy(policy) {
  need(policy?.schema === 'ai-core-project-audit-ops-policy/v1', 'AUDIT_CLOSURE_QUEUE_OPS_POLICY_SCHEMA_INVALID');
  for (const priority of ['P1','P2','P3','NONE']) {
    need(policy.priorities?.[priority], `AUDIT_CLOSURE_QUEUE_OPS_PRIORITY_MISSING:${priority}`);
  }
  return policy;
}

function completionTaskMap(completion) {
  return new Map((completion?.task_results ?? []).map(item => [`${item.bucket}:${item.axis}`,item]));
}

function closureTaskMap(closure) {
  return new Map((closure?.tasks ?? []).map(item => [`${item.bucket}:${item.axis}`,item]));
}

function operationalTasks({handoff,completion,closure,stage,policy,nowMs}) {
  const completionMap = completionTaskMap(completion);
  const closureMap = closureTaskMap(closure);
  const tasks = [
    ...(handoff.project_work?.implementation ?? []),
    ...(handoff.project_work?.discovery ?? []),
  ];

  return tasks.map(task => {
    const key = `${task.bucket}:${task.axis}`;
    const returned = completionMap.get(key) ?? null;
    const closed = closureMap.get(key)?.audit_closed === true;
    const completionStatus = returned?.status ?? 'NOT_RETURNED';
    const rule = policy.priorities?.[task.priority] ?? policy.priorities.NONE;
    const basisMs = time(handoff.audit_binding.audited_at);
    const slaHours = rule.sla_hours;
    const warningHours = rule.warning_after_hours;
    const dueMs = Number.isFinite(slaHours) ? basisMs + slaHours * 36e5 : Number.NaN;
    const warningMs = Number.isFinite(warningHours) ? basisMs + warningHours * 36e5 : Number.NaN;
    const ageHours = hoursBetween(nowMs,basisMs);

    let slaState = 'NOT_APPLICABLE';
    if (closed) {
      slaState = 'CLOSED';
    } else if (completionStatus === 'DONE' || completionStatus === 'NOT_APPLICABLE') {
      slaState = 'REAUDIT_PENDING';
    } else if (task.priority !== 'NONE' && Number.isFinite(slaHours)) {
      if (nowMs >= dueMs) slaState = 'OVERDUE';
      else if (nowMs >= warningMs) slaState = 'AT_RISK';
      else slaState = 'ON_TRACK';
    }

    const executable = !['HANDOFF_STALE','HOLD','CLOSED_VERIFIED'].includes(stage)
      && !closed
      && completionStatus !== 'DONE'
      && completionStatus !== 'NOT_APPLICABLE';

    return {
      task_id:`${handoff.project_id}:${task.bucket}:${task.axis}:${handoff.audit_binding.subject_revision.slice(0,12)}`,
      project_id:handoff.project_id,
      repository:handoff.repository,
      accountable_scope:`PROJECT:${handoff.project_id}`,
      bucket:task.bucket,
      axis:task.axis,
      standard_lane:task.standard_owner?.lane ?? 'UNKNOWN',
      standard_owner:task.standard_owner?.owner ?? 'UNKNOWN',
      priority:task.priority,
      handoff_revision:handoff.audit_binding.subject_revision,
      age_basis_at:handoff.audit_binding.audited_at,
      age_hours:ageHours,
      warning_after_hours:warningHours,
      sla_hours:slaHours,
      warning_at:Number.isFinite(warningMs) ? iso(warningMs) : null,
      due_at:Number.isFinite(dueMs) ? iso(dueMs) : null,
      sla_state:slaState,
      overdue_by_hours:slaState === 'OVERDUE' ? hoursBetween(nowMs,dueMs) : 0,
      remaining_sla_hours:['ON_TRACK','AT_RISK'].includes(slaState)
        ? Math.max(0,Math.round((dueMs-nowMs)/36e5*10)/10)
        : null,
      completion_status:completionStatus,
      completion_at:completion?.completed_at ?? null,
      audit_closed:closed,
      executable,
      instruction:task.instruction,
      next_action:task.next_action,
    };
  });
}

function summarizeTaskOps(tasks) {
  const count = state => tasks.filter(task => task.sla_state === state).length;
  const priorities = Object.fromEntries(
    ['P1','P2','P3','NONE'].map(priority => [priority,tasks.filter(task => task.priority === priority).length])
  );
  const openAges = tasks
    .filter(task => !task.audit_closed && Number.isFinite(task.age_hours))
    .map(task => task.age_hours);
  const due = tasks
    .filter(task => ['ON_TRACK','AT_RISK','OVERDUE'].includes(task.sla_state) && task.due_at)
    .map(task => time(task.due_at))
    .filter(Number.isFinite);

  return {
    tasks:tasks.length,
    priorities,
    on_track:count('ON_TRACK'),
    at_risk:count('AT_RISK'),
    overdue:count('OVERDUE'),
    re_audit_pending:count('REAUDIT_PENDING'),
    closed:count('CLOSED'),
    not_applicable:count('NOT_APPLICABLE'),
    executable:tasks.filter(task => task.executable).length,
    oldest_open_age_hours:openAges.length ? Math.max(...openAges) : null,
    nearest_due_at:due.length ? iso(Math.min(...due)) : null,
  };
}

function summarizeLanes(tasks) {
  const byLane = new Map();
  for (const task of tasks) {
    const key = `${task.standard_lane}|${task.standard_owner}`;
    const current = byLane.get(key) ?? {
      lane:task.standard_lane,
      owner:task.standard_owner,
      tasks:0,
      p1:0,
      p2:0,
      p3:0,
      on_track:0,
      at_risk:0,
      overdue:0,
      re_audit_pending:0,
      closed:0,
    };
    current.tasks += 1;
    if (task.priority === 'P1') current.p1 += 1;
    if (task.priority === 'P2') current.p2 += 1;
    if (task.priority === 'P3') current.p3 += 1;
    if (task.sla_state === 'ON_TRACK') current.on_track += 1;
    if (task.sla_state === 'AT_RISK') current.at_risk += 1;
    if (task.sla_state === 'OVERDUE') current.overdue += 1;
    if (task.sla_state === 'REAUDIT_PENDING') current.re_audit_pending += 1;
    if (task.sla_state === 'CLOSED') current.closed += 1;
    byLane.set(key,current);
  }
  return [...byLane.values()].sort((a,b) => a.lane.localeCompare(b.lane));
}

export function buildProjectAuditClosureQueue({
  handoffs,
  completionReports = [],
  closureReceipts = [],
  liveByProject = new Map(),
  opsPolicy = DEFAULT_OPS_POLICY,
  now = new Date().toISOString(),
}) {
  need(Array.isArray(handoffs), 'AUDIT_CLOSURE_QUEUE_HANDOFFS_REQUIRED');
  need(Array.isArray(completionReports), 'AUDIT_CLOSURE_QUEUE_COMPLETIONS_REQUIRED');
  need(Array.isArray(closureReceipts), 'AUDIT_CLOSURE_QUEUE_RECEIPTS_REQUIRED');
  const policy = validateOpsPolicy(opsPolicy);
  const nowMs = time(now);
  need(Number.isFinite(nowMs), 'AUDIT_CLOSURE_QUEUE_NOW_INVALID');

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
    const tasks = operationalTasks({handoff,completion,closure,stage,policy,nowMs});

    return {
      project_id:handoff.project_id,
      repository:handoff.repository,
      accountable_scope:`PROJECT:${handoff.project_id}`,
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
      task_ops:summarizeTaskOps(tasks),
      operational_tasks:tasks,
      blockers:[...(closure?.blockers ?? []), ...(live?.blockers ?? [])],
      next_action:nextAction(stage,closure),
      closed:FINAL.has(stage),
      action_required:OPEN.has(stage),
    };
  });

  const allTasks = items.flatMap(item => item.operational_tasks);
  const taskOps = summarizeTaskOps(allTasks);

  const totals = {
    projects:items.length,
    handoffs:handoffs.length,
    superseded_handoffs:superseded.length,
    implementation_tasks:items.reduce((sum,item)=>sum+item.implementation_tasks,0),
    discovery_tasks:items.reduce((sum,item)=>sum+item.discovery_tasks,0),
    actionable_tasks:items.reduce((sum,item)=>sum+item.completion_progress.total,0),
    reported_complete_tasks:items.reduce((sum,item)=>sum+item.completion_progress.reported_complete,0),
    audit_closed_tasks:items.reduce((sum,item)=>sum+item.audit_closure_progress.closed,0),
    p1_tasks:taskOps.priorities.P1,
    p2_tasks:taskOps.priorities.P2,
    p3_tasks:taskOps.priorities.P3,
    on_track_tasks:taskOps.on_track,
    at_risk_tasks:taskOps.at_risk,
    overdue_tasks:taskOps.overdue,
    re_audit_pending_tasks:taskOps.re_audit_pending,
    executable_tasks:taskOps.executable,
    oldest_open_age_hours:taskOps.oldest_open_age_hours,
    nearest_due_at:taskOps.nearest_due_at,
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
    schema:'ai-core-project-audit-closure-queue/v2',
    observed_at:iso(nowMs),
    ops_policy:{
      schema:policy.schema,
      status:policy.status,
      aging_basis:policy.aging_basis,
      priorities:policy.priorities,
    },
    totals,
    lane_summary:summarizeLanes(allTasks),
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
    rule:'Completion progress and audit closure progress are intentionally separate. Task ownership is PROJECT:<project_id>; standard lanes are review/coordination dimensions. Project 4 SLA is a local operational signal only and does not authorize writes, merges, deployment or production mutation.',
  };
}

export function renderProjectAuditClosureQueueMarkdown(queue) {
  need(
    queue?.schema === 'ai-core-project-audit-closure-queue/v2'
      || queue?.schema === 'ai-core-project-audit-closure-queue/v1',
    'AUDIT_CLOSURE_QUEUE_SCHEMA_INVALID'
  );

  const t = queue.totals;
  const lines = [
    '# Project 4 — Closure Status',
    '',
    `Observed: ${queue.observed_at ?? 'not recorded'}`,
    '',
    '## Portfolio',
    '',
    `- projects: **${t.projects}**`,
    `- actionable tasks: **${t.actionable_tasks}** (implementation ${t.implementation_tasks} / discovery ${t.discovery_tasks})`,
    `- priority: **P1 ${t.p1_tasks ?? 0} / P2 ${t.p2_tasks ?? 0} / P3 ${t.p3_tasks ?? 0}**`,
    `- SLA: **on track ${t.on_track_tasks ?? 0} / at risk ${t.at_risk_tasks ?? 0} / overdue ${t.overdue_tasks ?? 0}**`,
    `- project-reported complete: **${t.reported_complete_tasks}/${t.actionable_tasks} (${t.reported_complete_percent}%)**`,
    `- audit-closed: **${t.audit_closed_tasks}/${t.actionable_tasks} (${t.audit_closed_percent}%)**`,
    `- handoff issued: **${t.handoff_issued}**`,
    `- partial: **${t.open_partial}**`,
    `- re-audit required: **${t.re_audit_required}**`,
    `- stale handoff: **${t.handoff_stale}**`,
    `- closed verified: **${t.closed_verified}**`,
    '',
    '## Projects',
    '',
    '| Project owner | Stage | Live | P1/P2 | SLA | Reported | Audit closed |',
    '|---|---|---|---:|---|---:|---:|',
  ];

  for (const item of queue.items) {
    const ops = item.task_ops ?? {};
    lines.push(
      `| ${item.accountable_scope ?? `PROJECT:${item.project_id}`} | ${item.stage} | ${item.live_status} | ${ops.priorities?.P1 ?? 0}/${ops.priorities?.P2 ?? 0} | ${ops.on_track ?? 0} on / ${ops.at_risk ?? 0} risk / ${ops.overdue ?? 0} late | ${item.completion_progress.reported_complete_percent}% | ${item.audit_closure_progress.closed_percent}% |`
    );
  }

  if (queue.lane_summary?.length) {
    lines.push(
      '',
      '## Standard lanes',
      '',
      '| Lane | Owner | Tasks | P1 | P2 | On track | At risk | Overdue |',
      '|---|---|---:|---:|---:|---:|---:|---:|',
    );
    for (const lane of queue.lane_summary) {
      lines.push(
        `| ${lane.lane} | ${lane.owner} | ${lane.tasks} | ${lane.p1} | ${lane.p2} | ${lane.on_track} | ${lane.at_risk} | ${lane.overdue} |`
      );
    }
  }

  lines.push('', '## Operational tasks', '');
  const taskRows = queue.items
    .flatMap(item => item.operational_tasks ?? [])
    .sort((a,b) => {
      const severity = {OVERDUE:0,AT_RISK:1,ON_TRACK:2,REAUDIT_PENDING:3,CLOSED:4,NOT_APPLICABLE:5};
      return (severity[a.sla_state] ?? 9) - (severity[b.sla_state] ?? 9)
        || a.priority.localeCompare(b.priority)
        || a.project_id.localeCompare(b.project_id);
    });

  if (!taskRows.length) {
    lines.push('- No operational tasks.');
  } else {
    lines.push(
      '| Project | Axis | Lane | Priority | Age | SLA | State | Due |',
      '|---|---|---|---|---:|---:|---|---|',
    );
    for (const task of taskRows) {
      lines.push(
        `| ${task.project_id} | ${task.axis} | ${task.standard_lane} | ${task.priority} | ${task.age_hours ?? '-'}h | ${task.sla_hours ?? '-'}h | ${task.sla_state} | ${task.due_at ?? '-'} |`
      );
    }
  }

  lines.push(
    '',
    '## Interpretation',
    '',
    'Project accountability is shown as PROJECT:<project_id>. Standard lanes identify the AI Core standard owner that reviews or coordinates the axis; they do not imply a specific human assignee.',
    '',
    'Project-reported completion and audit closure are deliberately different. Project 4 SLA is a local operational queue signal measured from the handoff audit timestamp; it is not a company-wide SLA and does not authorize escalation actions.',
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
