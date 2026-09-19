import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const registry=await readJson('registry/core-contracts.json');
const errorRegistry=await readJson('registry/core-error-codes.json');
const errors=[];

if(registry.schema_version!=='core-contract-registry/v1') errors.push({code:'REGISTRY_VERSION_INVALID',path:'registry/core-contracts.json'});
if(registry.owner!=='C_CORE_CONTRACT_STANDARD') errors.push({code:'REGISTRY_OWNER_INVALID',path:'registry/core-contracts.json'});
if(!Array.isArray(registry.contracts)||registry.contracts.length===0) errors.push({code:'REGISTRY_EMPTY',path:'registry/core-contracts.json'});

const ids=new Set(), paths=new Set(), schemas=[];
for(const contract of registry.contracts??[]){
  if(ids.has(contract.id)) errors.push({code:'CONTRACT_ID_DUPLICATE',path:contract.id}); else ids.add(contract.id);
  if(paths.has(contract.path)) errors.push({code:'CONTRACT_PATH_DUPLICATE',path:contract.path}); else paths.add(contract.path);
  const abs=resolve(root,contract.path);
  const rel=relative(root,abs);
  if(isAbsolute(rel)||rel.startsWith('..')||!contract.path.startsWith('contracts/')) {
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
  try{ ajv.addSchema(schema); }
  catch(error){ errors.push({code:'SCHEMA_REGISTER_FAILED',path:contract.path,detail:error.message}); }
}
for(const {contract,schema} of schemas){
  try{ if(!ajv.getSchema(schema.$id)) errors.push({code:'SCHEMA_COMPILE_FAILED',path:contract.path}); }
  catch(error){ errors.push({code:'SCHEMA_COMPILE_FAILED',path:contract.path,detail:error.message}); }
}

if(errorRegistry.schema_version!=='core-error-code-registry/v1') errors.push({code:'ERROR_REGISTRY_VERSION_INVALID',path:'registry/core-error-codes.json'});
const errorCodes=new Set();
for(const item of errorRegistry.codes??[]){
  if(!/^[A-Z][A-Z0-9_]*$/.test(item.code??'')) errors.push({code:'ERROR_CODE_INVALID',path:item.code??'$'});
  if(errorCodes.has(item.code)) errors.push({code:'ERROR_CODE_DUPLICATE',path:item.code}); else errorCodes.add(item.code);
  if(!['USER','SYSTEM','PROVIDER'].includes(item.category)) errors.push({code:'ERROR_CATEGORY_INVALID',path:item.code});
  if(!Number.isInteger(item.default_http_status)||item.default_http_status<400||item.default_http_status>599) errors.push({code:'ERROR_HTTP_STATUS_INVALID',path:item.code});
  if(typeof item.retryable!=='boolean') errors.push({code:'ERROR_RETRYABLE_INVALID',path:item.code});
}

const result={
  status:errors.length?'INVALID':'VALID',
  contract_count:registry.contracts?.length??0,
  error_code_count:errorRegistry.codes?.length??0,
  errors
};
console.log(JSON.stringify(result,null,2));
if(errors.length) process.exitCode=1;
