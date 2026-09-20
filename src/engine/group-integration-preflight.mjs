import { createHash } from 'node:crypto';

const need=(condition,code)=>{if(!condition) throw new Error(code);};
const clean=value=>String(value??'').normalize('NFKC').trim();
const nonempty=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const digest=value=>`sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;
const iso=value=>new Date(value).toISOString();
const RECEIPT_STATUSES=new Set(['SUCCEEDED','HOLD','FAILED','PARTIAL']);
const STABLE_ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const REASON_CODE=/^[A-Z][A-Z0-9_]*$/;

function operationKind(classification){
  return `group.integration.${String(classification??'').toLowerCase().replaceAll('_','-')}`;
}

export function sealIntegrationPreflight({packet,observation}={}){
  need(packet?.schema==='ai-core-integration-work-packet/v1','INTEGRATION_WORK_PACKET_REQUIRED');
  need(observation&&typeof observation==='object'&&!Array.isArray(observation),'INTEGRATION_PREFLIGHT_OBSERVATION_REQUIRED');
  need(observation.repository===packet.repository,'INTEGRATION_PREFLIGHT_REPOSITORY_MISMATCH');
  need(observation.revision===packet.expected_revision,'INTEGRATION_PREFLIGHT_REVISION_STALE');
  need(observation.dirty_state==='CLEAN','INTEGRATION_PREFLIGHT_WORKTREE_NOT_CLEAN');
  need(Number.isFinite(Date.parse(observation.observed_at)),'INTEGRATION_PREFLIGHT_OBSERVED_AT_INVALID');
  need(packet.authority?.required===true,'INTEGRATION_PACKET_AUTHORITY_REQUIRED');
  need(packet.authority?.execution_authorized===false,'INTEGRATION_PACKET_MUST_NOT_SELF_AUTHORIZE');
  need(packet.completion?.auto_complete===false,'INTEGRATION_PACKET_AUTO_COMPLETE_FORBIDDEN');

  const requiredChecks=[...(packet.revalidation?.required_checks??[])];
  const observedChecks=new Map((observation.checks??[]).map(item=>[item?.name,item?.status]));
  for(const check of requiredChecks){
    if(check==='SOURCE_REVISION_UNCHANGED'||check==='DIRTY_STATE_RECHECK'||check==='PLAN_ITEM_STILL_READY') continue;
    need(observedChecks.get(check)==='PASS',`INTEGRATION_PREFLIGHT_CHECK_REQUIRED_${check}`);
  }

  const material={
    packet_id:packet.packet_id,
    plan_id:packet.plan_id,
    repository:packet.repository,
    expected_revision:packet.expected_revision,
    classification:packet.classification,
    observed_revision:observation.revision,
    dirty_state:observation.dirty_state,
    observed_at:observation.observed_at,
    checks:[...(observation.checks??[])],
  };

  return {
    schema:'ai-core-integration-preflight/v1',
    status:'SEALED',
    packet_id:packet.packet_id,
    repository:packet.repository,
    expected_revision:packet.expected_revision,
    observed_at:observation.observed_at,
    seal_digest:digest(material),
    material_digest:digest(material),
    authority_required:true,
    execution_authorized:false,
    freshness_policy:'REOBSERVE_IMMEDIATELY_BEFORE_EXECUTION',
    note:'This seal proves only the observed preflight inputs. It is not a mutex, lease, lock service, or execution authority.',
  };
}

function verificationSummary(packet,results){
  need(Array.isArray(results),'INTEGRATION_VERIFICATION_RESULTS_REQUIRED');
  const byName=new Map(results.map(item=>[item?.name,item]));
  const required=[...(packet.verification?.checks??[])];
  const missing=required.filter(name=>!byName.has(name));
  const failed=results.filter(item=>item?.status!=='PASS');
  return {required,missing,failed,results};
}

export function buildIntegrationExecutionReceipt({packet,preflight,execution}={}){
  need(packet?.schema==='ai-core-integration-work-packet/v1','INTEGRATION_WORK_PACKET_REQUIRED');
  need(STABLE_ID.test(packet.packet_id??''),'INTEGRATION_PACKET_ID_INVALID');
  need(preflight?.schema==='ai-core-integration-preflight/v1'&&preflight.status==='SEALED','INTEGRATION_PREFLIGHT_SEAL_REQUIRED');
  need(preflight.packet_id===packet.packet_id,'INTEGRATION_PREFLIGHT_PACKET_MISMATCH');
  need(preflight.expected_revision===packet.expected_revision,'INTEGRATION_PREFLIGHT_REVISION_MISMATCH');
  need(execution&&typeof execution==='object'&&!Array.isArray(execution),'INTEGRATION_EXECUTION_RESULT_REQUIRED');

  const status=clean(execution.status);
  need(RECEIPT_STATUSES.has(status),'INTEGRATION_EXECUTION_STATUS_INVALID');
  need(nonempty(execution.attempt_id)&&STABLE_ID.test(execution.attempt_id),'INTEGRATION_EXECUTION_ATTEMPT_ID_INVALID');
  need(nonempty(execution.actor),'INTEGRATION_EXECUTION_ACTOR_REQUIRED');
  need(nonempty(execution.executor),'INTEGRATION_EXECUTION_EXECUTOR_REQUIRED');
  need(nonempty(execution.correlation_id)&&STABLE_ID.test(execution.correlation_id),'INTEGRATION_EXECUTION_CORRELATION_INVALID');
  need(Number.isFinite(Date.parse(execution.started_at)),'INTEGRATION_EXECUTION_STARTED_AT_INVALID');
  need(Number.isFinite(Date.parse(execution.ended_at)),'INTEGRATION_EXECUTION_ENDED_AT_INVALID');
  need(Date.parse(execution.ended_at)>=Date.parse(execution.started_at),'INTEGRATION_EXECUTION_TIME_ORDER_INVALID');

  const performed=execution.performed===true;
  if(performed) need(nonempty(execution.authorization_ref),'INTEGRATION_EXECUTION_AUTHORITY_REF_REQUIRED');
  if(status==='SUCCEEDED') need(performed,'INTEGRATION_SUCCESS_REQUIRES_PERFORMED_EXECUTION');

  const verification=verificationSummary(packet,execution.verification_results??[]);
  if(status==='SUCCEEDED'){
    need(verification.missing.length===0,'INTEGRATION_SUCCESS_VERIFICATION_MISSING');
    need(verification.failed.length===0,'INTEGRATION_SUCCESS_VERIFICATION_FAILED');
  }

  const reasonCode=execution.reason_code==null?null:clean(execution.reason_code);
  if(reasonCode!==null) need(REASON_CODE.test(reasonCode),'INTEGRATION_EXECUTION_REASON_CODE_INVALID');

  const outputRefs=[...(execution.output_refs??[])].map(clean).filter(Boolean);
  const evidenceRefs=[
    `PREFLIGHT:${preflight.seal_digest}`,
    ...(performed?[`AUTHORITY:${clean(execution.authorization_ref)}`]:[]),
    ...[...(execution.evidence_refs??[])].map(clean).filter(Boolean),
    ...verification.results.map(item=>clean(item?.evidence_ref)).filter(Boolean),
  ];
  if(status==='SUCCEEDED') need(evidenceRefs.length>1,'INTEGRATION_SUCCESS_EVIDENCE_REQUIRED');

  const outputDigest=execution.output_digest==null?null:clean(execution.output_digest);
  if(outputDigest!==null) need(/^sha256:[0-9a-f]{64}$/.test(outputDigest),'INTEGRATION_OUTPUT_DIGEST_INVALID');

  const milestones=[
    {stage:'PREFLIGHT_SEALED',observed_at:preflight.observed_at,evidence_refs:[`PREFLIGHT:${preflight.seal_digest}`]},
    {stage:'EXECUTION_FINISHED',observed_at:iso(execution.ended_at),evidence_refs:[...new Set(evidenceRefs)]},
  ];
  if(verification.results.length){
    milestones.push({
      stage:'VERIFICATION_RECORDED',
      observed_at:iso(execution.ended_at),
      evidence_refs:[...new Set(verification.results.map(item=>clean(item?.evidence_ref)).filter(Boolean))],
    });
  }

  return {
    schema_version:'core-receipt/v1',
    receipt_id:`${packet.packet_id}:${execution.attempt_id}`,
    operation_id:packet.packet_id,
    operation_kind:operationKind(packet.classification),
    actor:clean(execution.actor),
    executor:clean(execution.executor),
    correlation_id:clean(execution.correlation_id),
    status,
    reason_code:reasonCode,
    input:{
      digest:preflight.seal_digest,
      refs:[
        `packet:${packet.packet_id}`,
        `repository:${packet.repository}`,
        `revision:${packet.expected_revision}`,
      ],
    },
    output:{
      digest:outputDigest,
      refs:outputRefs,
    },
    source_revision:packet.expected_revision,
    started_at:iso(execution.started_at),
    ended_at:iso(execution.ended_at),
    evidence_refs:[...new Set(evidenceRefs)],
    reproducibility:{
      deterministic:execution.deterministic===true,
      executor_version:clean(execution.executor_version)||'unknown',
      environment_revision:execution.environment_revision==null?null:clean(execution.environment_revision),
      command_ref:execution.command_ref==null?null:clean(execution.command_ref),
    },
    milestones,
    metrics:{
      packet_id:packet.packet_id,
      classification:packet.classification,
      performed,
      required_verification_count:verification.required.length,
      recorded_verification_count:verification.results.length,
    },
  };
}
