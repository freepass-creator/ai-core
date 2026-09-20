import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAEvidenceRegistry } from '../scripts/validate-a-session-evidence.mjs';

function base(){
  return {
    schema:'ai-core-a-session-evidence-registry/v1',
    status:'RESEARCH_ROUTING_INDEX_NOT_CANONICAL',
    findings:[{
      id:'x',
      classification:'PROJECT_GT_CORE',
      current_status:'ROUTED',
      evidence_level:'PROJECT_VERIFIED',
      routes:['C'],
      summary:'A reusable implementation pattern with sufficient description.',
      revision_evidence:[{repository:'o/r',revision:'a'.repeat(40),evidence_types:['CODE','TEST']}],
      state_history:[{status:'ROUTED',observed_at:'2026-09-20T00:00:00Z',reason:'Routed with exact revision evidence.'}]
    }]
  };
}
test('accepts a coherent Project > Core finding',()=>assert.equal(validateAEvidenceRegistry(base()).status,'VALID'));
test('Core > Project requires migration impact and verification needs',()=>{
  const x=base(); x.findings[0]={...x.findings[0],classification:'CORE_GT_PROJECT',current_status:'MIGRATION_REQUIRED',state_history:[{status:'MIGRATION_REQUIRED',observed_at:'2026-09-20T00:00:00Z',reason:'Migration required after comparison.'}]};
  const r=validateAEvidenceRegistry(x); assert.ok(r.errors.some(e=>e.code==='MIGRATION_REQUIRED'));
});
test('Different requires an explicit difference reason',()=>{
  const x=base(); x.findings[0].classification='DIFFERENT'; x.findings[0].current_status='ACTIVE'; x.findings[0].state_history=[{status:'ACTIVE',observed_at:'2026-09-20T00:00:00Z',reason:'Distinct unresolved evidence boundary.'}];
  const r=validateAEvidenceRegistry(x); assert.ok(r.errors.some(e=>e.code==='DIFFERENCE_REASON_REQUIRED'));
});
test('state history tail must equal current status',()=>{
  const x=base(); x.findings[0].current_status='ACTIVE';
  const r=validateAEvidenceRegistry(x); assert.ok(r.errors.some(e=>e.code==='CURRENT_STATUS_NOT_HISTORY_TAIL'));
});
test('routes are limited to B C D and cannot duplicate',()=>{
  const x=base(); x.findings[0].routes=['C','C'];
  const r=validateAEvidenceRegistry(x); assert.ok(r.errors.some(e=>e.code==='ROUTE_DUPLICATE'));
});
test('revision evidence must use exact Git SHA and typed evidence',()=>{
  const x=base(); x.findings[0].revision_evidence[0].revision='main';
  const r=validateAEvidenceRegistry(x); assert.ok(r.errors.some(e=>e.code==='EVIDENCE_REVISION_INVALID'));
});
