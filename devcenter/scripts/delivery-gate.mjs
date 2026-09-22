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
function digest(value){
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

export function validateRelease(release){
  const errors=[];
  if(release?.contract!=='devcenter-delivery-release/v1') errors.push('DELIVERY_RELEASE_CONTRACT_INVALID');
  if(!/^[^/]+\/[^/]+$/.test(release?.subject?.repository??'')) errors.push('DELIVERY_RELEASE_REPOSITORY_INVALID');
  if(!/^[a-f0-9]{40}$/.test(release?.subject?.revision??'')) errors.push('DELIVERY_RELEASE_REVISION_INVALID');
  if(!['PREVIEW','STAGING','PRODUCTION'].includes(release?.target?.environment)) errors.push('DELIVERY_RELEASE_ENVIRONMENT_INVALID');
  if(!release?.target?.provider||!release?.target?.application) errors.push('DELIVERY_RELEASE_TARGET_REQUIRED');
  if(!Array.isArray(release?.quality?.required_receipts)||!release.quality.required_receipts.length) errors.push('DELIVERY_QUALITY_RECEIPT_REQUIRED');
  if(!Array.isArray(release?.build?.commands)||!release.build.commands.length) errors.push('DELIVERY_BUILD_COMMAND_REQUIRED');
  if(!Array.isArray(release?.release?.commands)||!release.release.commands.length) errors.push('DELIVERY_DEPLOY_COMMAND_REQUIRED');
  if(release?.target?.environment==='PRODUCTION'&&release?.release?.approval_required!==true) errors.push('DELIVERY_PRODUCTION_APPROVAL_REQUIRED');
  if(release?.target?.environment==='PRODUCTION'&&release?.release?.approval_required===true&&!release?.release?.approval_ref) errors.push('DELIVERY_PRODUCTION_APPROVAL_REF_REQUIRED');
  if(!release?.rollback?.last_known_good_ref) errors.push('DELIVERY_LAST_KNOWN_GOOD_REQUIRED');
  if(!Array.isArray(release?.rollback?.commands)||!release.rollback.commands.length) errors.push('DELIVERY_ROLLBACK_COMMAND_REQUIRED');
  return errors;
}

export function evaluateReleaseGate(release,{qualityReceipts=[]}={}){
  const errors=validateRelease(release);
  if(errors.length) return {status:'FAIL',errors,blockers:[]};

  const byRef=new Map(qualityReceipts.map((r)=>[r.ref,r]));
  const blockers=[];
  for(const ref of release.quality.required_receipts){
    const q=byRef.get(ref);
    if(!q){
      blockers.push(`QUALITY_RECEIPT_MISSING:${ref}`);
      continue;
    }
    if(q.status!=='PASS') blockers.push(`QUALITY_RECEIPT_NOT_PASS:${ref}:${q.status}`);
    if(q.subject_revision!==release.subject.revision) blockers.push(`QUALITY_RECEIPT_REVISION_MISMATCH:${ref}`);
  }

  if(release.target.environment==='PRODUCTION'&&release.release.approval_required&&!release.release.approval_ref){
    blockers.push('PRODUCTION_APPROVAL_NOT_PROVEN');
  }

  return {
    status:blockers.length?'HOLD':'READY_FOR_EXECUTION',
    blockers,
    subject:release.subject,
    target:release.target,
    commands:{
      build:release.build.commands,
      deploy:release.release.commands,
      rollback:release.rollback.commands
    },
    last_known_good_ref:release.rollback.last_known_good_ref
  };
}

function deriveReceiptStatus(draft){
  if(draft?.build?.status==='FAIL'||draft?.deployment?.status==='FAIL'||draft?.smoke?.status==='FAIL') return 'FAIL';
  if(draft?.build?.status!=='PASS'||draft?.deployment?.status!=='PASS'||draft?.smoke?.status!=='PASS') return 'HOLD';
  return 'PASS';
}

export function finalizeDeliveryReceipt(draft,{createdAt=new Date().toISOString()}={}){
  if(!/^[a-f0-9]{40}$/.test(draft?.subject?.revision??'')) throw new Error('DELIVERY_RECEIPT_REVISION_INVALID');
  if(!Array.isArray(draft?.quality_receipts)||!draft.quality_receipts.length) throw new Error('DELIVERY_RECEIPT_QUALITY_REQUIRED');
  if(!draft?.rollback?.last_known_good_ref) throw new Error('DELIVERY_RECEIPT_LKG_REQUIRED');
  const result={
    status:deriveReceiptStatus(draft),
    production_ready:false
  };
  if(draft?.target?.environment==='PRODUCTION'&&result.status==='PASS'&&draft?.deployment?.approval_ref){
    result.production_ready=true;
  }
  const identity={
    contract:'devcenter-delivery-receipt/v1',
    subject:draft.subject,
    target:draft.target,
    quality_receipts:draft.quality_receipts,
    build:draft.build,
    deployment:draft.deployment,
    smoke:draft.smoke,
    rollback:draft.rollback,
    result
  };
  return {
    ...identity,
    receipt_id:`dr_${digest(identity).slice(0,24)}`,
    created_at:createdAt
  };
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const [command,input]=process.argv.slice(2);
  try{
    if(!input) throw new Error('usage: delivery-gate.mjs validate|evaluate <release.json>');
    const release=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));
    if(command==='validate'){
      const errors=validateRelease(release);
      console.log(JSON.stringify({status:errors.length?'FAIL':'PASS',errors},null,2));
      process.exitCode=errors.length?1:0;
    }else if(command==='evaluate'){
      const result=evaluateReleaseGate(release,{qualityReceipts:[]});
      console.log(JSON.stringify(result,null,2));
      process.exitCode=result.status==='READY_FOR_EXECUTION'?0:2;
    }else throw new Error('commands: validate | evaluate');
  }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message},null,2));
    process.exitCode=1;
  }
}
