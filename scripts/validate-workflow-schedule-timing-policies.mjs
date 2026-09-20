import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';

export async function validateScheduleTimingPolicies(registry, schema=null) {
  const contract=schema ?? JSON.parse(await readFile(new URL('../contracts/workflow-schedule-timing.schema.json',import.meta.url),'utf8'));
  const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv);
  const validate=ajv.compile(contract);
  const errors=[];
  if(!validate(registry)) for(const e of validate.errors ?? []) errors.push({code:'SCHEDULE_TIMING_SCHEMA_INVALID',path:e.instancePath,detail:e.message});
  const ids=new Set();
  for(const policy of registry.policies ?? []) {
    if(ids.has(policy.policy_id)) errors.push({code:'SCHEDULE_TIMING_POLICY_DUPLICATE',path:policy.policy_id});
    ids.add(policy.policy_id);
    if(policy.late_after_ms != null && policy.missed_after_ms != null && policy.missed_after_ms < policy.late_after_ms) {
      errors.push({code:'SCHEDULE_TIMING_THRESHOLD_ORDER_INVALID',path:policy.policy_id});
    }
    if(['PILOT','COMMON_ADOPTED'].includes(policy.status)) {
      if(!Number.isInteger(policy.late_after_ms) || !Number.isInteger(policy.missed_after_ms)) errors.push({code:'SCHEDULE_TIMING_THRESHOLDS_REQUIRED_FOR_ADOPTION',path:policy.policy_id});
      if(policy.observation_contract?.status!=='AVAILABLE') errors.push({code:'SCHEDULE_TIMING_OBSERVATION_CONTRACT_REQUIRED',path:policy.policy_id});
      if(policy.evidence_level==='FAILURE_RUNTIME_EVIDENCE') errors.push({code:'SCHEDULE_TIMING_IMPLEMENTATION_EVIDENCE_REQUIRED',path:policy.policy_id});
    }
    if(policy.status==='COMMON_ADOPTED' && policy.evidence_level!=='CROSS_PROJECT_VERIFIED' && policy.evidence_level!=='COMMON_ADOPTED') {
      errors.push({code:'SCHEDULE_TIMING_COMMON_EVIDENCE_REQUIRED',path:policy.policy_id});
    }
  }
  return {status:errors.length?'INVALID':'VALID',errors};
}

if(process.argv[1]?.endsWith('validate-workflow-schedule-timing-policies.mjs')) {
  const registry=JSON.parse(await readFile(new URL('../registry/workflow-schedule-timing-policies.json',import.meta.url),'utf8'));
  const result=await validateScheduleTimingPolicies(registry);
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='VALID') process.exitCode=1;
}
