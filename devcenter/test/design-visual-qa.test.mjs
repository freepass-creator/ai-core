import test from 'node:test';
import assert from 'node:assert/strict';
import {finalizeVisualReceipt,makeVisualPlan,makeVisualQualityDraft,validateCaptureManifest,validateVisualJob} from '../scripts/design-visual-qa.mjs';

const designPlan={
  contract:'devcenter-design-plan/v1',
  target:{project_id:'freepass-admin',repository:'freepass-creator/freepass-admin',revision:'1111111111111111111111111111111111111111'},
  surface:{id:'applications-list'},
  core_binding:{revision:'2222222222222222222222222222222222222222'},
  qa:{viewports:[390,1440],probes:['loading','empty','error','populated'],required_states:{'data.table':['loading','empty','error','populated']}},
  result:{status:'COMPILED'}
};
const job={
  contract:'devcenter-design-visual-job/v1',
  design_plan_ref:'design-plan.json',
  preview:{origin:'https://example.test'},
  cases:[
    {id:'populated',path:'/applications?qa=populated',state:'populated',locale:'ko-KR',direction:'LTR'},
    {id:'error',path:'/applications?qa=error',state:'error',locale:'ko-KR',direction:'LTR'}
  ],
  capture:{height:844,settle_ms:1000}
};

test('visual plan expands variants across required viewports',()=>{
  assert.deepEqual(validateVisualJob(job),[]);
  const plan=makeVisualPlan(designPlan,job);
  assert.equal(plan.result.status,'PLANNED');
  assert.equal(plan.captures.length,4);
  assert.ok(plan.captures.some((c)=>c.case_id==='error@1440'));
});

test('capture manifest must cover every planned case',()=>{
  const plan=makeVisualPlan(designPlan,job);
  const manifest={
    contract:'devcenter-browser-capture-manifest/v1',
    visual_plan_ref:'visual-plan.json',
    adapter:{id:'test',browser:'test-browser',browser_version:'1'},
    captures:plan.captures.slice(0,3).map((c)=>({case_id:c.case_id,status:'PASS',screenshot_ref:c.screenshot_ref,sha256:'a'.repeat(64)})),
    result:{status:'PASS',total:4,failed:0},
    captured_at:'2026-09-21T00:00:00.000Z'
  };
  assert.ok(validateCaptureManifest(manifest,plan).some((x)=>x.startsWith('CAPTURE_CASE_MISSING')));
});

test('screenshots alone cannot produce a PASS visual receipt without review',()=>{
  const plan=makeVisualPlan(designPlan,job);
  const manifest={
    contract:'devcenter-browser-capture-manifest/v1',
    visual_plan_ref:'visual-plan.json',
    adapter:{id:'test',browser:'test-browser',browser_version:'1'},
    captures:plan.captures.map((c)=>({case_id:c.case_id,status:'PASS',screenshot_ref:c.screenshot_ref,sha256:'b'.repeat(64)})),
    result:{status:'PASS',total:plan.captures.length,failed:0},
    captured_at:'2026-09-21T00:00:00.000Z'
  };
  assert.throws(()=>finalizeVisualReceipt({reviewer:null,case_results:[]},{visualPlan:plan,captureManifest:manifest}),/VISUAL_REVIEWER_REQUIRED/);
});

test('reviewed cases derive PASS visual receipt',()=>{
  const plan=makeVisualPlan(designPlan,job);
  const manifest={
    contract:'devcenter-browser-capture-manifest/v1',
    visual_plan_ref:'visual-plan.json',
    adapter:{id:'test',browser:'test-browser',browser_version:'1'},
    captures:plan.captures.map((c)=>({case_id:c.case_id,status:'PASS',screenshot_ref:c.screenshot_ref,sha256:'c'.repeat(64)})),
    result:{status:'PASS',total:plan.captures.length,failed:0},
    captured_at:'2026-09-21T00:00:00.000Z'
  };
  const draft={
    visual_plan_ref:'visual-plan.json',
    capture_manifest_ref:'capture-manifest.json',
    reviewer:{type:'AI_VISUAL_REVIEW',id:'reviewer-test'},
    case_results:plan.captures.map((c)=>({
      case_id:c.case_id,
      status:'PASS',
      checks:[
        {id:'layout-integrity',status:'PASS'},
        {id:'overflow-clipping',status:'PASS'}
      ]
    }))
  };
  const receipt=finalizeVisualReceipt(draft,{visualPlan:plan,captureManifest:manifest,createdAt:'2026-09-21T00:01:00.000Z'});
  assert.equal(receipt.payload.result.status,'PASS');
  assert.match(receipt.receipt_id,/^dvr_[a-f0-9]{24}$/);
  const quality=makeVisualQualityDraft(receipt,{startedAt:'2026-09-21T00:00:00.000Z',finishedAt:'2026-09-21T00:01:00.000Z'});
  assert.equal(quality.checks[0].status,'PASS');
});

test('one FAIL review makes the visual receipt FAIL',()=>{
  const plan=makeVisualPlan(designPlan,job);
  const manifest={
    contract:'devcenter-browser-capture-manifest/v1',
    visual_plan_ref:'visual-plan.json',
    adapter:{id:'test',browser:'test-browser',browser_version:'1'},
    captures:plan.captures.map((c)=>({case_id:c.case_id,status:'PASS',screenshot_ref:c.screenshot_ref,sha256:'d'.repeat(64)})),
    result:{status:'PASS',total:plan.captures.length,failed:0},
    captured_at:'2026-09-21T00:00:00.000Z'
  };
  const draft={
    visual_plan_ref:'visual-plan.json',
    capture_manifest_ref:'capture-manifest.json',
    reviewer:{type:'HUMAN_REVIEW',id:'reviewer-test'},
    case_results:plan.captures.map((c,i)=>({case_id:c.case_id,status:i===0?'FAIL':'PASS',checks:[{id:'layout-integrity',status:i===0?'FAIL':'PASS'}]}))
  };
  const receipt=finalizeVisualReceipt(draft,{visualPlan:plan,captureManifest:manifest});
  assert.equal(receipt.payload.result.status,'FAIL');
});
