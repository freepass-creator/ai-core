import { validateProjectAuditResult } from './project-audit-result.mjs';

const need = (condition, code) => { if (!condition) throw new Error(code); };
const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);

const TASK_BUCKETS = new Set(['PROJECT_IMPLEMENTATION', 'PROJECT_DISCOVERY']);
const TASK_STATUSES = new Set(['DONE', 'PARTIAL', 'NOT_DONE', 'NOT_APPLICABLE']);

function actionableTasks(handoff) {
  return [
    ...(handoff?.project_work?.implementation ?? []),
    ...(handoff?.project_work?.discovery ?? []),
  ];
}

function taskKey(task) {
  return `${task.bucket}:${task.axis}`;
}

export function validateProjectAuditCompletionReport(report, handoff) {
  need(report && typeof report === 'object', 'AUDIT_COMPLETION_REPORT_REQUIRED');
  need(report.schema === 'ai-core-project-audit-completion-report/v1', 'AUDIT_COMPLETION_REPORT_SCHEMA_INVALID');
  need(handoff?.schema === 'ai-core-project-audit-handoff/v1', 'AUDIT_COMPLETION_HANDOFF_SCHEMA_INVALID');
  need(handoff.status === 'READY', 'AUDIT_COMPLETION_HANDOFF_NOT_READY');

  need(report.project_id === handoff.project_id, 'AUDIT_COMPLETION_PROJECT_ID_MISMATCH');
  need(report.repository === handoff.repository, 'AUDIT_COMPLETION_REPOSITORY_MISMATCH');
  need(report.handoff_subject_revision === handoff.audit_binding.subject_revision, 'AUDIT_COMPLETION_HANDOFF_REVISION_MISMATCH');
  need(report.standard_baseline_revision === handoff.audit_binding.standard_baseline_revision, 'AUDIT_COMPLETION_STANDARD_BASELINE_MISMATCH');
  need(sha(report.result_revision), 'AUDIT_COMPLETION_RESULT_REVISION_INVALID');
  need(typeof report.completed_at === 'string' && Number.isFinite(Date.parse(report.completed_at)), 'AUDIT_COMPLETION_COMPLETED_AT_INVALID');
  need(Array.isArray(report.task_results), 'AUDIT_COMPLETION_TASK_RESULTS_REQUIRED');

  const expected = actionableTasks(handoff);
  const expectedMap = new Map(expected.map(task => [taskKey(task), task]));
  const seen = new Set();

  need(report.task_results.length === expected.length, 'AUDIT_COMPLETION_TASK_RESULT_COUNT_MISMATCH');

  for (const result of report.task_results) {
    need(result && typeof result === 'object', 'AUDIT_COMPLETION_TASK_RESULT_INVALID');
    need(TASK_BUCKETS.has(result.bucket), 'AUDIT_COMPLETION_TASK_BUCKET_INVALID');
    need(typeof result.axis === 'string' && result.axis.length > 0, 'AUDIT_COMPLETION_TASK_AXIS_REQUIRED');
    const key = `${result.bucket}:${result.axis}`;
    need(expectedMap.has(key), `AUDIT_COMPLETION_UNEXPECTED_TASK:${key}`);
    need(!seen.has(key), `AUDIT_COMPLETION_DUPLICATE_TASK:${key}`);
    seen.add(key);

    need(TASK_STATUSES.has(result.status), `AUDIT_COMPLETION_TASK_STATUS_INVALID:${key}`);
    need(Array.isArray(result.evidence), `AUDIT_COMPLETION_TASK_EVIDENCE_REQUIRED:${key}`);
    need(Array.isArray(result.remaining_gaps), `AUDIT_COMPLETION_TASK_REMAINING_GAPS_REQUIRED:${key}`);
    need(typeof result.summary === 'string' && result.summary.trim().length > 0, `AUDIT_COMPLETION_TASK_SUMMARY_REQUIRED:${key}`);

    if (result.status === 'DONE' || result.status === 'PARTIAL') {
      need(result.evidence.length > 0, `AUDIT_COMPLETION_DONE_EVIDENCE_REQUIRED:${key}`);
    }
    if (result.status === 'DONE') {
      need(result.remaining_gaps.length === 0, `AUDIT_COMPLETION_DONE_HAS_REMAINING_GAPS:${key}`);
    }
    if (result.status === 'PARTIAL' || result.status === 'NOT_DONE') {
      need(result.remaining_gaps.length > 0, `AUDIT_COMPLETION_OPEN_TASK_NEEDS_GAPS:${key}`);
    }
  }

  need(seen.size === expectedMap.size, 'AUDIT_COMPLETION_TASK_COVERAGE_INCOMPLETE');
  return true;
}

function successorFindingMap(successorAudit) {
  return new Map(successorAudit.findings.map(finding => [finding.axis, finding]));
}

function axisResolved(originalTask, successorFinding) {
  if (!successorFinding) return false;
  if (originalTask.bucket === 'PROJECT_IMPLEMENTATION') {
    return successorFinding.verdict !== 'MIGRATION_GAP' && successorFinding.verdict !== 'UNKNOWN';
  }
  if (originalTask.bucket === 'PROJECT_DISCOVERY') {
    return successorFinding.verdict !== 'UNKNOWN';
  }
  return false;
}

export function buildProjectAuditClosureReceipt({
  handoff,
  completionReport,
  readinessRegistry,
  successorAudit = null,
  liveFreshness = null,
}) {
  validateProjectAuditCompletionReport(completionReport, handoff);

  const tasks = actionableTasks(handoff);
  const reportMap = new Map(completionReport.task_results.map(result => [`${result.bucket}:${result.axis}`, result]));
  const taskStates = tasks.map(task => {
    const completion = reportMap.get(taskKey(task));
    return {
      bucket: task.bucket,
      axis: task.axis,
      completion_status: completion.status,
      summary: completion.summary,
      evidence: [...completion.evidence],
      remaining_gaps: [...completion.remaining_gaps],
      re_audit_verdict: null,
      audit_closed: false,
    };
  });

  const allReportedDone = taskStates.every(task =>
    task.completion_status === 'DONE' || task.completion_status === 'NOT_APPLICABLE'
  );
  const anyOpen = taskStates.some(task =>
    task.completion_status === 'PARTIAL' || task.completion_status === 'NOT_DONE'
  );

  let status = anyOpen ? 'OPEN_PARTIAL' : 'REAUDIT_REQUIRED';
  const blockers = [];

  if (!successorAudit) {
    blockers.push('SUCCESSOR_AUDIT_REQUIRED');
  } else {
    validateProjectAuditResult(successorAudit, readinessRegistry);
    need(successorAudit.schema === 'ai-core-project-audit-result/v2', 'AUDIT_CLOSURE_SUCCESSOR_V2_REQUIRED');
    need(successorAudit.project_id === handoff.project_id, 'AUDIT_CLOSURE_SUCCESSOR_PROJECT_MISMATCH');
    need(successorAudit.repository === handoff.repository, 'AUDIT_CLOSURE_SUCCESSOR_REPOSITORY_MISMATCH');
    need(successorAudit.subject_revision === completionReport.result_revision, 'AUDIT_CLOSURE_SUCCESSOR_REVISION_MISMATCH');

    const findings = successorFindingMap(successorAudit);
    for (const task of taskStates) {
      const original = tasks.find(item => item.bucket === task.bucket && item.axis === task.axis);
      const finding = findings.get(task.axis);
      task.re_audit_verdict = finding?.verdict ?? null;
      task.audit_closed = task.completion_status === 'NOT_APPLICABLE'
        ? finding?.verdict !== 'UNKNOWN'
        : task.completion_status === 'DONE' && axisResolved(original, finding);
    }

    const baselineCurrent = successorAudit.standard_baseline_revision === readinessRegistry.baseline_revision;
    if (!baselineCurrent) blockers.push('SUCCESSOR_AUDIT_STANDARD_STALE');

    const liveStatus = liveFreshness?.status ?? 'UNOBSERVED';
    const liveCurrent = liveStatus === 'CURRENT';
    if (!liveCurrent) blockers.push(
      liveStatus === 'STALE' ? 'SUCCESSOR_PROJECT_STALE'
        : liveStatus === 'HOLD' ? 'SUCCESSOR_LIVE_FRESHNESS_HOLD'
          : 'SUCCESSOR_LIVE_FRESHNESS_REQUIRED'
    );

    const allAuditClosed = taskStates.every(task => task.audit_closed);
    if (allReportedDone && allAuditClosed && baselineCurrent && liveCurrent) {
      status = 'CLOSED_VERIFIED';
    } else if (allReportedDone && baselineCurrent && liveCurrent) {
      status = 'REAUDIT_GAPS_REMAIN';
    }
  }

  return {
    schema: 'ai-core-project-audit-closure-receipt/v1',
    status,
    project_id: handoff.project_id,
    repository: handoff.repository,
    handoff_binding: {
      subject_revision: handoff.audit_binding.subject_revision,
      standard_baseline_revision: handoff.audit_binding.standard_baseline_revision,
    },
    completion_binding: {
      result_revision: completionReport.result_revision,
      completed_at: completionReport.completed_at,
    },
    successor_audit_binding: successorAudit ? {
      subject_revision: successorAudit.subject_revision,
      standard_baseline_revision: successorAudit.standard_baseline_revision,
      audited_at: successorAudit.audited_at,
      live_status: liveFreshness?.status ?? 'UNOBSERVED',
    } : null,
    counts: {
      tasks: taskStates.length,
      done: taskStates.filter(task => task.completion_status === 'DONE').length,
      partial: taskStates.filter(task => task.completion_status === 'PARTIAL').length,
      not_done: taskStates.filter(task => task.completion_status === 'NOT_DONE').length,
      not_applicable: taskStates.filter(task => task.completion_status === 'NOT_APPLICABLE').length,
      audit_closed: taskStates.filter(task => task.audit_closed).length,
    },
    tasks: taskStates,
    blockers,
    next_action:
      status === 'CLOSED_VERIFIED' ? 'No further Project 4 action for this handoff unless project or standard revisions move.'
        : status === 'OPEN_PARTIAL' ? 'Complete remaining project work, return evidence, then run a successor v2 audit.'
          : status === 'REAUDIT_REQUIRED' ? 'Run a successor v2 audit at the completion result revision and re-check live freshness.'
            : status === 'REAUDIT_GAPS_REMAIN' ? 'Successor audit still reports unresolved handoff axes; issue a new handoff from the successor audit.'
              : 'Resolve closure blockers and re-evaluate.',
    execution_boundary: {
      auto_write_project_repo: false,
      auto_merge_project_pr: false,
      auto_promote_core_standard: false,
      auto_deploy: false,
      production_mutation: false,
    },
    rule: 'A project completion report is not closure. CLOSED_VERIFIED requires a successor v2 audit at the returned result revision, current AI Core audit baseline, live CURRENT freshness, and no unresolved implementation/discovery verdict on the original handoff axes.',
  };
}


export function renderProjectAuditClosureMarkdown(receipt) {
  need(receipt?.schema === 'ai-core-project-audit-closure-receipt/v1', 'AUDIT_CLOSURE_RECEIPT_SCHEMA_INVALID');

  const lines = [
    `# Project Audit Closure — ${receipt.project_id}`,
    '',
    `Status: **${receipt.status}**`,
    '',
    '## Binding',
    '',
    `- handoff revision: \`${receipt.handoff_binding.subject_revision}\``,
    `- completion revision: \`${receipt.completion_binding.result_revision}\``,
    `- standard baseline: \`${receipt.handoff_binding.standard_baseline_revision}\``,
    `- successor audit: ${receipt.successor_audit_binding ? `\`${receipt.successor_audit_binding.subject_revision}\` / ${receipt.successor_audit_binding.live_status}` : 'not yet available'}`,
    '',
    '## Task closure',
    '',
  ];

  for (const task of receipt.tasks) {
    lines.push(
      `### ${task.axis} — ${task.bucket}`,
      '',
      `- completion: \`${task.completion_status}\``,
      `- re-audit verdict: \`${task.re_audit_verdict ?? 'NOT_AUDITED'}\``,
      `- audit closed: \`${task.audit_closed}\``,
      `- summary: ${task.summary}`,
      ...(task.remaining_gaps.length ? ['- remaining gaps:', ...task.remaining_gaps.map(gap => `  - ${gap}`)] : []),
      '',
    );
  }

  lines.push(
    '## Counts',
    '',
    `- tasks: ${receipt.counts.tasks}`,
    `- done: ${receipt.counts.done}`,
    `- partial: ${receipt.counts.partial}`,
    `- not done: ${receipt.counts.not_done}`,
    `- audit closed: ${receipt.counts.audit_closed}`,
    '',
    '## Next action',
    '',
    receipt.next_action,
  );

  if (receipt.blockers.length) {
    lines.push('', '## Blockers', '', ...receipt.blockers.map(blocker => `- ${blocker}`));
  }

  lines.push(
    '',
    '## Execution boundary',
    '',
    '- no automatic project write',
    '- no automatic project merge',
    '- no automatic Core promotion',
    '- no deployment',
    '- no production mutation',
  );

  return lines.join('\n') + '\n';
}
