const HIGH_STAKES = new Set(['legal','finance','health','safety']);

export function inferDomain(goal='') {
  const s=String(goal).toLowerCase();
  if (/(소송|고소|법률|법원|계약 분쟁|판례)/.test(s)) return 'legal';
  if (/(보고서|문서|pdf|계약서|제안서)/.test(s)) return 'document';
  if (/(여행|숙소|항공|호텔|일정 여행)/.test(s)) return 'travel';
  if (/(워크숍|워크샵|세미나|행사|회의 진행)/.test(s)) return 'workshop';
  if (/(개발|코드|erp|앱|웹|ui|ux)/.test(s)) return 'development';
  if (/(사업|전략|수익|운영|영업)/.test(s)) return 'business';
  return 'general';
}

export function buildIntentEnvelope(input={}) {
  if (!input.goal) throw new Error('goal is required');
  const domain=input.domain ?? inferDomain(input.goal);
  return {
    goal:String(input.goal).trim(),
    desired_outcome:input.desired_outcome ?? null,
    domain,
    deadline:input.deadline ?? null,
    stakeholders:input.stakeholders ?? [],
    constraints:input.constraints ?? [],
    preferences:input.preferences ?? [],
    resources:input.resources ?? [],
    authority:input.authority ?? 'ADVISE_ONLY',
    known:input.known ?? {},
    unknowns:input.unknowns ?? []
  };
}

export function scoreQuestion(q={}) {
  const impact=Number(q.decision_impact ?? 0);
  const irreversibility=Number(q.irreversibility ?? 0);
  const uncertainty=Number(q.uncertainty ?? 0);
  const effort=Math.max(Number(q.user_effort ?? 1),1);
  return (impact * irreversibility * uncertainty) / effort;
}

export function questionGate(question={}) {
  const externallyResolvable=question.externally_resolvable === true;
  const alreadyKnown=question.already_known === true;
  const changesDecision=question.changes_decision !== false;
  const preferenceNeeded=question.user_preference_required === true;
  if (alreadyKnown) return {ask:false,reason:'ALREADY_KNOWN',score:0};
  if (externallyResolvable && !preferenceNeeded) return {ask:false,reason:'RESOLVE_WITH_SOURCE_FIRST',score:scoreQuestion(question)};
  if (!changesDecision && !preferenceNeeded) return {ask:false,reason:'LOW_DECISION_VALUE',score:scoreQuestion(question)};
  return {ask:true,reason:preferenceNeeded?'USER_JUDGMENT_REQUIRED':'DECISION_CHANGING_UNKNOWN',score:scoreQuestion(question)};
}

export function prioritizeQuestions(questions=[] , max=3) {
  return questions.map(q=>({...q,...questionGate(q)})).filter(x=>x.ask).sort((a,b)=>b.score-a.score).slice(0,max);
}

export function proactivityLevel(task={}) {
  if (task.monitor_requested) return 'P4_MONITOR';
  if (task.execution_requested) return 'P3_COORDINATE';
  if (task.artifact_requested) return 'P2_PREPARE';
  if (task.guidance_requested !== false) return 'P1_ADVISE';
  return 'P0_ANSWER';
}

export function domainChecklist(domain) {
  const common=['goal','desired_outcome','critical_constraints','done_when'];
  const map={
    legal:[...common,'procedure_and_deadlines','fact_claim_evidence_separation','official_law_freshness','options_and_risks','filing_authority'],
    document:[...common,'audience','content_ssot','document_type','template_revision','content_verification','layout_pdf_verification'],
    travel:[...common,'dates','party','budget_or_comfort','mobility_constraints','booking_dependencies','contingency'],
    workshop:[...common,'participants','decision_topics','prework','agenda','facilitation','action_items','follow_up'],
    development:[...common,'project_revision','existing_assets','build_test_needs','regression','handoff'],
    business:[...common,'facts_vs_assumptions','economics','cashflow','stakeholders','decision_options','outcome_measure']
  };
  return map[domain] ?? common;
}

export function humanOrchestrationPlan(input={}, questions=[]) {
  const intent=buildIntentEnvelope(input);
  const tier=HIGH_STAKES.has(intent.domain) ? 'HIGH_STAKES' : 'NORMAL';
  return {
    intent,
    proactivity:proactivityLevel(input),
    domain_checklist:domainChecklist(intent.domain),
    questions_to_ask:prioritizeQuestions(questions, tier==='HIGH_STAKES'?5:3),
    universal_lifecycle:['UNDERSTAND','ADVISE','PLAN','PREPARE','EXECUTE','VERIFY','FOLLOW_UP','LEARN'],
    operating_rule:'ASK_ONLY_DECISION_CHANGING_QUESTIONS; RESOLVE_KNOWN_OR_SOURCEABLE_CONTEXT_FIRST',
    authorization:'NOT_GRANTED'
  };
}
