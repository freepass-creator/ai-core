export const WORK_RESULT_SCHEMA='ai-core-work-result/v1';
const nowIso=clock=>new Date(clock()).toISOString();
const EFFECT_BOUNDARY_BLOCKER='CAPABILITY_EFFECT_BOUNDARY_VIOLATION';
export function createWorkResult({plan,status,summary='',adapterResult=null,performed=false,startedAt=null,blockers=[],nextAction=null,clock=Date.now}) {
  const r=adapterResult??{};
  const externalEffect=r.external_effect===true;
  const effectBoundaryViolation=externalEffect&&['READ_ONLY','LOCAL_MUTATION'].includes(plan?.mode);
  const effectiveStatus=effectBoundaryViolation?'HOLD':status;
  const effectiveBlockers=[...(blockers??[]),...(r.blockers??[])];
  if(effectBoundaryViolation) effectiveBlockers.push(EFFECT_BOUNDARY_BLOCKER);
  return {
    schema:WORK_RESULT_SCHEMA,
    order_id:plan?.order_id??null, work_id:plan?.work_id??null,
    project_id:plan?.project_id??null, capability_id:plan?.capability_id??null,
    subject_revision:plan?.subject_revision??null, mode:plan?.mode??null,
    status:effectiveStatus, summary:summary||r.summary||'',
    artifact_refs:[...(r.artifacts??[])], evidence_refs:[...(r.evidence??[])], checks:[...(r.checks??[])],
    execution:{performed,external_effect:externalEffect,started_at:startedAt,ended_at:performed?nowIso(clock):null,authorization_source:plan?.authorization_source??null},
    outcome:{observed:effectiveStatus==='SUCCEEDED',data:r.data??null},
    blockers:[...new Set(effectiveBlockers)],
    next_action:nextAction??r.next_action??null, walls:[...(plan?.walls??[])],
  };
}
