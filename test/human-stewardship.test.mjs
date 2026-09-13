import test from 'node:test';
import assert from 'node:assert/strict';
import { stewardshipGate, foresightPlan, nextBestAction, followThroughPlan, stewardshipPlan } from '../src/human-stewardship.mjs';

test('does not execute when user value judgment was assumed',()=>{
  const g=stewardshipGate({request:{goal:'choose',desired_outcome:'best option',requires_user_value_judgment:true,assumed_value_choice:true}});
  assert.equal(g.status,'REFRAME_OR_ESCALATE');
  assert.equal(g.should_execute_now,false);
});

test('portfolio conflict is detected before adding more work',()=>{
  const g=stewardshipGate({request:{goal:'new project',desired_outcome:'launch'},portfolio:{active_commitments:[1,2,3],capacity_limit:3}});
  assert.ok(g.findings.includes('PORTFOLIO_CAPACITY_CONFLICT'));
});

test('irreversible step without rollback is blocked',()=>{
  const g=stewardshipGate({request:{goal:'change',desired_outcome:'done',irreversible:true}});
  assert.ok(g.findings.includes('NO_ROLLBACK_FOR_IRREVERSIBLE_STEP'));
  assert.equal(g.status,'REFRAME_OR_ESCALATE');
});

test('high impact work requires evidence plan',()=>{
  const g=stewardshipGate({request:{goal:'legal decision',desired_outcome:'prepared',domain:'legal'}});
  assert.ok(g.findings.includes('HIGH_IMPACT_WITHOUT_EVIDENCE_PLAN'));
});

test('foresight stays light for simple reversible task',()=>{
  assert.equal(foresightPlan({domain:'general'}).depth,'LIGHT');
});

test('foresight deepens for uncertainty',()=>{
  const p=foresightPlan({high_uncertainty:true});
  assert.equal(p.depth,'DEEP');
  assert.equal(p.forecasts_are_facts,false);
});

test('next action prefers decision value per burden',()=>{
  const r=nextBestAction({actions:[
    {id:'ask-long',decision_impact:8,information_gain:6,user_effort:8,execution_cost:1},
    {id:'check-source',decision_impact:7,information_gain:6,user_effort:1,execution_cost:1}
  ]});
  assert.equal(r.action.id,'check-source');
});

test('follow through remains open until outcome observed',()=>{
  assert.equal(followThroughPlan({outcome_observed:false}).status,'FOLLOW_UP_REQUIRED');
  assert.equal(followThroughPlan({outcome_observed:true}).status,'COMPLETE');
});

test('plan never grants execution authority',()=>{
  const p=stewardshipPlan({request:{goal:'draft',desired_outcome:'draft ready'}});
  assert.equal(p.gate.authorization,'NOT_GRANTED');
  assert.equal(p.gate.preserve_agency,true);
});
