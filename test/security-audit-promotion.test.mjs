import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assessSecurityPromotion,
  validateSecurityPromotionRegistry,
} from '../src/security/promotion-gate.mjs';

const current=JSON.parse(await readFile(new URL('../registry/security-audit-promotion.json',import.meta.url),'utf8'));

test('current Security/Audit promotion registry remains HOLD with explicit blockers',()=>{
  const report=assessSecurityPromotion(current);
  assert.equal(report.declared_status,'HOLD');
  assert.equal(report.recommended_status,'HOLD');
  assert.equal(report.promotion_allowed,false);
  assert.equal(report.gate_count,7);
  assert.ok(report.blockers.length>0);
});

test('promotion becomes allowed only when every gate is PASS and status is READY',()=>{
  const ready={
    ...structuredClone(current),
    promotion_status:'READY',
    gates:current.gates.map(gate=>({
      ...gate,
      status:'PASS',
      evidence_refs:gate.evidence_refs.length?gate.evidence_refs:[`evidence:${gate.id}`],
    })),
  };
  const report=assessSecurityPromotion(ready);
  assert.equal(report.recommended_status,'READY');
  assert.equal(report.promotion_allowed,true);
  assert.equal(report.blockers.length,0);
});

test('READY cannot hide a pending or externally blocked gate',()=>{
  const invalid={...structuredClone(current),promotion_status:'READY'};
  assert.throws(()=>assessSecurityPromotion(invalid),/SECURITY_PROMOTION_READY_WITH_BLOCKERS/);
});

test('PASS requires at least one evidence reference',()=>{
  const invalid=structuredClone(current);
  const gate=invalid.gates.find(x=>x.id==='canonical_owner_authorization');
  gate.status='PASS';
  gate.evidence_refs=[];
  assert.throws(()=>validateSecurityPromotionRegistry(invalid),/SECURITY_PROMOTION_PASS_WITHOUT_EVIDENCE/);
});
