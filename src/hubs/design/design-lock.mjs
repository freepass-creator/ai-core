#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map((k)=>[k,stable(value[k])]));
  return value;
}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}

export function validateDesignLock(lock){
  const errors=[];
  if(lock?.contract!=='devcenter-design-lock/v1') errors.push('DESIGN_LOCK_CONTRACT_INVALID');
  if(!/^dl_[a-f0-9]{24}$/.test(lock?.lock_id??'')) errors.push('DESIGN_LOCK_ID_INVALID');
  if(!/^[^/]+\/[^/]+$/.test(lock?.subject?.repository??'')) errors.push('DESIGN_LOCK_REPOSITORY_INVALID');
  if(!/^[a-f0-9]{40}$/.test(lock?.subject?.revision??'')) errors.push('DESIGN_LOCK_REVISION_INVALID');
  if(!/^[a-f0-9]{40}$/.test(lock?.core_revision??'')) errors.push('DESIGN_LOCK_CORE_REVISION_INVALID');
  if(lock?.approval?.status!=='APPROVED') errors.push('DESIGN_LOCK_APPROVAL_REQUIRED');
  if(!['USER','AUTHORIZED_REVIEWER'].includes(lock?.approval?.approved_by)) errors.push('DESIGN_LOCK_APPROVER_INVALID');
  if(!lock?.approval?.evidence_ref) errors.push('DESIGN_LOCK_APPROVAL_EVIDENCE_REQUIRED');
  if(!lock?.design_plan_ref) errors.push('DESIGN_LOCK_PLAN_REF_REQUIRED');
  if(!Array.isArray(lock?.source_refs)||!lock.source_refs.length) errors.push('DESIGN_LOCK_SOURCE_REFS_REQUIRED');
  if(!Number.isFinite(Date.parse(lock?.created_at??''))) errors.push('DESIGN_LOCK_CREATED_AT_INVALID');

  const identity={
    contract:lock?.contract,
    subject:lock?.subject,
    design_plan_ref:lock?.design_plan_ref,
    core_revision:lock?.core_revision,
    approval:lock?.approval,
    source_refs:lock?.source_refs,
    previous_lock_ref:lock?.previous_lock_ref??null
  };
  const expected=`dl_${digest(identity).slice(0,24)}`;
  if(lock?.lock_id!==expected) errors.push('DESIGN_LOCK_ID_DIGEST_MISMATCH');
  return errors;
}

export function finalizeDesignLock(draft,{createdAt=new Date().toISOString()}={}){
  if(draft?.approval?.status!=='APPROVED'||!draft?.approval?.evidence_ref){
    const e=new Error('DESIGN_LOCK_EXPLICIT_APPROVAL_REQUIRED');
    throw e;
  }
  const identity={
    contract:'devcenter-design-lock/v1',
    subject:draft.subject,
    design_plan_ref:draft.design_plan_ref,
    core_revision:draft.core_revision,
    approval:draft.approval,
    source_refs:draft.source_refs,
    previous_lock_ref:draft.previous_lock_ref??null
  };
  const lock={...identity,lock_id:`dl_${digest(identity).slice(0,24)}`,created_at:createdAt};
  const errors=validateDesignLock(lock);
  if(errors.length){
    const e=new Error('DESIGN_LOCK_INVALID');
    e.details=errors;
    throw e;
  }
  return lock;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const [command,input,output]=process.argv.slice(2);
  try{
    if(!['finalize','validate'].includes(command)||!input) throw new Error('usage: design-lock.mjs finalize|validate <input.json> [output.json]');
    const data=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));
    if(command==='validate'){
      const errors=validateDesignLock(data);
      console.log(JSON.stringify({status:errors.length?'FAIL':'PASS',errors},null,2));
      process.exitCode=errors.length?1:0;
    }else{
      const lock=finalizeDesignLock(data);
      const json=JSON.stringify(lock,null,2)+'\n';
      if(output) fs.writeFileSync(path.resolve(output),json); else process.stdout.write(json);
    }
  }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message,details:error.details??[]},null,2));
    process.exitCode=1;
  }
}
