#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const HERE=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}

function gitBlob(repoPath,revision,filePath){
  const r=spawnSync('git',['rev-parse',`${revision}:${filePath}`],{cwd:repoPath,encoding:'utf8',windowsHide:true});
  if(r.status!==0) return null;
  return (r.stdout||'').trim();
}

export function validateEngineeringAssets(registry){
  const errors=[];
  if(registry?.contract!=='devcenter-engineering-assets/v1') errors.push('ENGINEERING_ASSET_CONTRACT_INVALID');
  if(!Array.isArray(registry?.assets)||!registry.assets.length) errors.push('ENGINEERING_ASSETS_REQUIRED');
  const ids=new Set();
  for(const asset of registry?.assets??[]){
    if(!asset?.id||ids.has(asset.id)) errors.push(`ENGINEERING_ASSET_ID_INVALID:${asset?.id??'(missing)'}`);
    ids.add(asset?.id);
    if(!['CANDIDATE','ACTIVE','DEPRECATED','RETIRED'].includes(asset?.status)) errors.push(`ENGINEERING_ASSET_STATUS_INVALID:${asset?.id}`);
    if(!/^[a-f0-9]{40}$/.test(asset?.source?.revision??'')) errors.push(`ENGINEERING_ASSET_REVISION_INVALID:${asset?.id}`);
    if(!/^[a-f0-9]{40}$/.test(asset?.source?.blob_sha??'')) errors.push(`ENGINEERING_ASSET_BLOB_INVALID:${asset?.id}`);
    if(!Array.isArray(asset?.verification)||!asset.verification.length) errors.push(`ENGINEERING_ASSET_VERIFICATION_REQUIRED:${asset?.id}`);
    if(asset?.status==='DEPRECATED'&&!asset?.lifecycle?.superseded_by) errors.push(`ENGINEERING_DEPRECATED_SUCCESSOR_REQUIRED:${asset?.id}`);
    if(asset?.status==='ACTIVE'&&!asset?.lifecycle?.rollback_ref) errors.push(`ENGINEERING_ACTIVE_ROLLBACK_REQUIRED:${asset?.id}`);
  }
  return errors;
}

export function verifyLocalSources(registry,{repoRoots={}}={}){
  const results=[];
  for(const asset of registry.assets??[]){
    const repoPath=repoRoots[asset.source.repository];
    if(!repoPath){
      results.push({id:asset.id,status:'HOLD',reason:'SOURCE_REPOSITORY_NOT_MOUNTED'});
      continue;
    }
    const blob=gitBlob(repoPath,asset.source.revision,asset.source.path);
    results.push(blob===asset.source.blob_sha
      ? {id:asset.id,status:'PASS',blob_sha:blob}
      : {id:asset.id,status:'FAIL',expected:asset.source.blob_sha,actual:blob});
  }
  return results;
}

export function evaluateConsumer(consumer,registry){
  const assets=new Map((registry.assets??[]).map((a)=>[a.id,a]));
  const errors=[];
  const holds=[];
  for(const id of consumer?.asset_ids??[]){
    const asset=assets.get(id);
    if(!asset){errors.push(`ENGINEERING_CONSUMER_ASSET_UNKNOWN:${id}`);continue;}
    if(asset.status==='RETIRED') errors.push(`ENGINEERING_CONSUMER_ASSET_RETIRED:${id}`);
    if(asset.status==='DEPRECATED') holds.push(`ENGINEERING_CONSUMER_ASSET_DEPRECATED:${id}`);
    if(asset.status==='CANDIDATE') holds.push(`ENGINEERING_CONSUMER_ASSET_CANDIDATE:${id}`);
  }
  return {status:errors.length?'FAIL':holds.length?'HOLD':'MAPPED',errors,holds};
}

export function planPromotion(asset,{decision,evidence_refs=[]}={}){
  if(!asset?.id) throw new Error('ENGINEERING_PROMOTION_ASSET_REQUIRED');
  if(!['ADOPT','HOLD','REJECT','DEPRECATE','RETIRE'].includes(decision)) throw new Error('ENGINEERING_PROMOTION_DECISION_INVALID');
  if(!Array.isArray(evidence_refs)||!evidence_refs.length) throw new Error('ENGINEERING_PROMOTION_EVIDENCE_REQUIRED');
  const targetStatus={
    ADOPT:'ACTIVE',
    HOLD:asset.status,
    REJECT:'CANDIDATE',
    DEPRECATE:'DEPRECATED',
    RETIRE:'RETIRED'
  }[decision];
  return {
    contract:'devcenter-engineering-promotion/v1',
    asset_id:asset.id,
    from_status:asset.status,
    decision,
    target_status:targetStatus,
    evidence_refs,
    requires_new_revision:decision!=='HOLD'
  };
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const [command]=process.argv.slice(2);
  try{
    const registry=readJson(path.join(HERE,'hubs','engineering','assets.json'));
    if(command==='validate'){
      const errors=validateEngineeringAssets(registry);
      console.log(JSON.stringify({status:errors.length?'FAIL':'PASS',errors,asset_count:registry.assets.length},null,2));
      process.exitCode=errors.length?1:0;
    }else throw new Error('commands: validate');
  }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message},null,2));
    process.exitCode=1;
  }
}
