import test from 'node:test';
import assert from 'node:assert/strict';
import { projectOperationFeedback } from '../src/engine/ui-operation-feedback.mjs';

test('technical success without verified completion stays pending',()=>{
  const ui=projectOperationFeedback({workflow_decision:{action:'CONTINUE'},completion:{status:'PENDING',receipt_ref:null}});
  assert.equal(ui.presentation_state,'COMPLETION_PENDING');
  assert.deepEqual(ui.feature_refs,['feedback.progress']);
  assert.equal(ui.completion_verified,false);
});

test('verified completion may use background-safe completion toast',()=>{
  const ui=projectOperationFeedback({
    workflow_decision:{action:'CONTINUE'},
    completion:{status:'VERIFIED',receipt_ref:'receipt:1'},
    last_verified_at:'2026-09-20T12:00:00Z'
  });
  assert.equal(ui.presentation_state,'COMPLETED');
  assert.deepEqual(ui.feature_refs,['feedback.toast']);
  assert.equal(ui.receipt_ref,'receipt:1');
});

test('automatic retry does not invent an actionable retry button',()=>{
  const ui=projectOperationFeedback({workflow_decision:{action:'RETRY'},allowed_actions:[{kind:'CANCEL',label:'취소'}]});
  assert.equal(ui.presentation_state,'RETRY_SCHEDULED');
  assert.equal(ui.primary_action,null);
  assert.ok(ui.feature_refs.includes('feedback.progress'));
});

test('manual retry only exposes a retry action when D supplied it',()=>{
  const retry={kind:'RETRY',label:'다시 시도'};
  const ui=projectOperationFeedback({workflow_decision:{action:'WAIT_MANUAL_RETRY'},allowed_actions:[retry]});
  assert.equal(ui.presentation_state,'RETRY_AVAILABLE');
  assert.deepEqual(ui.primary_action,retry);

  const noPermission=projectOperationFeedback({workflow_decision:{action:'WAIT_MANUAL_RETRY'},allowed_actions:[]});
  assert.equal(noPermission.primary_action,null);
});

test('hold and partial state remain blocking and assertive',()=>{
  const hold=projectOperationFeedback({workflow_decision:{action:'HOLD'}});
  assert.equal(hold.presentation_state,'BLOCKED');
  assert.equal(hold.announce,'ASSERTIVE');

  const partial=projectOperationFeedback({workflow_decision:{action:'PARTIAL_STATE'}});
  assert.equal(partial.presentation_state,'PARTIAL_STATE');
  assert.ok(partial.feature_refs.includes('feedback.alert'));
});
