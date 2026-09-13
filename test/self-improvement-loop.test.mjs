import test from 'node:test';
import assert from 'node:assert/strict';
import { proposeImprovement, evaluateImprovement, compareOutcome } from '../src/self-improvement-loop.mjs';

test('proposal never grants execution authority',()=>{
  const c=proposeImprovement({problem:'duplicate context',previous_failure:'same files reread',proposed_change:'cache source pointers',type:'context routing'});
  assert.equal(c.authorization,'NOT_GRANTED');
  assert.equal(c.destination,'AI_CORE');
});

test('unproven improvement is rejected',()=>{
  const c=proposeImprovement({problem:'x',previous_failure:'y',proposed_change:'z'});
  const r=evaluateImprovement(c,{failure_reproduced:true,candidate_prevents_failure:false,independent_review:true});
  assert.equal(r.stage,'REJECT_OR_REWORK');
});

test('sensitive scope always requires human gate',()=>{
  const c=proposeImprovement({problem:'x',previous_failure:'y',proposed_change:'z',target_scope:'permissions'});
  const r=evaluateImprovement(c,{failure_reproduced:true,candidate_prevents_failure:true,independent_review:true,shadow_validated:true});
  assert.ok(r.findings.includes('HUMAN_GATE_REQUIRED'));
  assert.equal(r.auto_promote,false);
});

test('verified candidate progresses but never auto-promotes',()=>{
  const c=proposeImprovement({problem:'x',previous_failure:'y',proposed_change:'z',type:'test tooling'});
  const r=evaluateImprovement(c,{failure_reproduced:true,candidate_prevents_failure:true,independent_review:true});
  assert.equal(r.stage,'INDEPENDENTLY_VERIFIED');
  assert.equal(r.auto_promote,false);
  assert.equal(r.destination,'DEVCENTER');
});

test('outcome comparison reports raw deltas only',()=>{
  const o=compareOutcome({rework_count:3,work_execution_count:4,first_pass_success:false},{rework_count:1,work_execution_count:2,first_pass_success:true});
  assert.equal(o.delta.rework_count,-2);
  assert.equal(o.delta.work_execution_count,-2);
  assert.equal(o.delta.first_pass_success,1);
  assert.equal(o.interpretation,'observed_delta_only');
});
