import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';

export async function validateWorkflowCompensationPolicies(registry, schema=null) {
  const contract=schema ?? JSON.parse(await readFile(new URL('../contracts/workflow-compensation.schema.json',import.meta.url),'utf8'));
  const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv);
  const validate=ajv.compile(contract);
  const errors=[];
  if (!validate(registry)) for (const e of validate.errors ?? []) errors.push({code:'WORKFLOW_COMPENSATION_SCHEMA_INVALID',path:e.instancePath,detail:e.message});
  const ids=new Set();
  for (const policy of registry.policies ?? []) {
    if (ids.has(policy.policy_id)) errors.push({code:'WORKFLOW_COMPENSATION_POLICY_DUPLICATE',path:policy.policy_id});
    ids.add(policy.policy_id);
    if (policy.adoption_status==='COMMON_ADOPTED') {
      if (policy.evidence_level!=='CROSS_PROJECT_VERIFIED' && policy.evidence_level!=='COMMON_ADOPTED') errors.push({code:'WORKFLOW_COMPENSATION_COMMON_EVIDENCE_REQUIRED',path:policy.policy_id});
      if ((policy.source_projects ?? []).length < 2) errors.push({code:'WORKFLOW_COMPENSATION_SECOND_PROJECT_REQUIRED',path:policy.policy_id});
    }
  }
  return {status:errors.length?'INVALID':'VALID',errors};
}

if (process.argv[1]?.endsWith('validate-workflow-compensation-policies.mjs')) {
  const registry=JSON.parse(await readFile(new URL('../registry/workflow-compensation-policies.json',import.meta.url),'utf8'));
  const result=await validateWorkflowCompensationPolicies(registry);
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='VALID') process.exitCode=1;
}
