export const WORK_RESULT_SCHEMA='ai-core-work-result/v1';
const nowIso=clock=>new Date(clock()).toISOString();
export function createWorkResult({plan,status,summary='',adapterResult=null,performed=false,startedAt=null,blockers=[],nextAction=null,clock=Date.now}) {
  const r=adapterResult??{};
  return {
    schema:WORK_RESULT_SCHEMA,
    order_id:plan?.order_id??null, work_id:plan?.work_id??null,
    project_id:plan?.project_id??null, capability_id:plan?.capability_id??null,
    subject_revision:plan?.subject_revision??null, mode:plan?.mode??null,
    status, summary:summary||r.summary||'',
    artifact_refs:[...(r.artifacts??[])], evidence_refs:[...(r.evidence??[])], checks:[...(r.checks??[])],
    execution:{performed,external_effect:r.external_effect===true,started_at:startedAt,ended_at:performed?nowIso(clock):null,authorization_source:plan?.authorization_source??null},
    outcome:{observed:status==='SUCCEEDED',data:r.data??null},
    blockers:[...new Set([...(blockers??[]),...(r.blockers??[])])],
    next_action:nextAction??r.next_action??null, walls:[...(plan?.walls??[])],
  };
}
