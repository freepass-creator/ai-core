const PROTECTED_INVARIANTS = Object.freeze([
  'AUTHORITY_SEPARATE_FROM_VERIFICATION',
  'NO_FALSE_PASS',
  'NO_SILENT_STALE_SOURCE_REUSE',
  'NO_RESEARCH_AUTO_ADOPTION'
]);

export function buildGoalGraph(task={}) {
  const goal = String(task.goal ?? '').trim();
  if (!goal) return {status:'HOLD', findings:['MISSING_GOAL'], nodes:[]};
  const done = Array.isArray(task.done_when) ? task.done_when.filter(Boolean) : [];
  const root = {
    id: task.goal_id ?? 'G-ROOT',
    type:'GOAL',
    objective:goal,
    done_when:done,
    constraints:task.constraints ?? [],
    priority:task.priority ?? 'NORMAL'
  };
  return {status:done.length ? 'READY' : 'HOLD', findings:done.length?[]:['MISSING_DONE_CONDITION'], nodes:[root]};
}

export function reconcileWorldState(observations=[]) {
  const byKey = new Map();
  const findings=[];
  for (const raw of observations) {
    const o={...raw};
    if (!o.key || !o.source || !o.revision) {
      findings.push(`INVALID_OBSERVATION:${o.key ?? 'unknown'}`);
      continue;
    }
    const list=byKey.get(o.key) ?? [];
    list.push(o);
    byKey.set(o.key,list);
  }
  const state=[];
  for (const [key,list] of byKey) {
    const values=[...new Set(list.map(x=>JSON.stringify(x.value)))];
    const conflict=values.length>1;
    if (conflict) findings.push(`SOURCE_CONFLICT:${key}`);
    const stale=list.some(x=>x.fresh===false);
    if (stale) findings.push(`FRESHNESS_GAP:${key}`);
    state.push({key,observations:list,conflict,stale});
  }
  return {status:findings.length?'ATTENTION':'READY', state, findings};
}

export function identifyDecisionGaps({goalGraph, worldState, requiredFacts=[]}={}) {
  const gaps=[];
  if (!goalGraph || goalGraph.status==='HOLD') gaps.push({type:'PLAN_DEPENDENCY_BLOCK', key:'goal'});
  const known=new Set((worldState?.state ?? []).filter(x=>!x.conflict&&!x.stale).map(x=>x.key));
  for (const fact of requiredFacts) if (!known.has(fact)) gaps.push({type:'MISSING_REQUIRED_FACT',key:fact});
  for (const f of worldState?.findings ?? []) {
    if (f.startsWith('SOURCE_CONFLICT:')) gaps.push({type:'SOURCE_CONFLICT',key:f.split(':')[1]});
    if (f.startsWith('FRESHNESS_GAP:')) gaps.push({type:'FRESHNESS_GAP',key:f.split(':')[1]});
  }
  return gaps;
}

export function chooseMinimumNextAction({gaps=[], candidates=[]}={}) {
  const eligible=candidates.filter(c=>c && c.reversible!==false && c.authorization_required!==true);
  if (!eligible.length) return {status:'HOLD',reason:'NO_REVERSIBLE_AUTHORITY_SAFE_ACTION',authorization:'NOT_GRANTED'};
  const gapKeys=new Set(gaps.map(g=>`${g.type}:${g.key}`));
  const scored=eligible.map(c=>{
    const closes=(c.closes_gaps ?? []).filter(x=>gapKeys.has(x)).length;
    const evidence=Number(c.evidence_value ?? 0);
    const cost=Number(c.cost ?? 1);
    const risk=Number(c.risk ?? 0);
    return {...c,_score:closes*100+evidence*10-cost-risk*20};
  }).sort((a,b)=>b._score-a._score);
  const best=scored[0];
  return {status:'PLAN_READY',action:strip(best),authorization:'NOT_GRANTED',principle:'MINIMUM_REVERSIBLE_DECISION_GAP_REDUCTION'};
}

export function compilePlanSlice({task={}, sources=[], action=null, uncertainties=[]}={}) {
  return {
    goal_node:task.goal_id ?? 'G-ROOT',
    task_id:task.task_id ?? null,
    objective:task.goal ?? null,
    allowed_scope:task.constraints ?? [],
    forbidden_scope:task.forbidden_scope ?? [],
    source_revision_set:sources.filter(x=>x.location&&x.revision_or_sha).map(x=>({location:x.location,sha:x.revision_or_sha})),
    done_when:task.done_when ?? [],
    evidence_required:task.evidence_required ?? ['subject_revision','checks_executed','failures_and_skips','review_status'],
    known_uncertainties:uncertainties,
    planned_action:action,
    handoff_return:['commit_sha','checks','failures','skips','residual_risk'],
    invariant_kernel:[...PROTECTED_INVARIANTS],
    authorization:'NOT_GRANTED'
  };
}

export function cognitiveCycle(input={}) {
  const goalGraph=buildGoalGraph(input.task ?? {});
  const worldState=reconcileWorldState(input.observations ?? []);
  const gaps=identifyDecisionGaps({goalGraph,worldState,requiredFacts:input.required_facts ?? []});
  const next=chooseMinimumNextAction({gaps,candidates:input.candidates ?? []});
  const status=goalGraph.status==='HOLD' || next.status==='HOLD' ? 'HOLD' : gaps.length ? 'PLAN_READY' : 'READY';
  return {
    runtime_version:'0.1-candidate',
    status,
    invariant_kernel:[...PROTECTED_INVARIANTS],
    goal_graph:goalGraph,
    world_state:worldState,
    decision_gaps:gaps,
    next_action:next,
    authorization:'NOT_GRANTED'
  };
}

function strip(x){const {_score,...rest}=x;return rest;}
