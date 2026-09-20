import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const readJson=path=>readFile(resolve(root,path),'utf8').then(JSON.parse);
const schemaPaths=[
  'contracts/governance-build-manifest.schema.json',
  'contracts/governance-release-proof.schema.json',
  'contracts/governance-rollback-plan.schema.json',
  'contracts/governance-project-observation.schema.json',
  'contracts/governance-exception.schema.json',
  'contracts/governance-deprecation.schema.json',
  'contracts/governance-decision-record.schema.json',
  'contracts/governance-repository-lifecycle.schema.json'
];
const [schemas,registry]=await Promise.all([
  Promise.all(schemaPaths.map(readJson)),
  readJson('registry/governance-profiles.candidate.json')
]);
const ajv=new Ajv2020({allErrors:true,strict:false});
addFormats(ajv);
for(const schema of schemas) ajv.addSchema(schema);

const errors=[];
if(registry.status!=='CANONICAL_PARTIAL') errors.push({code:'STANDARD_MATURITY_NOT_PROMOTED',status:registry.status});
const expectedRelease=[
  'SOURCE_COMMITTED','CI_VERIFIED','BUILD_CREATED',
  'DEPLOYMENT_READY','PRODUCTION_OBSERVED','RELEASE_VERIFIED'
];
for(const state of expectedRelease){
  if(!(registry.release_state_model??[]).includes(state)) errors.push({code:'GOVERNANCE_RELEASE_STATE_MISSING',state});
}
for(const state of ['ACTIVE','REFERENCE','HOLD','RETIRE']){
  if(!(registry.repository_lifecycle??[]).includes(state)) errors.push({code:'GOVERNANCE_REPO_STATE_MISSING',state});
}

console.log(JSON.stringify({
  status:errors.length?'INVALID':'VALID_CANONICAL_PARTIAL',
  canonical:'PARTIAL',
  schemas:schemaPaths,
  release_states:registry.release_state_model,
  repository_lifecycle:registry.repository_lifecycle,
  errors
},null,2));
if(errors.length) process.exitCode=1;
