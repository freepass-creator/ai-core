import { validateProjectAuditResult } from './project-audit-result.mjs';

const need = (condition, code) => { if (!condition) throw new Error(code); };

const AXIS_OWNER = Object.freeze({
  'ui-ux': { lane: 'B', owner: 'Global UI/UX Standard' },
  'data-ssot': { lane: 'C', owner: 'Core Contract Standard' },
  'engine-adapter': { lane: 'C', owner: 'Core Contract Standard' },
  'api-event-error': { lane: 'C', owner: 'Core Contract Standard' },
  'workflow': { lane: 'D', owner: 'Workflow Standard' },
  'security-audit': { lane: 'SECURITY', owner: 'Security/Audit Standard' },
  'qa-observability': { lane: 'QA', owner: 'QA/Observability Standard' },
  'build-deploy-governance': { lane: 'GOVERNANCE', owner: 'Build/Deploy/Governance Standard' },
});

function taskFromFinding(finding) {
  const owner = AXIS_OWNER[finding.axis];
  need(owner, `AUDIT_HANDOFF_AXIS_OWNER_MISSING:${finding.axis}`);

  const base = {
    axis: finding.axis,
    verdict: finding.verdict,
    standard_owner: owner,
    evidence: [...finding.evidence],
    gaps: [...finding.gaps],
    next_action: finding.next_action,
  };

  if (finding.verdict === 'MIGRATION_GAP') {
    return {
      bucket: 'PROJECT_IMPLEMENTATION',
      priority: 'P1',
      ...base,
      instruction: finding.next_action,
    };
  }

  if (finding.verdict === 'UNKNOWN') {
    return {
      bucket: 'PROJECT_DISCOVERY',
      priority: 'P2',
      ...base,
      instruction: `Establish revision-bound evidence before implementation. ${finding.next_action}`,
    };
  }

  if (finding.verdict === 'PROJECT_AHEAD') {
    return {
      bucket: 'CORE_CANDIDATE_REVIEW',
      priority: 'P2',
      ...base,
      instruction: 'Route this project evidence to the standard owner for possible generalization. Do not promote it automatically.',
    };
  }

  if (finding.verdict === 'RESEARCH_ADVISORY') {
    return {
      bucket: 'STANDARD_RESEARCH',
      priority: 'P3',
      ...base,
      instruction: 'Keep this as advisory standard research. It is not a project conformance defect.',
    };
  }

  return {
    bucket: 'NO_PROJECT_ACTION',
    priority: 'NONE',
    ...base,
    instruction: 'No project remediation is requested from this audit finding.',
  };
}

export function buildProjectAuditHandoffPacket({
  result,
  readinessRegistry,
  liveFreshness = null,
}) {
  validateProjectAuditResult(result, readinessRegistry);
  need(result.schema === 'ai-core-project-audit-result/v2', 'AUDIT_HANDOFF_V2_REQUIRED');

  const baselineCurrent = result.standard_baseline_revision === readinessRegistry.baseline_revision;
  const liveStatus = liveFreshness?.status ?? 'UNOBSERVED';
  const stale = !baselineCurrent || liveStatus === 'STALE' || liveStatus === 'HOLD';

  const tasks = result.findings.map(taskFromFinding);
  const projectImplementation = tasks.filter(item => item.bucket === 'PROJECT_IMPLEMENTATION');
  const projectDiscovery = tasks.filter(item => item.bucket === 'PROJECT_DISCOVERY');
  const coreCandidates = tasks.filter(item => item.bucket === 'CORE_CANDIDATE_REVIEW');
  const standardResearch = tasks.filter(item => item.bucket === 'STANDARD_RESEARCH');
  const noProjectAction = tasks.filter(item => item.bucket === 'NO_PROJECT_ACTION');

  return {
    schema: 'ai-core-project-audit-handoff/v1',
    status: stale ? 'HOLD_STALE_AUDIT' : 'READY',
    project_id: result.project_id,
    repository: result.repository,
    default_branch: result.source_proof.default_branch,
    audit_binding: {
      subject_revision: result.subject_revision,
      standard_baseline_revision: result.standard_baseline_revision,
      audited_at: result.audited_at,
      ci_status: result.source_proof.ci.status,
      ci_run_id: result.source_proof.ci.run_id,
      branch_protected: result.source_proof.branch_protected,
      live_status: liveStatus,
      live_revision: liveFreshness?.project_revision?.live ?? null,
    },
    counts: {
      project_implementation: projectImplementation.length,
      project_discovery: projectDiscovery.length,
      core_candidate_review: coreCandidates.length,
      standard_research: standardResearch.length,
      no_project_action: noProjectAction.length,
    },
    project_work: {
      implementation: projectImplementation,
      discovery: projectDiscovery,
    },
    standard_work: {
      core_candidate_review: coreCandidates,
      research: standardResearch,
    },
    no_project_action: noProjectAction,
    execution_boundary: {
      auto_write_project_repo: false,
      auto_open_project_pr: false,
      auto_promote_core_standard: false,
      auto_deploy: false,
      production_mutation: false,
    },
    blockers: stale
      ? [
          ...(baselineCurrent ? [] : ['STANDARD_BASELINE_STALE']),
          ...(liveStatus === 'STALE' ? ['PROJECT_REVISION_STALE'] : []),
          ...(liveStatus === 'HOLD' ? ['LIVE_FRESHNESS_HOLD'] : []),
        ]
      : [],
    rule: 'Project implementation work comes only from MIGRATION_GAP findings. UNKNOWN creates discovery work, PROJECT_AHEAD routes evidence to the standard owner, and CORE_MATCH never creates a project remediation task. A stale audit cannot authorize handoff execution.',
  };
}


export function renderProjectAuditHandoffMarkdown(packet) {
  need(packet?.schema === 'ai-core-project-audit-handoff/v1', 'AUDIT_HANDOFF_PACKET_SCHEMA_INVALID');

  const lines = [
    `# Project Audit Handoff — ${packet.project_id}`,
    '',
    `Status: **${packet.status}**`,
    '',
    '## Revision binding',
    '',
    `- repository: \`${packet.repository}\``,
    `- branch: \`${packet.default_branch}\``,
    `- subject revision: \`${packet.audit_binding.subject_revision}\``,
    `- AI Core standard baseline: \`${packet.audit_binding.standard_baseline_revision}\``,
    `- audited at: \`${packet.audit_binding.audited_at}\``,
    `- CI: \`${packet.audit_binding.ci_status}\`${packet.audit_binding.ci_run_id ? ` (run ${packet.audit_binding.ci_run_id})` : ''}`,
    `- live freshness: \`${packet.audit_binding.live_status}\``,
    '',
    '## Project implementation',
    '',
  ];

  if (!packet.project_work.implementation.length) {
    lines.push('- No project implementation task from this audit.');
  } else {
    for (const task of packet.project_work.implementation) {
      lines.push(
        `### ${task.axis} — ${task.priority}`,
        '',
        `Standard owner: **${task.standard_owner.lane} / ${task.standard_owner.owner}**`,
        '',
        task.instruction,
        '',
        'Gaps:',
        ...task.gaps.map(gap => `- ${gap}`),
        '',
      );
    }
  }

  lines.push('## Discovery', '');
  if (!packet.project_work.discovery.length) {
    lines.push('- No discovery-only task.');
  } else {
    for (const task of packet.project_work.discovery) {
      lines.push(
        `### ${task.axis} — ${task.priority}`,
        '',
        task.instruction,
        '',
        ...task.gaps.map(gap => `- ${gap}`),
        '',
      );
    }
  }

  lines.push('## Standard-owner routing', '');
  const routed = [
    ...packet.standard_work.core_candidate_review,
    ...packet.standard_work.research,
  ];
  if (!routed.length) {
    lines.push('- No project-ahead or research item requires standard-owner review.');
  } else {
    for (const task of routed) {
      lines.push(
        `- **${task.axis}** → ${task.standard_owner.lane} / ${task.standard_owner.owner}: ${task.instruction}`
      );
    }
  }

  lines.push(
    '',
    '## No-project-action axes',
    '',
    ...packet.no_project_action.map(task => `- ${task.axis}: CORE_MATCH; no remediation requested.`),
    '',
    '## Execution boundary',
    '',
    '- no automatic project write',
    '- no automatic project PR',
    '- no automatic Core promotion',
    '- no deployment',
    '- no production mutation',
  );

  if (packet.blockers.length) {
    lines.push('', '## Blockers', '', ...packet.blockers.map(item => `- ${item}`));
  }

  return lines.join('\n') + '\n';
}
