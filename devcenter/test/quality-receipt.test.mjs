import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveResult,finalizeQualityReceipt,loadHubRegistry,validateQualityReceipt} from '../scripts/quality-receipt.mjs';

const hubRegistry=loadHubRegistry();
const draft={
  subject:{
    project_id:'example-product',
    repository:'freepass-creator/example-product',
    revision:'1111111111111111111111111111111111111111'
  },
  hub:{primary:'design',secondary:['quality']},
  scope:{claims:['screen renders common action pattern'],exclusions:['production deployment']},
  execution:{
    runner:'local-node',
    commands:['node --test'],
    started_at:'2026-09-21T00:00:00.000Z',
    finished_at:'2026-09-21T00:01:00.000Z'
  },
  checks:[
    {
      id:'UI.CONTRACT',
      title:'UI contract validation',
      status:'PASS',
      evidence:[{kind:'LOG',ref:'artifacts/ui-contract.log'}]
    }
  ],
  source_hashes:{}
};

test('finalizer creates deterministic receipt id and derived PASS result',()=>{
  const receipt=finalizeQualityReceipt(draft,{hubRegistry,createdAt:'2026-09-21T00:02:00.000Z'});
  assert.match(receipt.receipt_id,/^qr_[a-f0-9]{24}$/);
  assert.equal(receipt.payload.result.status,'PASS');
  assert.deepEqual(validateQualityReceipt(receipt,hubRegistry),[]);
  const again=finalizeQualityReceipt(draft,{hubRegistry,createdAt:'2026-09-21T00:03:00.000Z'});
  assert.equal(receipt.receipt_id,again.receipt_id);
});

test('FAIL dominates HOLD NOTICE and PASS',()=>{
  assert.equal(deriveResult([
    {status:'PASS'},{status:'NOTICE'},{status:'HOLD'},{status:'FAIL'}
  ]).status,'FAIL');
});

test('PASS without evidence is rejected',()=>{
  const receipt=finalizeQualityReceipt(draft,{hubRegistry,createdAt:'2026-09-21T00:02:00.000Z'});
  receipt.payload.checks[0].evidence=[];
  assert.ok(validateQualityReceipt(receipt,hubRegistry).some((x)=>x.includes('PASS_EVIDENCE_REQUIRED')));
});

test('blocking check requires evidence remediation and recheck',()=>{
  const broken=structuredClone(draft);
  broken.checks=[{id:'SEC.HOLD',title:'security hold',status:'HOLD',evidence:[]}];
  assert.throws(()=>finalizeQualityReceipt(broken,{hubRegistry}),/QUALITY_RECEIPT_INVALID/);
});

test('unknown primary hub is rejected',()=>{
  const broken=structuredClone(draft);
  broken.hub.primary='made-up-hub';
  assert.throws(()=>finalizeQualityReceipt(broken,{hubRegistry}),/QUALITY_RECEIPT_INVALID/);
});

test('receipt is bound to exact 40-char subject revision',()=>{
  const broken=structuredClone(draft);
  broken.subject.revision='main';
  assert.throws(()=>finalizeQualityReceipt(broken,{hubRegistry}),/QUALITY_RECEIPT_INVALID/);
});
