import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assessSecurityMachineEnforcement,
  validateSecurityMachineEnforcementRegistry,
} from '../src/security/machine-enforcement-gate.mjs';

const current=JSON.parse(await readFile(new URL('../registry/security-audit-machine-enforcement.json',import.meta.url),'utf8'));

test('current Security/Audit machine-enforcement registry remains HOLD with explicit blockers',()=>{
  const report=assessSecurityMachineEnforcement(current);
  assert.equal(report.current_maturity,'CANONICAL_PARTIAL');
  assert.equal(report.target_maturity,'MACHINE_ENFORCED');
  assert.equal(report.declared_status,'HOLD');
  assert.equal(report.recommended_status,'HOLD');
  assert.equal(report.machine_enforcement_allowed,false);
  assert.equal(report.gate_count,7);
  assert.ok(report.blockers.length>0);
});

test('machine enforcement becomes allowed only when every gate is PASS and status is READY',()=>{
  const ready={
    ...structuredClone(current),
    enforcement_status:'READY',
    gates:current.gates.map(gate=>({
      ...gate,
      status:'PASS',
      evidence_refs:gate.evidence_refs.length?gate.evidence_refs:[`evidence:${gate.id}`],
    })),
  };
  const report=assessSecurityMachineEnforcement(ready);
  assert.equal(report.recommended_status,'READY');
  assert.equal(report.machine_enforcement_allowed,true);
  assert.equal(report.blockers.length,0);
});

test('READY cannot hide pending or externally blocked enforcement gates',()=>{
  const invalid={...structuredClone(current),enforcement_status:'READY'};
  assert.throws(()=>assessSecurityMachineEnforcement(invalid),/SECURITY_MACHINE_READY_WITH_BLOCKERS/);
});

test('PASS requires revision-bound or otherwise explicit evidence',()=>{
  const invalid=structuredClone(current);
  const gate=invalid.gates.find(x=>x.id==='canonical_owner_machine_enforcement');
  gate.status='PASS';
  gate.evidence_refs=[];
  assert.throws(()=>validateSecurityMachineEnforcementRegistry(invalid),/SECURITY_MACHINE_PASS_WITHOUT_EVIDENCE/);
});
