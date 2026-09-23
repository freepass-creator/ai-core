import { sealIntegrationPreflight, buildIntegrationExecutionReceipt } from './group-integration-preflight.mjs';

const need=(condition,code)=>{if(!condition) throw new Error(code);};
const clean=value=>String(value??'').normalize('NFKC').trim();
const nonempty=value=>typeof value==='string'&&value.trim()===value&&value.length>0;

const EXECUTION_STATUSES=new Set(['SUCCEEDED','HOLD','FAILED','PARTIAL']);

function adapterFor(adapters,packet){
  if(adapters instanceof Map) return adapters.get(packet.classification)??adapters.get(packet.action_kind)??null;
  return adapters?.[packet.classification]??adapters?.[packet.action_kind]??null;
}

function safeExecutionResult(value){
  need(value&&typeof value==='object'&&!Array.isArray(value),'INTEGRATION_ADAPTER_RESULT_INVALID');
  const status=clean(value.status);
  need(EXECUTION_STATUSES.has(status),'INTEGRATION_ADAPTER_STATUS_INVALID');
  need(value.execution_authorized!==true,'INTEGRATION_ADAPTER_MUST_NOT_GRANT_AUTHORITY');
  need(value.completion_authorized!==true,'INTEGRATION_ADAPTER_MUST_NOT_GRANT_COMPLETION');
  const evidenceRefs=value.evidence_refs??[];
  need(Array.isArray(evidenceRefs)&&evidenceRefs.every(nonempty),'INTEGRATION_ADAPTER_EVIDENCE_REFS_INVALID');
  return {
    status,
    performed:value.performed===true,
    reason_code:value.reason_code==null?null:clean(value.reason_code),
    output_refs:Array.isArray(value.output_refs)?value.output_refs.map(clean).filter(Boolean):[],
    output_digest:value.output_digest??null,
    evidence_refs:[...evidenceRefs],
    deterministic:value.deterministic===true,
    executor_version:clean(value.executor_version)||'unknown',
    environment_revision:value.environment_revision==null?null:clean(value.environment_revision),
    command_ref:value.command_ref==null?null:clean(value.command_ref),
  };
}

function hold(reason,extra={}){
  return {
    status:'HOLD',
    reason,
    effect_state:'NONE',
    performed:false,
    receipt:null,
    external_effect:false,
    ...extra,
  };
}

export function createGroupIntegrationExecutor({
  observeRepository,
  verifyAuthority,
  adapters=new Map(),
  verifyExecution,
  clock=Date.now,
}={}){
  need(typeof observeRepository==='function','INTEGRATION_OBSERVER_REQUIRED');
  need(typeof verifyAuthority==='function','INTEGRATION_AUTHORITY_VERIFIER_REQUIRED');
  need(typeof verifyExecution==='function','INTEGRATION_RESULT_VERIFIER_REQUIRED');

  async function prepare({packet}={}){
    need(packet?.schema==='ai-core-integration-work-packet/v1','INTEGRATION_WORK_PACKET_REQUIRED');
    const adapter=adapterFor(adapters,packet);
    if(!adapter||typeof adapter.execute!=='function'){
      return hold('INTEGRATION_EXECUTION_ADAPTER_MISSING',{packet_id:packet.packet_id});
    }
    return {
      status:'PREPARED',
      packet_id:packet.packet_id,
      classification:packet.classification,
      action_kind:packet.action_kind,
      expected_revision:packet.expected_revision,
      external_effect:false,
      execution_authorized:false,
    };
  }

  async function run({
    packet,
    authority,
    perform=false,
    attempt_id,
    actor,
    executor='ai-core-integration-executor',
    correlation_id,
  }={}){
    need(packet?.schema==='ai-core-integration-work-packet/v1','INTEGRATION_WORK_PACKET_REQUIRED');

    const prepared=await prepare({packet});
    if(prepared.status!=='PREPARED') return prepared;
    if(!perform) return prepared;

    need(nonempty(attempt_id),'INTEGRATION_ATTEMPT_ID_REQUIRED');
    need(nonempty(actor),'INTEGRATION_ACTOR_REQUIRED');
    need(nonempty(correlation_id),'INTEGRATION_CORRELATION_ID_REQUIRED');

    let observation;
    try{
      observation=await observeRepository({packet:structuredClone(packet)});
    }catch(error){
      return hold('INTEGRATION_PREFLIGHT_OBSERVATION_FAILED',{
        packet_id:packet.packet_id,
        detail:error?.message??null,
      });
    }

    let preflight;
    try{
      preflight=sealIntegrationPreflight({packet,observation});
    }catch(error){
      return hold(error?.message??'INTEGRATION_PREFLIGHT_FAILED',{
        packet_id:packet.packet_id,
      });
    }

    let authorityDecision;
    try{
      authorityDecision=await verifyAuthority({
        authority:structuredClone(authority),
        packet:structuredClone(packet),
        preflight:structuredClone(preflight),
      });
    }catch(error){
      return hold('INTEGRATION_AUTHORITY_VERIFY_FAILED',{
        packet_id:packet.packet_id,
        detail:error?.message??null,
        preflight,
      });
    }

    if(authorityDecision?.ok!==true||!nonempty(authorityDecision?.ref)){
      return hold(authorityDecision?.reason??'INTEGRATION_AUTHORITY_NOT_VERIFIED',{
        packet_id:packet.packet_id,
        preflight,
      });
    }

    // Re-observe after authority verification so execution cannot rely on an older source observation.
    let finalObservation;
    try{
      finalObservation=await observeRepository({packet:structuredClone(packet),phase:'FINAL'});
    }catch(error){
      return hold('INTEGRATION_FINAL_REOBSERVATION_FAILED',{
        packet_id:packet.packet_id,
        detail:error?.message??null,
        preflight,
      });
    }

    let finalPreflight;
    try{
      finalPreflight=sealIntegrationPreflight({packet,observation:finalObservation});
    }catch(error){
      return hold(error?.message??'INTEGRATION_FINAL_PREFLIGHT_FAILED',{
        packet_id:packet.packet_id,
        preflight,
      });
    }

    const adapter=adapterFor(adapters,packet);
    const startedAt=new Date(clock()).toISOString();

    let executionResult;
    try{
      executionResult=safeExecutionResult(await adapter.execute({
        packet:structuredClone(packet),
        preflight:structuredClone(finalPreflight),
        authority:structuredClone(authority),
        authority_ref:authorityDecision.ref,
        attempt_id,
        actor,
        correlation_id,
      }));
    }catch(error){
      return hold('INTEGRATION_EXECUTION_OUTCOME_UNKNOWN',{
        packet_id:packet.packet_id,
        preflight:finalPreflight,
        authority_ref:authorityDecision.ref,
        effect_state:'UNKNOWN',
        performed:null,
        external_effect:null,
        outcome_known:false,
        detail:error?.message??null,
      });
    }

    let verificationResults=[];
    try{
      verificationResults=await verifyExecution({
        packet:structuredClone(packet),
        preflight:structuredClone(finalPreflight),
        authority_ref:authorityDecision.ref,
        execution:structuredClone(executionResult),
      });
      need(Array.isArray(verificationResults),'INTEGRATION_VERIFICATION_RESULT_INVALID');
    }catch(error){
      return hold('INTEGRATION_POST_EXECUTION_VERIFICATION_UNAVAILABLE',{
        packet_id:packet.packet_id,
        preflight:finalPreflight,
        authority_ref:authorityDecision.ref,
        execution:executionResult,
        effect_state:executionResult.performed?'PERFORMED':'NONE',
        performed:executionResult.performed,
        external_effect:executionResult.performed,
        outcome_known:true,
        detail:error?.message??null,
      });
    }

    const endedAt=new Date(clock()).toISOString();

    let receipt;
    try{
      receipt=buildIntegrationExecutionReceipt({
        packet,
        preflight:finalPreflight,
        execution:{
          ...executionResult,
          attempt_id,
          actor,
          executor,
          correlation_id,
          started_at:startedAt,
          ended_at:endedAt,
          authorization_ref:authorityDecision.ref,
          verification_results:verificationResults,
        },
      });
    }catch(error){
      return hold(error?.message??'INTEGRATION_RECEIPT_BUILD_FAILED',{
        packet_id:packet.packet_id,
        preflight:finalPreflight,
        authority_ref:authorityDecision.ref,
        execution:executionResult,
        verification_results:verificationResults,
        effect_state:executionResult.performed?'PERFORMED':'NONE',
        performed:executionResult.performed,
        external_effect:executionResult.performed,
        outcome_known:true,
      });
    }

    return {
      status:receipt.status,
      packet_id:packet.packet_id,
      effect_state:executionResult.performed?'PERFORMED':'NONE',
      performed:executionResult.performed,
      external_effect:executionResult.performed,
      outcome_known:true,
      preflight:finalPreflight,
      authority_ref:authorityDecision.ref,
      verification_results:verificationResults,
      receipt,
    };
  }

  return Object.freeze({prepare,run});
}
