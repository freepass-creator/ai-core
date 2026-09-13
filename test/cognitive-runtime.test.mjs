import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGoalGraph, reconcileWorldState, identifyDecisionGaps, chooseMinimumNextAction, compilePlanSlice, cognitiveCycle } from '../src/cognitive-runtime.mjs';

test('goal without done condition holds',()=>{
  assert.equal(buildGoalGraph({goal:'ERP 개선'}).status,'HOLD');
});

test('conflicting world observations create source conflict',()=>{
  const w=reconcileWorldState([
    {key:'schema',value:'v1',source:'A',revision:'1',fresh:true},
    {key:'schema',value:'v2',source:'B',revision:'2',fresh:true}
  ]);
  assert.ok(w.findings.includes('SOURCE_CONFLICT:schema'));
});

test('stale source creates freshness gap',()=>{
  const w=reconcileWorldState([{key:'policy',value:'x',source:'A',revision:'1',fresh:false}]);
  assert.ok(w.findings.includes('FRESHNESS_GAP:policy'));
});

test('missing required fact is explicit decision gap',()=>{
  const g=buildGoalGraph({goal:'x',done_when:['y']});
  const w=reconcileWorldState([]);
  const gaps=identifyDecisionGaps({goalGraph:g,worldState:w,requiredFacts:['current_sha']});
  assert.deepEqual(gaps,[{type:'MISSING_REQUIRED_FACT',key:'current_sha'}]);
});

test('planner prefers action closing more gaps with lower risk',()=>{
  const out=chooseMinimumNextAction({
    gaps:[{type:'MISSING_REQUIRED_FACT',key:'sha'}],
    candidates:[
      {id:'wide',closes_gaps:['MISSING_REQUIRED_FACT:sha'],evidence_value:1,cost:10,risk:2,reversible:true},
      {id:'small',closes_gaps:['MISSING_REQUIRED_FACT:sha'],evidence_value:1,cost:1,risk:0,reversible:true}
    ]
  });
  assert.equal(out.action.id,'small');
  assert.equal(out.authorization,'NOT_GRANTED');
});

test('authority-sensitive candidate is not selected autonomously',()=>{
  const out=chooseMinimumNextAction({gaps:[],candidates:[{id:'deploy',authorization_required:true,reversible:false}]});
  assert.equal(out.status,'HOLD');
});

test('plan slice contains only revision-bound sources',()=>{
  const p=compilePlanSlice({task:{task_id:'T1',goal:'x',done_when:['y']},sources:[
    {location:'repo:a',revision_or_sha:'abc'},
    {location:'repo:b'}
  ]});
  assert.deepEqual(p.source_revision_set,[{location:'repo:a',sha:'abc'}]);
  assert.equal(p.authorization,'NOT_GRANTED');
});

test('cognitive cycle never grants execution authority',()=>{
  const out=cognitiveCycle({task:{goal:'x',done_when:['y']},candidates:[{id:'inspect',reversible:true,cost:1,risk:0}]});
  assert.equal(out.authorization,'NOT_GRANTED');
});
