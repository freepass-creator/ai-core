import test from 'node:test';
import assert from 'node:assert/strict';
import {extractTemplateCatalog,finalizeDocumentLock,finalizeDocumentReceipt,makeRenderPlan,validateDocumentJob} from '../scripts/document-hub.mjs';

const appSource="const templates = [{id:'contract',category:'계약',title:'ERP형 전자계약',desc:'표 중심 고객용 전자문서',render:contract},{id:'terms',category:'계약',title:'계약 약관',desc:'보험사·금융사형 2단 약관 조판',render:terms}];";
const catalog=extractTemplateCatalog(appSource);
const binding={
  repository:'freepass-creator/docshub',
  revision:'1'.repeat(40),
  sources:{
    catalog:{blob_sha:'a'},
    shell:{blob_sha:'b'},
    styles:{blob_sha:'c'}
  }
};
const job={
  contract:'devcenter-document-job/v1',
  subject:{project_id:'freepass-admin',repository:'freepass-creator/freepass-admin',revision:'2'.repeat(40)},
  template_id:'contract',
  content_ref:'contracts/application-001.json',
  brand_profile_ref:null,
  output:{formats:['HTML','PDF'],orientation:'PORTRAIT'},
  quality:{content_accuracy:true,visual_review:true}
};

test('extracts DocsHub template catalog without copying template bodies',()=>{
  assert.equal(catalog.length,2);
  assert.equal(catalog[0].id,'contract');
});

test('document job fails closed for unknown template',()=>{
  const broken={...job,template_id:'made-up'};
  assert.ok(validateDocumentJob(broken,catalog)[0].startsWith('DOCUMENT_TEMPLATE_UNKNOWN'));
});

test('render plan pins DocsHub source revision and template metadata',()=>{
  const plan=makeRenderPlan(job,{binding,catalog});
  assert.equal(plan.result.status,'PLANNED');
  assert.equal(plan.source.revision,'1'.repeat(40));
  assert.equal(plan.template.id,'contract');
});

test('document receipt requires artifact hashes',()=>{
  assert.throws(()=>finalizeDocumentReceipt({
    subject:job.subject,template:{id:'contract'},source:{revision:'1'.repeat(40)},
    artifacts:[{format:'PDF',ref:'out.pdf',sha256:'bad'}],
    checks:[{id:'DOC.CONTENT',status:'PASS',evidence:['review.json']}]
  }),/DOCUMENT_RECEIPT_ARTIFACT_EVIDENCE_INVALID/);
});

test('approved template artifact can create last-known-good lock',()=>{
  const lock=finalizeDocumentLock({
    template_id:'contract',
    docshub_revision:'1'.repeat(40),
    approval:{status:'APPROVED',approved_by:'USER',evidence_ref:'approval/1'},
    artifact_ref:'artifact/contract-v1.pdf',
    previous_lock_ref:null
  },{createdAt:'2026-09-21T00:00:00.000Z'});
  assert.match(lock.lock_id,/^dlock_[a-f0-9]{24}$/);
});
