import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const baseRef=process.env.CONTRACT_BASE_REF||process.argv[2]||'origin/main';
const readCurrent=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
function readBase(path){
  try{return JSON.parse(execFileSync('git',['show',baseRef+':'+path],{cwd:root,encoding:'utf8'}));}
  catch{return null;}
}
const asTypes=value=>new Set(Array.isArray(value)?value:(value?[value]:[]));
const pathJoin=(base,key)=>base?base+'.'+key:key;

export function findBreakingSchemaChanges(before,after,path='$'){
  const errors=[];
  if(!before||typeof before!=='object'||!after||typeof after!=='object') return errors;

  if('const' in before && JSON.stringify(before.const)!==JSON.stringify(after.const)){
    errors.push({code:'CONST_CHANGED',path,before:before.const,after:after.const});
  }

  if(Array.isArray(before.enum)){
    if(!Array.isArray(after.enum)){
      errors.push({code:'ENUM_CONTRACT_REMOVED',path});
    }else{
      const afterValues=new Set(after.enum.map(x=>JSON.stringify(x)));
      for(const value of before.enum){
        if(!afterValues.has(JSON.stringify(value))) errors.push({code:'ENUM_VALUE_REMOVED',path,value});
      }
    }
  }

  if(before.type){
    const b=asTypes(before.type), a=asTypes(after.type);
    if(a.size===0) errors.push({code:'TYPE_CONSTRAINT_REMOVED_AMBIGUOUS',path});
    else for(const t of b) if(!a.has(t)) errors.push({code:'TYPE_NARROWED',path,type:t});
  }

  const bRequired=new Set(before.required??[]);
  const aRequired=new Set(after.required??[]);
  for(const key of aRequired) if(!bRequired.has(key)) errors.push({code:'REQUIRED_FIELD_ADDED',path:pathJoin(path,key)});

  if(before.properties&&typeof before.properties==='object'){
    const afterProps=after.properties??{};
    for(const [key,bProp] of Object.entries(before.properties)){
      if(!(key in afterProps)){
        errors.push({code:'PROPERTY_REMOVED',path:pathJoin(path,key)});
        continue;
      }
      errors.push(...findBreakingSchemaChanges(bProp,afterProps[key],pathJoin(path,key)));
    }
  }

  if(before.additionalProperties!==false && after.additionalProperties===false){
    errors.push({code:'ADDITIONAL_PROPERTIES_TIGHTENED',path});
  }

  const stricterMin=(key)=>{
    if(typeof before[key]==='number'&&typeof after[key]==='number'&&after[key]>before[key]) errors.push({code:key.toUpperCase()+'_TIGHTENED',path,before:before[key],after:after[key]});
    if(before[key]===undefined&&typeof after[key]==='number'&&after[key]>0) errors.push({code:key.toUpperCase()+'_ADDED',path,after:after[key]});
  };
  const stricterMax=(key)=>{
    if(typeof before[key]==='number'&&typeof after[key]==='number'&&after[key]<before[key]) errors.push({code:key.toUpperCase()+'_TIGHTENED',path,before:before[key],after:after[key]});
    if(before[key]===undefined&&typeof after[key]==='number') errors.push({code:key.toUpperCase()+'_ADDED',path,after:after[key]});
  };
  for(const key of ['minimum','exclusiveMinimum','minLength','minItems','minProperties']) stricterMin(key);
  for(const key of ['maximum','exclusiveMaximum','maxLength','maxItems','maxProperties']) stricterMax(key);

  if(before.pattern!==undefined && after.pattern!==before.pattern){
    errors.push({code:'PATTERN_CHANGED',path,before:before.pattern,after:after.pattern});
  }
  if(before.format!==undefined && after.format!==before.format){
    errors.push({code:'FORMAT_CHANGED',path,before:before.format,after:after.format});
  }
  if(before.$ref!==undefined && after.$ref!==before.$ref){
    errors.push({code:'REF_CHANGED',path,before:before.$ref,after:after.$ref});
  }

  return errors;
}

export async function checkCompatibility({baseRegistry,currentRegistry,readBaseSchema,readCurrentSchema}){
  if(!baseRegistry) return {status:'BASE_NOT_INITIALIZED',errors:[]};
  const errors=[];
  const currentById=new Map((currentRegistry.contracts??[]).map(x=>[x.id,x]));

  for(const prior of baseRegistry.contracts??[]){
    if(prior.status!=='CANONICAL') continue;
    const current=currentById.get(prior.id);
    if(!current){
      errors.push({code:'CANONICAL_CONTRACT_REMOVED',contract_id:prior.id,path:prior.path});
      continue;
    }
    if(current.path!==prior.path){
      errors.push({code:'CANONICAL_CONTRACT_PATH_CHANGED',contract_id:prior.id,before:prior.path,after:current.path});
      continue;
    }
    const before=await readBaseSchema(prior.path);
    const after=await readCurrentSchema(current.path);
    if(!before||!after) continue;
    const breaking=findBreakingSchemaChanges(before,after);
    for(const item of breaking) errors.push({code:'BREAKING_CHANGE_REQUIRES_NEW_MAJOR',contract_id:prior.id,change:item});
  }
  return {status:errors.length?'INVALID':'VALID',errors};
}

const invoked=process.argv[1]?resolve(process.argv[1]):null;
if(invoked===fileURLToPath(import.meta.url)){
  const currentRegistry=await readCurrent('registry/core-contracts.json');
  const baseRegistry=readBase('registry/core-contracts.json');
  const result=await checkCompatibility({
    baseRegistry,currentRegistry,
    readBaseSchema:async path=>readBase(path),
    readCurrentSchema:async path=>readCurrent(path)
  });
  console.log(JSON.stringify({base_ref:baseRef,...result},null,2));
  if(result.status==='INVALID') process.exitCode=1;
}
