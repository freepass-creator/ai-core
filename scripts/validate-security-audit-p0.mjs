import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const readJson=path=>readFile(resolve(root,path),'utf8').then(JSON.parse);
const schemaPaths=[
  'contracts/security-authz-context.schema.json',
  'contracts/security-action-policy.schema.json',
  'contracts/security-approval-bundle.schema.json',
  'contracts/security-audit-record.schema.json',
];
const schemas=await Promise.all(schemaPaths.map(readJson));
const registry=await readJson('registry/security-action-policies.candidate.json');
const ajv=new Ajv2020({allErrors:true,strict:false});
addFormats(ajv);
for(const schema of schemas) ajv.addSchema(schema);

const policyValidator=ajv.getSchema('https://schemas.freepass.ai/security/action-policy/v1');
const errors=[];
if(registry.status!=='CANONICAL_PARTIAL') errors.push({code:'STANDARD_MATURITY_NOT_PROMOTED',status:registry.status});
for(const [i,policy] of (registry.policies??[]).entries()) {
  if(!policyValidator(policy)) {
    for(const e of policyValidator.errors??[]) errors.push({path:`registry/security-action-policies.candidate.json/policies/${i}${e.instancePath}`,keyword:e.keyword,message:e.message});
  }
}
const ids=(registry.policies??[]).map(x=>x.policy_id);
if(new Set(ids).size!==ids.length) errors.push({path:'registry/security-action-policies.candidate.json',message:'duplicate policy_id'});
const classes=(registry.policies??[]).map(x=>x.risk_class);
for(const risk of ['READ_ONLY','LOCAL_MUTATION','REVERSIBLE_EXTERNAL_MUTATION','PRIVILEGED_MUTATION','IRREVERSIBLE_EXTERNAL_ACTION']) {
  if(!classes.includes(risk)) errors.push({path:'registry/security-action-policies.candidate.json',message:`missing risk class ${risk}`});
}

console.log(JSON.stringify({
  status:errors.length?'INVALID':'VALID_CANONICAL_PARTIAL',
  canonical:'PARTIAL',
  policy_count:registry.policies?.length??0,
  schemas:schemaPaths,
  errors
},null,2));
if(errors.length) process.exitCode=1;
