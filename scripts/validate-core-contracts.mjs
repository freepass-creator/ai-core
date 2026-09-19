import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const [registry,errorRegistry,eventRegistry]=await Promise.all([
  readJson('registry/core-contracts.json'),
  readJson('registry/core-error-codes.json'),
  readJson('registry/core-event-types.json')
]);
const errors=[];

const ids=new Set(), paths=new Set(), schemas=[];
for(const contract of registry.contracts??[]){
  if(ids.has(contract.id)) errors.push({code:'CONTRACT_ID_DUPLICATE',path:contract.id}); else ids.add(contract.id);
  if(paths.has(contract.path)) errors.push({code:'CONTRACT_PATH_DUPLICATE',path:contract.path}); else paths.add(contract.path);
  const abs=resolve(root,contract.path);
  const rel=relative(root,abs);
  if(isAbsolute(rel)||rel.startsWith('..')||!contract.path.startsWith('contracts/')){
    errors.push({code:'CONTRACT_PATH_UNSAFE',path:contract.path});
    continue;
  }
  try{
    const schema=JSON.parse(await readFile(abs,'utf8'));
    if(schema.$schema!=='https://json-schema.org/draft/2020-12/schema') errors.push({code:'SCHEMA_DRAFT_INVALID',path:contract.path});
    if(!schema.$id) errors.push({code:'SCHEMA_ID_REQUIRED',path:contract.path});
    schemas.push({contract,schema});
  }catch(error){
    errors.push({code:'SCHEMA_READ_FAILED',path:contract.path,detail:error.message});
  }
}

const ajv=new Ajv2020({allErrors:true,strict:false});
addFormats(ajv);
for(const {contract,schema} of schemas){
  try{ajv.addSchema(schema);}
  catch(error){errors.push({code:'SCHEMA_REGISTER_FAILED',path:contract.path,detail:error.message});}
}
for(const {contract,schema} of schemas){
  try{if(!ajv.getSchema(schema.$id)) errors.push({code:'SCHEMA_COMPILE_FAILED',path:contract.path});}
  catch(error){errors.push({code:'SCHEMA_COMPILE_FAILED',path:contract.path,detail:error.message});}
}

function validateInstance(schemaId,value,path,code){
  try{
    const validate=ajv.getSchema(schemaId);
    if(!validate){errors.push({code:'VALIDATOR_MISSING',path,detail:schemaId});return;}
    if(!validate(value)){
      for(const error of validate.errors??[]) errors.push({
        code,
        path:`${path}${error.instancePath||''}`,
        detail:`${error.keyword}: ${error.message}`
      });
    }
  }catch(error){errors.push({code,path,detail:error.message});}
}

validateInstance('https://schemas.freepass.ai/core/contract-registry/v1',registry,'registry/core-contracts.json','CONTRACT_REGISTRY_SCHEMA_INVALID');
validateInstance('https://schemas.freepass.ai/core/error-code-registry/v1',errorRegistry,'registry/core-error-codes.json','ERROR_REGISTRY_SCHEMA_INVALID');
validateInstance('https://schemas.freepass.ai/core/event-type-registry/v1',eventRegistry,'registry/core-event-types.json','EVENT_REGISTRY_SCHEMA_INVALID');

const errorCodes=new Set();
for(const item of errorRegistry.codes??[]){
  if(errorCodes.has(item.code)) errors.push({code:'ERROR_CODE_DUPLICATE',path:item.code});
  else errorCodes.add(item.code);
}

const eventKeys=new Set();
for(const item of eventRegistry.types??[]){
  const key=`${item.event_type}@${item.event_version}`;
  if(eventKeys.has(key)) errors.push({code:'EVENT_TYPE_DUPLICATE',path:key});
  else eventKeys.add(key);
}

const result={
  status:errors.length?'INVALID':'VALID',
  contract_count:registry.contracts?.length??0,
  error_code_count:errorRegistry.codes?.length??0,
  event_type_count:eventRegistry.types?.length??0,
  errors
};
console.log(JSON.stringify(result,null,2));
if(errors.length) process.exitCode=1;
