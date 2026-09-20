const need=(condition,code)=>{if(!condition) throw new Error(code);};
const nonempty=value=>typeof value==='string'&&value.trim()===value&&value.length>0;

export const SECURITY_PROMOTION_GATE_IDS=Object.freeze([
  'core_machine_validation',
  'aiops_semantic_representation',
  'erp4_policy_consumption',
  'independent_non_aiops_consumer',
  'audit_redaction_consumer_test',
  'branch_check_enforcement',
  'canonical_owner_authorization',
]);

const STATUS=new Set(['PASS','PENDING','HOLD','BLOCKED_EXTERNAL']);
const TARGET=new Set(['CANONICAL_PARTIAL','MACHINE_ENFORCED']);

export function validateSecurityPromotionRegistry(registry) {
  need(registry&&typeof registry==='object'&&!Array.isArray(registry),'SECURITY_PROMOTION_REGISTRY_REQUIRED');
  need(registry.schema_version==='security-audit-promotion-gate/v1','SECURITY_PROMOTION_SCHEMA_INVALID');
  need(nonempty(registry.candidate_profile_ref),'SECURITY_PROMOTION_CANDIDATE_REF_REQUIRED');
  need(TARGET.has(registry.target_maturity),'SECURITY_PROMOTION_TARGET_INVALID');
  need(['HOLD','READY'].includes(registry.promotion_status),'SECURITY_PROMOTION_STATUS_INVALID');
  need(Array.isArray(registry.gates),'SECURITY_PROMOTION_GATES_REQUIRED');

  const ids=registry.gates.map(g=>g?.id);
  need(ids.length===SECURITY_PROMOTION_GATE_IDS.length,'SECURITY_PROMOTION_GATE_COUNT_INVALID');
  need(new Set(ids).size===ids.length,'SECURITY_PROMOTION_GATE_DUPLICATE');
  need(SECURITY_PROMOTION_GATE_IDS.every(id=>ids.includes(id)),'SECURITY_PROMOTION_GATE_MISSING');

  for(const gate of registry.gates) {
    need(SECURITY_PROMOTION_GATE_IDS.includes(gate.id),`SECURITY_PROMOTION_GATE_ID_INVALID:${gate?.id}`);
    need(STATUS.has(gate.status),`SECURITY_PROMOTION_GATE_STATUS_INVALID:${gate.id}`);
    need(Array.isArray(gate.evidence_refs),`SECURITY_PROMOTION_EVIDENCE_REQUIRED:${gate.id}`);
    need(gate.evidence_refs.every(nonempty),`SECURITY_PROMOTION_EVIDENCE_INVALID:${gate.id}`);
    need(nonempty(gate.note),`SECURITY_PROMOTION_NOTE_REQUIRED:${gate.id}`);
    if(gate.status==='PASS') need(gate.evidence_refs.length>0,`SECURITY_PROMOTION_PASS_WITHOUT_EVIDENCE:${gate.id}`);
  }
  return registry;
}

export function assessSecurityPromotion(registry) {
  validateSecurityPromotionRegistry(registry);
  const blockers=registry.gates
    .filter(gate=>gate.status!=='PASS')
    .map(gate=>({id:gate.id,status:gate.status,note:gate.note,evidence_refs:gate.evidence_refs}));

  const recommended_status=blockers.length===0?'READY':'HOLD';
  if(registry.promotion_status==='READY') {
    need(blockers.length===0,'SECURITY_PROMOTION_READY_WITH_BLOCKERS');
  }

  return {
    schema_version:'security-audit-promotion-report/v1',
    candidate_profile_ref:registry.candidate_profile_ref,
    target_maturity:registry.target_maturity,
    declared_status:registry.promotion_status,
    recommended_status,
    promotion_allowed:registry.promotion_status==='READY'&&blockers.length===0,
    passed_gate_count:registry.gates.length-blockers.length,
    gate_count:registry.gates.length,
    blockers,
  };
}
