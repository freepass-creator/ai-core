#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map((k)=>[k,stable(value[k])]));
  return value;
}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}

export function deriveDataResult(checks=[]){
  const counts={PASS:0,HOLD:0,FAIL:0};
  for(const c of checks) if(c?.status in counts) counts[c.status]+=1;
  return {status:counts.FAIL?'FAIL':counts.HOLD?'HOLD':'PASS',counts};
}

export function finalizeDataReceipt(draft,{createdAt=new Date().toISOString()}={}){
  if(draft?.contract!=='devcenter-data-receipt/v1'&&draft?.contract!==undefined) throw new Error('DATA_RECEIPT_CONTRACT_INVALID');
  if(!/^[a-f0-9]{40}$/.test(draft?.subject?.revision??'')) throw new Error('DATA_RECEIPT_REVISION_INVALID');
  if(!Array.isArray(draft?.checks)||!draft.checks.length) throw new Error('DATA_RECEIPT_CHECKS_REQUIRED');
  for(const check of draft.checks){
    if(!['PASS','HOLD','FAIL'].includes(check?.status)) throw new Error(`DATA_RECEIPT_STATUS_INVALID:${check?.id}`);
    if(!Array.isArray(check?.evidence)||!check.evidence.length) throw new Error(`DATA_RECEIPT_EVIDENCE_REQUIRED:${check?.id}`);
    if((check.status==='HOLD'||check.status==='FAIL')&&(!check.remediation||!check.recheck)) throw new Error(`DATA_RECEIPT_BLOCKER_DETAIL_REQUIRED:${check?.id}`);
  }
  const result=deriveDataResult(draft.checks);
  const identity={
    contract:'devcenter-data-receipt/v1',
    subject:draft.subject,
    scope:draft.scope,
    checks:draft.checks,
    result
  };
  return {...identity,receipt_id:`data_${digest(identity).slice(0,24)}`,created_at:createdAt};
}

export function validatePatterns(registry){
  const errors=[];
  if(registry?.contract!=='devcenter-data-patterns/v1') errors.push('DATA_PATTERN_CONTRACT_INVALID');
  const ids=new Set();
  for(const p of registry?.patterns??[]){
    if(!p?.id||ids.has(p.id)) errors.push(`DATA_PATTERN_ID_INVALID:${p?.id??'(missing)'}`);
    ids.add(p?.id);
    if(!['ADOPTED','CANDIDATE','DEPRECATED','RETIRED'].includes(p?.status)) errors.push(`DATA_PATTERN_STATUS_INVALID:${p?.id}`);
    if(!/^[a-f0-9]{40}$/.test(p?.source?.revision??'')) errors.push(`DATA_PATTERN_REVISION_INVALID:${p?.id}`);
    if(!Array.isArray(p?.evidence)||!p.evidence.length) errors.push(`DATA_PATTERN_EVIDENCE_REQUIRED:${p?.id}`);
    if(!p?.rule) errors.push(`DATA_PATTERN_RULE_REQUIRED:${p?.id}`);
  }
  return errors;
}

export function evaluateConsumer(consumer){
  const blockers=consumer?.blockers??[];
  return {
    id:consumer?.id,
    status:blockers.length?'HOLD':'READY',
    relation:consumer?.relation,
    blockers
  };
}

export function validateRecovery(recovery){
  const errors=[];
  if(recovery?.contract!=='devcenter-data-recovery/v1') errors.push('DATA_RECOVERY_CONTRACT_INVALID');
  if(!/^[a-f0-9]{40}$/.test(recovery?.subject?.revision??'')) errors.push('DATA_RECOVERY_REVISION_INVALID');
  if(!Array.isArray(recovery?.required)||!recovery.required.length) errors.push('DATA_RECOVERY_REQUIREMENTS_REQUIRED');
  if(recovery?.state==='READY'&&(recovery?.blockers??[]).length) errors.push('DATA_RECOVERY_READY_WITH_BLOCKERS');
  return errors;
}

export function promotePattern(candidate,{decision,evidence=[]}={}){
  if(!candidate?.id) throw new Error('DATA_PROMOTION_PATTERN_REQUIRED');
  if(!['ADOPT','HOLD','REJECT','DEPRECATE'].includes(decision)) throw new Error('DATA_PROMOTION_DECISION_INVALID');
  if(!evidence.length) throw new Error('DATA_PROMOTION_EVIDENCE_REQUIRED');
  return {
    contract:'devcenter-data-pattern-promotion/v1',
    pattern_id:candidate.id,
    from_status:candidate.status,
    decision,
    target_status:{ADOPT:'ADOPTED',HOLD:candidate.status,REJECT:'CANDIDATE',DEPRECATE:'DEPRECATED'}[decision],
    evidence
  };
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const [command]=process.argv.slice(2);
  try{
    const patterns=JSON.parse(fs.readFileSync(path.join(HERE,'hubs','data','patterns.json'),'utf8'));
    const recovery=JSON.parse(fs.readFileSync(path.join(HERE,'hubs','data','recovery.json'),'utf8'));
    if(command==='validate'){
      const errors=[...validatePatterns(patterns),...validateRecovery(recovery)];
      console.log(JSON.stringify({status:errors.length?'FAIL':'PASS',errors,pattern_count:patterns.patterns.length},null,2));
      process.exitCode=errors.length?1:0;
    }else throw new Error('commands: validate');
  }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message},null,2));
    process.exitCode=1;
  }
}
