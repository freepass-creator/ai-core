import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planReverseCompensation, resolveCompensationOutcome } from '../src/workflow/compensation.mjs';
import { validateWorkflowCompensationPolicies } from '../scripts/validate-workflow-compensation-policies.mjs';

const registry=JSON.parse(await readFile(new URL('../registry/workflow-compensation-policies.json',import.meta.url),'utf8'));

test('compensation policy registry remains project-verified pilot',async()=>{
  const result=await validateWorkflowCompensationPolicies(registry);
  assert.equal(result.status,'VALID',JSON.stringify(result.errors));
  const policy=registry.policies[0];
  assert.equal(policy.policy_id,'workflow.compensated-multiwrite');
  assert.equal(policy.adoption_status,'PILOT');
  assert.equal(policy.evidence_level,'PROJECT_VERIFIED');
  assert.deepEqual(policy.source_projects,['renman']);
});

test('only applied effects are compensated and required compensations run in reverse order',()=>{
  const effects=[
    {effect_id:'a',compensation_mode:'REQUIRED',compensation_action:'undo.a'},
    {effect_id:'b',compensation_mode:'REQUIRED',compensation_action:'undo.b'},
    {effect_id:'c',compensation_mode:'REQUIRED',compensation_action:'undo.c'}
  ];
  const plan=planReverseCompensation({effects,applied_effect_ids:['a','b']});
  assert.deepEqual(plan.steps,[{effect_id:'b',action:'undo.b'},{effect_id:'a',action:'undo.a'}]);
});

test('non-compensated applied effect must carry an explicit domain reason',()=>{
  const plan=planReverseCompensation({
    effects:[
      {effect_id:'a',compensation_mode:'NOT_REQUIRED',non_compensated_reason:'append-only audit event remains as history'},
      {effect_id:'b',compensation_mode:'REQUIRED',compensation_action:'undo.b'}
    ],
    applied_effect_ids:['a','b']
  });
  assert.deepEqual(plan.steps,[{effect_id:'b',action:'undo.b'}]);
  assert.equal(plan.retained_effects[0].effect_id,'a');
});

test('successful compensation preserves and rethrows the original failure',()=>{
  const plan={steps:[{effect_id:'b',action:'undo.b'},{effect_id:'a',action:'undo.a'}],retained_effects:[]};
  const outcome=resolveCompensationOutcome({
    original_error_code:'SECOND_WRITE_FAILED',plan,
    compensation_results:[{effect_id:'b',status:'SUCCEEDED'},{effect_id:'a',status:'SUCCEEDED'}]
  });
  assert.equal(outcome.status,'COMPENSATED');
  assert.equal(outcome.action,'RETHROW_ORIGINAL_FAILURE');
  assert.equal(outcome.original_error_code,'SECOND_WRITE_FAILED');
});

test('failed or missing compensation escalates explicit partial state',()=>{
  const plan={steps:[{effect_id:'b',action:'undo.b'},{effect_id:'a',action:'undo.a'}],retained_effects:[]};
  const outcome=resolveCompensationOutcome({
    original_error_code:'THIRD_WRITE_FAILED',plan,
    compensation_results:[{effect_id:'b',status:'FAILED',error_code:'UNDO_B_FAILED'}]
  });
  assert.equal(outcome.status,'PARTIAL_STATE');
  assert.equal(outcome.action,'ESCALATE');
  assert.deepEqual(outcome.missing_compensations,['a']);
  assert.equal(outcome.failed_compensations[0].effect_id,'b');
});
