export function buildFactEvidence({ assertion_id, fact_id, subject, assertion_kind, value_digest, asserted_at, basis_refs, verification_state='UNVERIFIED', inference=null }) {
  const allowedKinds=new Set(['OBSERVED','INFERRED','DERIVED']);
  if(!allowedKinds.has(assertion_kind)) throw new Error('FACT_EVIDENCE_KIND_INVALID');
  if(!assertion_id || !fact_id || !subject?.type || !subject?.id) throw new Error('FACT_EVIDENCE_IDENTITY_REQUIRED');
  if(!/^sha256:[0-9a-f]{64}$/.test(value_digest ?? '')) throw new Error('FACT_EVIDENCE_VALUE_DIGEST_INVALID');
  if(!Array.isArray(basis_refs) || basis_refs.length===0) throw new Error('FACT_EVIDENCE_BASIS_REQUIRED');
  if(assertion_kind==='INFERRED'){
    if(!inference?.rule_ref || !Array.isArray(inference?.basis_fact_refs) || inference.basis_fact_refs.length===0) throw new Error('FACT_EVIDENCE_INFERENCE_REQUIRED');
  } else if(inference != null){
    throw new Error('FACT_EVIDENCE_INFERENCE_FORBIDDEN');
  }
  const out={schema_version:'core-fact-evidence/v1',assertion_id,fact_id,subject:{type:subject.type,id:subject.id,revision:subject.revision ?? null},assertion_kind,value_digest,asserted_at,basis_refs:[...new Set(basis_refs)],verification_state};
  if(assertion_kind==='INFERRED') out.inference={rule_ref:inference.rule_ref,basis_fact_refs:[...new Set(inference.basis_fact_refs)],...(inference.explanation?{explanation:inference.explanation}:{})};
  return out;
}

export function evidenceKindSatisfies(evidence, allowedKinds) {
  if(!evidence || !Array.isArray(allowedKinds)) return false;
  return allowedKinds.includes(evidence.assertion_kind);
}

export function isDirectObservation(evidence) {
  return evidence?.assertion_kind==='OBSERVED';
}
