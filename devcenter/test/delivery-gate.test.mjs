import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateReleaseGate,finalizeDeliveryReceipt,validateRelease} from '../scripts/delivery-gate.mjs';

const release={
  contract:'devcenter-delivery-release/v1',
  subject:{project_id:'demo',repository:'freepass-creator/demo',revision:'1'.repeat(40)},
  target:{environment:'PREVIEW',provider:'vercel',application:'demo',url:null},
  quality:{required_receipts:['quality/demo.json']},
  build:{commands:['npm ci','npm test','npm run build'],artifact_ref:null},
  release:{commands:['vercel deploy --prebuilt'],approval_required:false,approval_ref:null},
  rollback:{strategy:'PROMOTE_PREVIOUS',commands:['vercel promote previous'],last_known_good_ref:'deployment/previous',irreversible_effects:[]}
};

test('release contract requires exact revision and rollback path',()=>{
  assert.deepEqual(validateRelease(release),[]);
  const broken=structuredClone(release);
  broken.subject.revision='main';
  assert.ok(validateRelease(broken).includes('DELIVERY_RELEASE_REVISION_INVALID'));
});

test('production release requires explicit approval reference',()=>{
  const prod=structuredClone(release);
  prod.target.environment='PRODUCTION';
  prod.release.approval_required=true;
  assert.ok(validateRelease(prod).includes('DELIVERY_PRODUCTION_APPROVAL_REF_REQUIRED'));
});

test('release gate holds when required quality receipt is absent',()=>{
  const result=evaluateReleaseGate(release,{qualityReceipts:[]});
  assert.equal(result.status,'HOLD');
  assert.ok(result.blockers[0].startsWith('QUALITY_RECEIPT_MISSING'));
});

test('release gate accepts matching PASS quality receipt',()=>{
  const result=evaluateReleaseGate(release,{qualityReceipts:[{ref:'quality/demo.json',status:'PASS',subject_revision:'1'.repeat(40)}]});
  assert.equal(result.status,'READY_FOR_EXECUTION');
});

test('delivery receipt cannot claim production readiness without prod approval',()=>{
  const receipt=finalizeDeliveryReceipt({
    subject:release.subject,
    target:{...release.target,environment:'PREVIEW'},
    quality_receipts:['quality/demo.json'],
    build:{status:'PASS',artifact_ref:'artifact/demo'},
    deployment:{status:'PASS',deployment_ref:'preview/1',approval_ref:null},
    smoke:{status:'PASS',evidence:['smoke/demo.json']},
    rollback:{status:'READY',last_known_good_ref:'deployment/previous',procedure_ref:'rollback/demo.md'}
  },{createdAt:'2026-09-21T00:00:00.000Z'});
  assert.equal(receipt.result.status,'PASS');
  assert.equal(receipt.result.production_ready,false);
  assert.match(receipt.receipt_id,/^dr_[a-f0-9]{24}$/);
});
