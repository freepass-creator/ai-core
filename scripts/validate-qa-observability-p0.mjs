import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const readJson=path=>readFile(resolve(root,path),'utf8').then(JSON.parse);
const schemaPaths=[
  'contracts/qa-checker-manifest.schema.json',
  'contracts/qa-result.schema.json',
  'contracts/observability-health.schema.json',
  'contracts/observability-job-status.schema.json',
  'contracts/observability-context.schema.json'
];
const [schemas,levels]=await Promise.all([
  Promise.all(schemaPaths.map(readJson)),
  readJson('registry/qa-proof-levels.candidate.json')
]);
const ajv=new Ajv2020({allErrors:true,strict:false});
addFormats(ajv);
for(const schema of schemas) ajv.addSchema(schema);

const errors=[];
if(registry.status!=='CANONICAL_PARTIAL') errors.push({code:'STANDARD_MATURITY_NOT_PROMOTED',status:registry.status});
const ids=(levels.levels??[]).map(x=>x.id);
const expected=['FIXTURE','SYNTHETIC','EMULATOR','PREVIEW','PRODUCTION'];
for(const id of expected) if(!ids.includes(id)) errors.push({code:'QA_PROOF_LEVEL_MISSING',id});
if(new Set(ids).size!==ids.length) errors.push({code:'QA_PROOF_LEVEL_DUPLICATE'});
const ranks=(levels.levels??[]).map(x=>x.rank);
if(new Set(ranks).size!==ranks.length) errors.push({code:'QA_PROOF_RANK_DUPLICATE'});

console.log(JSON.stringify({
  status:errors.length?'INVALID':'VALID_CANONICAL_PARTIAL',
  canonical:'PARTIAL',
  schemas:schemaPaths,
  proof_levels:ids,
  errors
},null,2));
if(errors.length) process.exitCode=1;
