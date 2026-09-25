const need=(condition,code)=>{if(!condition) throw new Error(code);};
const nonempty=value=>typeof value==='string'&&value.trim().length>0;

export function bridgeLegacyAdapterResult({
  legacy,
  adapterId,
  adapterVersion,
  providerId=null,
  sourceRevision=null,
  correlationId,
  retryable,
  startedAt,
  endedAt
}){
  need(legacy&&typeof legacy==='object'&&!Array.isArray(legacy),'LEGACY_ADAPTER_RESULT_REQUIRED');
  need(['SUCCEEDED','HOLD','FAILED'].includes(legacy.status),'LEGACY_ADAPTER_STATUS_INVALID');
  need(nonempty(adapterId),'ADAPTER_ID_REQUIRED');
  need(nonempty(adapterVersion),'ADAPTER_VERSION_REQUIRED');
  need(nonempty(correlationId),'CORRELATION_ID_REQUIRED');
  need(typeof retryable==='boolean','RETRYABLE_DECISION_REQUIRED');
  need(nonempty(startedAt)&&nonempty(endedAt),'EXECUTION_TIME_REQUIRED');

  const blockers=Array.isArray(legacy.blockers)?legacy.blockers:[];
  const failedChecks=(Array.isArray(legacy.checks)?legacy.checks:[]).filter(x=>x?.status==='FAIL');
  const issues=[
    ...blockers.map(message=>({code:'LEGACY_BLOCKER',severity:'BLOCKING',message:String(message)})),
    ...failedChecks.map(check=>({code:'LEGACY_CHECK_FAILED',severity:'ERROR',field:check?.name??undefined,message:check?.detail??check?.name??'legacy check failed'}))
  ];
  const status=legacy.status==='SUCCEEDED'&&issues.length>0?'HOLD':legacy.status;

  return {
    schema_version:'core-adapter-result/v1',
    adapter_id:adapterId,
    adapter_version:adapterVersion,
    provider_id:providerId,
    source_revision:sourceRevision,
    correlation_id:correlationId,
    status,
    retryable,
    data:legacy.data??null,
    issues,
    evidence_refs:[...(legacy.evidence??[])],
    started_at:startedAt,
    ended_at:endedAt
  };
}
