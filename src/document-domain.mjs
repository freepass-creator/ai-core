const TEMPLATE_RULES = [
  ['contract_terms', /(약관|terms)/i, 'terms'],
  ['contract', /(계약서|전자계약|contract)/i, 'contract'],
  ['proposal', /(제안서|proposal)/i, 'proposal'],
  ['weekly_report', /(주간.*보고|weekly)/i, 'weekly'],
  ['internal_report', /(내부.*보고|업무.*보고)/i, 'internal'],
  ['meeting_note', /(회의|논의.*정리)/i, 'meeting'],
  ['decision_memo', /(의사결정|결정.*메모)/i, 'decision'],
  ['project_progress', /(진행.*보고|프로젝트.*진행)/i, 'progress'],
  ['project_plan', /(기획안|프로젝트.*기획)/i, 'project'],
  ['strategy_review', /(전략.*리뷰|전략.*보고)/i, 'strategy'],
  ['performance_review', /(실적.*리뷰|사업.*실적)/i, 'performance'],
  ['issue_report', /(이슈.*보고|사고.*보고)/i, 'issue'],
  ['general_memo', /(정리|메모|보고서|문서)/i, 'general']
];

export function classifyDocumentTask(task={}) {
  const goal = String(task.goal ?? '');
  for (const [type, pattern, template_id] of TEMPLATE_RULES) {
    if (pattern.test(goal)) return {type, template_id};
  }
  return {type:'general_document', template_id:'general'};
}

export function documentSourcePlan(task={}) {
  const profile = classifyDocumentTask(task);
  return {
    profile,
    content_sources:[
      {owner:'project', required:Boolean(task.project), role:'CONTENT_SSOT'},
      {owner:'aiops', required:Boolean(task.needs_business_context || task.needs_prior_decisions), role:'CONTENT_CONTEXT'}
    ],
    design_sources:[
      {owner:'devcenter', scope:`doc.template.${profile.type}`, role:'CAPABILITY_REGISTRY', required:true},
      {owner:'docshub', template_id:profile.template_id, role:'DOCUMENT_DESIGN_SSOT', required:true}
    ]
  };
}

export function documentExecutionRoute(task={}) {
  const consequential = task.risk === 'D' || task.authority_required || task.external_effect && task.external_effect !== 'none';
  if (consequential) return 'HUMAN_GATE';
  const renderHeavy = Boolean(task.needs_pdf || task.needs_pagination_check || task.needs_browser_render || task.template_change || Number(task.page_count_estimate ?? 1) > 1);
  return renderHeavy ? 'WORK_CODEX' : 'GPT_DIRECT';
}

export function documentVerificationPlan(task={}) {
  const checks=['content_sources_bound','done_when_present','template_revision_bound'];
  if (task.needs_pdf || task.needs_browser_render || task.needs_pagination_check || Number(task.page_count_estimate ?? 1) > 1) {
    checks.push('layout_render_check','overflow_check','pagination_check');
  }
  if (task.needs_pdf) checks.push('pdf_output_check');
  if (task.domain === 'legal' || task.legal_document) checks.push('source_freshness_check','human_legal_review_if_consequential');
  return {content_pass_separate:true, layout_pass_separate:true, checks:[...new Set(checks)]};
}

export function documentWorkPacket(task={}) {
  const sources=documentSourcePlan(task);
  return {
    task_type:'document',
    profile:sources.profile,
    source_plan:sources,
    execution_route:documentExecutionRoute(task),
    verification:documentVerificationPlan(task),
    invariants:[
      'CONTENT_AND_LAYOUT_PASS_MUST_BE_SEPARATE',
      'DOCSHUB_TEMPLATE_MUST_BE_REVISION_BOUND',
      'PROJECT_CONTENT_SSOT_MUST_NOT_BE_COPIED_INTO_DOCSHUB',
      'NO_EXTERNAL_SUBMISSION_AUTHORITY_GRANTED'
    ],
    authorization:'NOT_GRANTED'
  };
}
