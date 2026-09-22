import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveDataResult,evaluateConsumer,finalizeDataReceipt,promotePattern,validatePatterns,validateRecovery} from '../scripts/data-hub.mjs';

test('data receipt derives HOLD from unresolved production/recovery checks',()=>{
  const receipt=finalizeDataReceipt({
    subject:{project_id:'x',repository:'freepass-creator/x',revision:'1'.repeat(40)},
    scope:{domain:'catalog',claims:['x'],exclusions:[]},
    checks:[
      {id:'A',status:'PASS',evidence:['e/1']},
      {id:'B',status:'HOLD',evidence:['e/2'],remediation:'fix',recheck:'rerun'}
    ]
  },{createdAt:'2026-09-21T00:00:00.000Z'});
  assert.equal(receipt.result.status,'HOLD');
  assert.match(receipt.receipt_id,/^data_[a-f0-9]{24}$/);
});

test('adopted pattern requires exact source revision and evidence',()=>{
  const registry={contract:'devcenter-data-patterns/v1',patterns:[
    {id:'p',status:'ADOPTED',source:{revision:'1'.repeat(40)},evidence:['e'],rule:'r'}
  ]};
  assert.deepEqual(validatePatterns(registry),[]);
});

test('consumer with blockers remains HOLD',()=>{
  assert.equal(evaluateConsumer({id:'x',relation:'CONSUMER',blockers:['auth']}).status,'HOLD');
});

test('recovery cannot be READY with blockers',()=>{
  const errors=validateRecovery({
    contract:'devcenter-data-recovery/v1',
    subject:{revision:'1'.repeat(40)},
    state:'READY',
    required:['restore'],
    blockers:['not tested']
  });
  assert.ok(errors.includes('DATA_RECOVERY_READY_WITH_BLOCKERS'));
});

test('pattern promotion requires evidence and does not silently adopt',()=>{
  const c={id:'p',status:'CANDIDATE'};
  assert.throws(()=>promotePattern(c,{decision:'ADOPT',evidence:[]}),/DATA_PROMOTION_EVIDENCE_REQUIRED/);
  assert.equal(promotePattern(c,{decision:'ADOPT',evidence:['receipt/1']}).target_status,'ADOPTED');
});

test('FAIL dominates HOLD in data result',()=>{
  assert.equal(deriveDataResult([{status:'HOLD'},{status:'FAIL'}]).status,'FAIL');
});
