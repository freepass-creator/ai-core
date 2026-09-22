import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractTemplateCatalog,finalizeDocumentLock,finalizeDocumentReceipt,makeRenderPlan,validateDocumentJob} from '../scripts/document-hub.mjs';


const liveBinding=JSON.parse(readFileSync(new URL('../hubs/document/source-binding.json',import.meta.url),'utf8'));
const projectRegistry=JSON.parse(readFileSync(new URL('../../registry/projects.json',import.meta.url),'utf8'));
const importClassification=JSON.parse(readFileSync(new URL('../../docs/integration/DOCSHUB_IMPORT_CLASSIFICATION_2026-09-23.json',import.meta.url),'utf8'));

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

test('DocsHub transition binding, registry and import classification agree on one exact source revision',()=>{
  const project=projectRegistry.projects.find(item=>item.project_id==='docshub');
  assert.ok(project);
  assert.equal(project.execution_readiness_status,'HOLD');
  assert.equal(project.head_revision,importClassification.source.revision);
  assert.equal(liveBinding.revision,importClassification.source.revision);
  assert.equal(importClassification.authority.current_state,'TRANSITIONAL_EXTERNAL_SOURCE');
  assert.equal(importClassification.authority.target_template_owner,'ai-core/management-support/templates');
  assert.equal(importClassification.authority.runtime_consumer,'ai-core/devcenter/document-hub');
  assert.equal(importClassification.authority.duplicate_ssot_forbidden,true);
  assert.equal(importClassification.authority.cutover_authorized,false);
});

test('DocsHub remote inventory is fully accounted and template blobs stay exact',()=>{
  const inv=importClassification.remote_inventory;
  assert.equal(inv.excluded_ai_core_kit.count,14);
  assert.equal(inv.excluded_project_instruction.count,1);
  assert.equal(inv.transitional_sources.length,4);
  assert.equal(inv.excluded_ai_core_kit.count+inv.excluded_project_instruction.count+inv.transitional_sources.length,19);
  assert.equal(inv.accounted_files,19);

  const expected=new Map(inv.transitional_sources.map(item=>[item.path,item.blob_sha]));
  assert.equal(liveBinding.sources.readme.blob_sha,expected.get('README.md'));
  assert.equal(liveBinding.sources.catalog.blob_sha,expected.get('app.js'));
  assert.equal(liveBinding.sources.shell.blob_sha,expected.get('index.html'));
  assert.equal(liveBinding.sources.styles.blob_sha,expected.get('styles.css'));
});

test('local unversioned DocsHub remains HOLD until fresh sensitive-content-safe inventory exists',()=>{
  assert.equal(importClassification.local_unversioned_source.status,'HOLD_UNOBSERVED');
  assert.equal(importClassification.local_unversioned_source.current_session_bytes_observed,false);
  assert.equal(importClassification.local_unversioned_source.import_authorized,false);
  assert.ok(importClassification.cutover_requirements.includes('FRESH_LOCAL_INVENTORY_OBSERVED'));
  assert.ok(importClassification.cutover_requirements.includes('SENSITIVE_AND_CASE_CONTENT_EXCLUDED'));
  assert.ok(importClassification.cutover_requirements.includes('OLD_DOCSHUB_SOURCE_MARKED_REFERENCE_ONLY'));
});

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
