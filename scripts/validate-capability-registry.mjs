import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCapabilityRegistryReferences } from '../src/engine/capability-registry.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const capabilityPath=args[0]??join(root,'registry','capabilities.json');
const projectPath=args[1]??join(root,'registry','projects.json');
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const [registry,projects,schema]=await Promise.all([
  readJson(capabilityPath),readJson(projectPath),readJson(join(root,'contracts','capability-registry.schema.json'))
]);
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv); const valid=ajv.compile(schema);
const errors=[];
if(!valid(registry)) errors.push(...valid.errors.map(e=>({code:'SCHEMA_'+String(e.keyword).toUpperCase(),path:e.instancePath||'$'})));
try{validateCapabilityRegistryReferences(registry,projects);}catch(e){errors.push({code:e.message,path:'$'});}
const result={status:errors.length?'INVALID':'VALID',errors,capability_count:registry.capabilities?.length??0};
console.log(JSON.stringify(result,null,2)); if(errors.length) process.exitCode=1;
