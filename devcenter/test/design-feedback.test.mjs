import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveDesignResult,finalizeDesignAdoptionReceipt,validateFeedback} from '../scripts/design-feedback.mjs';

test('design source receipt can be HOLD while source-level checks pass',()=>{
  const receipt=finalizeDesignAdoptionReceipt({
    subject:{project_id:'x',repository:'freepass-creator/x',revision:'1'.repeat(40),surface_id:'s'},
    authority:{approval_status:'USER_APPROVED',evidence_ref:'approval/1'},
    ai_core:{revision:'2'.repeat(40)},
    design_hub_revision:'3'.repeat(40),
    checks:[
      {id:'A',status:'PASS',evidence:['src/a']},
      {id:'B',status:'HOLD',evidence:['qa/b'],remediation:'render',recheck:'capture'}
    ],
    source_blobs:{'a':'4'.repeat(40)}
  },{createdAt:'2026-09-21T00:00:00.000Z'});
  assert.equal(receipt.result.status,'HOLD');
  assert.match(receipt.receipt_id,/^dar_[a-f0-9]{24}$/);
});

test('feedback separates shared adoption from local-only decisions',()=>{
  const registry={contract:'devcenter-design-feedback/v1',entries:[
    {id:'shared',decision:'ADOPT',source:{revision:'1'.repeat(40)},evidence:['e'],rule:'shared'},
    {id:'local',decision:'HOLD_LOCAL',source:{revision:'1'.repeat(40)},evidence:['e'],rule:'local'}
  ]};
  assert.deepEqual(validateFeedback(registry),[]);
});

test('feedback without evidence fails',()=>{
  const registry={contract:'devcenter-design-feedback/v1',entries:[
    {id:'bad',decision:'ADOPT',source:{revision:'1'.repeat(40)},evidence:[],rule:'r'}
  ]};
  assert.ok(validateFeedback(registry).some((x)=>x.includes('EVIDENCE_REQUIRED')));
});

test('FAIL dominates HOLD in design result',()=>{
  assert.equal(deriveDesignResult([{status:'HOLD'},{status:'FAIL'}]).status,'FAIL');
});
