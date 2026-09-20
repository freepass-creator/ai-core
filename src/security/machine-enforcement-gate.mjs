const need=(condition,code)=>{if(!condition) throw new Error(code);};
const nonempty=value=>typeof value==='string'&&value.trim()===value&&value.length>0;

export const SECURITY_MACHINE_GATE_IDS=Object.freeze([
  'core_ci_execution',
  'aiops_semantic_representation',
  'erp4_policy_consumption',
  'independent_non_aiops_consumer',
  'audit_redaction_consumer_test',
  'branch_check_enforcement',
  'canonical_owner_machine_enforcement',
]);

const STATUS=new Set(['PASS','PENDING','HOLD','BLOCKED_EXTERNAL']);

export function validateSecurityMachineEnforcementRegistry(registry) {
  need(registry&&typeof registry==='object'&&!Array.isArray(registry),'SECURITY_MACHINE_REGISTRY_REQUIRED');
  need(registry.schema_version==='security-audit-machine-enforcement-gate/v1','SECURITY_MACHINE_SCHEMA_INVALID');
  need(nonempty(registry.baseline_profile_ref),'SECURITY_MACHINE_BASELINE_REF_REQUIRED');
  need(registry.current_maturity==='CANONICAL_PARTIAL','SECURITY_MACHINE_CURRENT_MATURITY_INVALID');
  need(registry.target_maturity==='MACHINE_ENFORCED','SECURITY_MACHINE_TARGET_MATURITY_INVALID');
  need(['HOLD','READY'].includes(registry.enforcement_status),'SECURITY_MACHINE_STATUS_INVALID');
  need(Array.isArray(registry.gates),'SECURITY_MACHINE_GATES_REQUIRED');

  const ids=registry.gates.map(g=>g?.id);
  need(ids.length===SECURITY_MACHINE_GATE_IDS.length,'SECURITY_MACHINE_GATE_COUNT_INVALID');
  need(new Set(ids).size===ids.length,'SECURITY_MACHINE_GATE_DUPLICATE');
  need(SECURITY_MACHINE_GATE_IDS.every(id=>ids.includes(id)),'SECURITY_MACHINE_GATE_MISSING');

  for(const gate of registry.gates) {
    need(SECURITY_MACHINE_GATE_IDS.includes(gate.id),`SECURITY_MACHINE_GATE_ID_INVALID:${gate?.id}`);
    need(STATUS.has(gate.status),`SECURITY_MACHINE_GATE_STATUS_INVALID:${gate.id}`);
    need(Array.isArray(gate.evidence_refs),`SECURITY_MACHINE_EVIDENCE_REQUIRED:${gate.id}`);
    need(gate.evidence_refs.every(nonempty),`SECURITY_MACHINE_EVIDENCE_INVALID:${gate.id}`);
    need(nonempty(gate.note),`SECURITY_MACHINE_NOTE_REQUIRED:${gate.id}`);
    if(gate.status==='PASS') need(gate.evidence_refs.length>0,`SECURITY_MACHINE_PASS_WITHOUT_EVIDENCE:${gate.id}`);
  }
  return registry;
}

export function assessSecurityMachineEnforcement(registry) {
  validateSecurityMachineEnforcementRegistry(registry);

  const blockers=registry.gates
    .filter(gate=>gate.status!=='PASS')
    .map(gate=>({
      id:gate.id,
      status:gate.status,
      note:gate.note,
      evidence_refs:gate.evidence_refs,
    }));

  const recommended_status=blockers.length===0?'READY':'HOLD';
  if(registry.enforcement_status==='READY') {
    need(blockers.length===0,'SECURITY_MACHINE_READY_WITH_BLOCKERS');
  }

  return {
    schema_version:'security-audit-machine-enforcement-report/v1',
    baseline_profile_ref:registry.baseline_profile_ref,
    current_maturity:registry.current_maturity,
    target_maturity:registry.target_maturity,
    declared_status:registry.enforcement_status,
    recommended_status,
    machine_enforcement_allowed:registry.enforcement_status==='READY'&&blockers.length===0,
    passed_gate_count:registry.gates.length-blockers.length,
    gate_count:registry.gates.length,
    blockers,
  };
}
