const nonempty=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const PROVENANCE=new Set(['USER_CONFIRMED','SOURCE_DERIVED','AI_INFERRED']);
const DECISION_STATUS=new Set(['CONFIRMED','PROPOSED']);

const need=(condition,code)=>{if(!condition) throw new Error(code);};
const clean=value=>String(value??'').normalize('NFKC').trim();
const uniqueStrings=values=>[...new Set((values??[]).map(clean).filter(Boolean))];

function normalizeFacts(values=[]){
  need(Array.isArray(values),'BUSINESS_FACTS_INVALID');
  return values.map((item,index)=>{
    need(item&&typeof item==='object'&&!Array.isArray(item),'BUSINESS_FACT_INVALID');
    const statement=clean(item.statement);
    const provenance=clean(item.provenance);
    need(nonempty(statement),'BUSINESS_FACT_STATEMENT_REQUIRED');
    need(PROVENANCE.has(provenance),'BUSINESS_FACT_PROVENANCE_INVALID');
    const source_ref=item.source_ref==null?null:clean(item.source_ref);
    if(provenance==='SOURCE_DERIVED') need(nonempty(source_ref),'SOURCE_DERIVED_FACT_REF_REQUIRED');
    return {fact_id:clean(item.fact_id)||`fact-${index+1}`,statement,provenance,source_ref:source_ref||null};
  });
}

function normalizeDecisions(values=[]){
  need(Array.isArray(values),'BUSINESS_DECISIONS_INVALID');
  return values.map((item,index)=>{
    need(item&&typeof item==='object'&&!Array.isArray(item),'BUSINESS_DECISION_INVALID');
    const statement=clean(item.statement);
    const status=clean(item.status);
    const provenance=clean(item.provenance);
    need(nonempty(statement),'BUSINESS_DECISION_STATEMENT_REQUIRED');
    need(DECISION_STATUS.has(status),'BUSINESS_DECISION_STATUS_INVALID');
    need(PROVENANCE.has(provenance),'BUSINESS_DECISION_PROVENANCE_INVALID');
    if(status==='CONFIRMED') need(provenance!=='AI_INFERRED','AI_INFERRED_DECISION_CANNOT_BE_CONFIRMED');
    const source_ref=item.source_ref==null?null:clean(item.source_ref);
    if(provenance==='SOURCE_DERIVED') need(nonempty(source_ref),'SOURCE_DERIVED_DECISION_REF_REQUIRED');
    return {decision_id:clean(item.decision_id)||`decision-${index+1}`,statement,status,provenance,source_ref:source_ref||null};
  });
}

function normalizeUnknowns(values=[]){
  need(Array.isArray(values),'BUSINESS_UNKNOWNS_INVALID');
  return values.map((item,index)=>{
    if(typeof item==='string') return {unknown_id:`unknown-${index+1}`,question:clean(item),decision_impact:null};
    need(item&&typeof item==='object'&&!Array.isArray(item),'BUSINESS_UNKNOWN_INVALID');
    const question=clean(item.question);
    need(nonempty(question),'BUSINESS_UNKNOWN_QUESTION_REQUIRED');
    return {
      unknown_id:clean(item.unknown_id)||`unknown-${index+1}`,
      question,
      decision_impact:clean(item.decision_impact)||null,
    };
  }).filter(item=>nonempty(item.question));
}

function normalizeOptions(values=[]){
  need(Array.isArray(values),'BUSINESS_OPTIONS_INVALID');
  return values.map((item,index)=>{
    need(item&&typeof item==='object'&&!Array.isArray(item),'BUSINESS_OPTION_INVALID');
    const label=clean(item.label);
    need(nonempty(label),'BUSINESS_OPTION_LABEL_REQUIRED');
    return {
      option_id:clean(item.option_id)||`option-${index+1}`,
      label,
      description:clean(item.description)||null,
      tradeoffs:uniqueStrings(item.tradeoffs),
    };
  });
}

export function buildBusinessPlanningFrame(input={}){
  need(input&&typeof input==='object'&&!Array.isArray(input),'BUSINESS_PLANNING_INPUT_INVALID');
  const objective=clean(input.objective);
  need(nonempty(objective),'BUSINESS_OBJECTIVE_REQUIRED');

  const facts=normalizeFacts(input.facts);
  const decisions=normalizeDecisions(input.decisions);
  const unknowns=normalizeUnknowns(input.unknowns);
  const options=normalizeOptions(input.options);
  const constraints=uniqueStrings(input.constraints);
  const sourceRefs=uniqueStrings(input.source_refs);

  for(const fact of facts) if(fact.source_ref) sourceRefs.push(fact.source_ref);
  for(const decision of decisions) if(decision.source_ref) sourceRefs.push(decision.source_ref);

  const confirmed=decisions.filter(item=>item.status==='CONFIRMED');
  const proposed=decisions.filter(item=>item.status==='PROPOSED');
  const inferredFacts=facts.filter(item=>item.provenance==='AI_INFERRED');

  return {
    schema:'ai-core-business-planning-frame/v1',
    objective,
    facts,
    decisions:{confirmed,proposed},
    unknowns,
    constraints,
    options,
    source_refs:[...new Set(sourceRefs)],
    readiness:{
      status:unknowns.length?'NEEDS_DECISIONS':'READY_FOR_REVIEW',
      confirmed_decision_count:confirmed.length,
      proposed_decision_count:proposed.length,
      unknown_count:unknowns.length,
      inferred_fact_count:inferredFacts.length,
    },
    invariants:{
      recommendation_selected:false,
      external_action_authorized:false,
      confirmed_ai_inferred_decisions:0,
    },
  };
}

export async function aiCoreBusinessPlanning(input={}){
  try{
    const frame=buildBusinessPlanningFrame(input);
    return {
      status:'SUCCEEDED',
      summary:frame.readiness.status==='NEEDS_DECISIONS'
        ?`사업기획 판단틀을 정리했습니다. 미확정 ${frame.readiness.unknown_count}건이 남아 있습니다.`
        :'사업기획 판단틀을 정리했습니다. 현재 입력 기준으로 검토 가능한 상태입니다.',
      data:frame,
      evidence:frame.source_refs.map(ref=>`SOURCE: ${ref}`),
      artifacts:[],
      checks:[
        {name:'business-planning.provenance',status:'PASS',detail:`inferred_facts=${frame.readiness.inferred_fact_count}`},
        {name:'business-planning.decision-boundary',status:'PASS',detail:'AI_INFERRED cannot be CONFIRMED'},
      ],
      blockers:[],
      next_action:frame.unknowns.length?'미확정 항목 중 의사결정에 영향을 주는 것부터 확인합니다.':null,
      external_effect:false,
    };
  }catch(error){
    return {
      status:'HOLD',
      summary:'사업기획 입력 계약을 만족하지 못했습니다.',
      data:null,
      evidence:[],
      artifacts:[],
      checks:[{name:'business-planning.input',status:'FAIL',detail:error?.message??'BUSINESS_PLANNING_INPUT_INVALID'}],
      blockers:[error?.message??'BUSINESS_PLANNING_INPUT_INVALID'],
      next_action:'목적과 사실/결정의 provenance를 구분해 입력합니다.',
      external_effect:false,
    };
  }
}
