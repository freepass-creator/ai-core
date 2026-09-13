import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInstitution, centerCreationGate, capabilityDescriptor } from '../src/federation-map.mjs';

test('historical repository alias resolves to stable institution id',()=>{
  const r=resolveInstitution('docshub');
  assert.equal(r.status,'RESOLVED');
  assert.equal(r.institution.id,'center.doc');
  assert.equal(r.via,'alias');
});

test('repository rename does not define logical identity',()=>{
  const r=resolveInstitution('center.work');
  assert.equal(r.institution.id,'center.work');
  assert.equal(r.institution.repository,'freepass-creator/aiops');
});

test('weak domain stays capability family instead of new center',()=>{
  const g=centerCreationGate({independent_ssot:true,reusable_capabilities:true,distinct_verification:false,repeated_cross_project_use:false});
  assert.equal(g.decision,'KEEP_AS_CAPABILITY_FAMILY');
});

test('mature domain becomes center candidate but gains no authority',()=>{
  const g=centerCreationGate({independent_ssot:true,reusable_capabilities:true,distinct_verification:true,repeated_cross_project_use:false});
  assert.equal(g.decision,'CENTER_CANDIDATE');
  assert.equal(g.authorization,'NOT_GRANTED');
});

test('capability without verification remains HOLD',()=>{
  const c=capabilityDescriptor({id:'doc.report.strategy',owner:'center.doc',source:'docshub/app.js',inputs:['content'],outputs:['pdf']});
  assert.equal(c.status,'HOLD');
  assert.ok(c.missing.includes('verification'));
});

test('complete capability can be described without execution authority',()=>{
  const c=capabilityDescriptor({id:'doc.report.strategy',owner:'center.doc',source:'docshub/app.js@sha',inputs:['content'],outputs:['pdf'],verification:['content','layout','pdf']});
  assert.equal(c.status,'DESCRIBED');
  assert.equal(c.authorization,'NOT_GRANTED');
});
