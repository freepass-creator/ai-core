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

export function deriveDesignResult(checks=[]){
  const counts={PASS:0,HOLD:0,FAIL:0};
  for(const c of checks) if(c?.status in counts) counts[c.status]+=1;
  return {status:counts.FAIL?'FAIL':counts.HOLD?'HOLD':'PASS',counts};
}

export function finalizeDesignAdoptionReceipt(draft,{createdAt=new Date().toISOString()}={}){
  if(!/^[a-f0-9]{40}$/.test(draft?.subject?.revision??'')) throw new Error('DESIGN_ADOPTION_REVISION_INVALID');
  if(draft?.authority?.approval_status!=='USER_APPROVED'&&!draft?.authority?.evidence_ref) throw new Error('DESIGN_ADOPTION_AUTHORITY_INVALID');
  if(!Array.isArray(draft?.checks)||!draft.checks.length) throw new Error('DESIGN_ADOPTION_CHECKS_REQUIRED');
  for(const c of draft.checks){
    if(!['PASS','HOLD','FAIL'].includes(c?.status)) throw new Error(`DESIGN_ADOPTION_STATUS_INVALID:${c?.id}`);
    if(!Array.isArray(c?.evidence)||!c.evidence.length) throw new Error(`DESIGN_ADOPTION_EVIDENCE_REQUIRED:${c?.id}`);
    if((c.status==='HOLD'||c.status==='FAIL')&&(!c.remediation||!c.recheck)) throw new Error(`DESIGN_ADOPTION_BLOCKER_DETAIL_REQUIRED:${c?.id}`);
  }
  const result=deriveDesignResult(draft.checks);
  const identity={
    contract:'devcenter-design-adoption-receipt/v1',
    subject:draft.subject,
    authority:draft.authority,
    ai_core:draft.ai_core,
    design_hub_revision:draft.design_hub_revision,
    checks:draft.checks,
    result,
    source_blobs:draft.source_blobs
  };
  return {...identity,receipt_id:`dar_${digest(identity).slice(0,24)}`,created_at:createdAt};
}

export function validateFeedback(registry){
  const errors=[];
  if(registry?.contract!=='devcenter-design-feedback/v1') errors.push('DESIGN_FEEDBACK_CONTRACT_INVALID');
  const ids=new Set();
  for(const entry of registry?.entries??[]){
    if(!entry?.id||ids.has(entry.id)) errors.push(`DESIGN_FEEDBACK_ID_INVALID:${entry?.id??'(missing)'}`);
    ids.add(entry?.id);
    if(!['ADOPT','HOLD_LOCAL','REJECT'].includes(entry?.decision)) errors.push(`DESIGN_FEEDBACK_DECISION_INVALID:${entry?.id}`);
    if(!/^[a-f0-9]{40}$/.test(entry?.source?.revision??'')) errors.push(`DESIGN_FEEDBACK_REVISION_INVALID:${entry?.id}`);
    if(!Array.isArray(entry?.evidence)||!entry.evidence.length) errors.push(`DESIGN_FEEDBACK_EVIDENCE_REQUIRED:${entry?.id}`);
    if(!entry?.rule) errors.push(`DESIGN_FEEDBACK_RULE_REQUIRED:${entry?.id}`);
  }
  return errors;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  try{
    const registry=JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','hubs','design','feedback.json'),'utf8'));
    const errors=validateFeedback(registry);
    console.log(JSON.stringify({status:errors.length?'FAIL':'PASS',errors,entry_count:registry.entries.length},null,2));
    process.exitCode=errors.length?1:0;
  }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message},null,2));
    process.exitCode=1;
  }
}
