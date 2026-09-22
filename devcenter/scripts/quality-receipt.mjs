#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {finalizeCoreHubReceipt} from '../../src/engine/core-hub-receipt.mjs';

const HERE=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const STATUS_ORDER=['PASS','NOTICE','HOLD','FAIL'];

export function deriveResult(checks=[]){
  const counts={PASS:0,NOTICE:0,HOLD:0,FAIL:0};
  for(const check of checks){
    if(check?.status in counts) counts[check.status]+=1;
  }
  const status=counts.FAIL?'FAIL':counts.HOLD?'HOLD':counts.NOTICE?'NOTICE':'PASS';
  return {status,counts};
}

export function validateQualityReceipt(receipt,hubRegistry){
  const errors=[];
  const body=receipt?.payload??receipt;
  const hubIds=new Set((hubRegistry?.hubs??[]).map((hub)=>hub.id));

  if(receipt?.schema_version!=='core-receipt/v1'||receipt?.receipt_kind!=='hub.quality'||body?.legacy_contract!=='devcenter-quality-receipt/v1') errors.push('QUALITY_RECEIPT_CONTRACT_INVALID');
  if(!/^qr_[a-f0-9]{24}$/.test(receipt?.receipt_id??'')) errors.push('QUALITY_RECEIPT_ID_INVALID');
  if(!/^[^/]+\/[^/]+$/.test(body?.subject?.repository??'')) errors.push('QUALITY_RECEIPT_REPOSITORY_INVALID');
  if(!/^[a-f0-9]{40}$/.test(body?.subject?.revision??'')) errors.push('QUALITY_RECEIPT_REVISION_INVALID');
  if(!hubIds.has(body?.hub?.primary)) errors.push('QUALITY_RECEIPT_PRIMARY_HUB_UNKNOWN');
  if((body?.hub?.secondary??[]).some((id)=>!hubIds.has(id)||id===body?.hub?.primary)) errors.push('QUALITY_RECEIPT_SECONDARY_HUB_INVALID');
  if(!Array.isArray(body?.scope?.claims)||!body.scope.claims.length) errors.push('QUALITY_RECEIPT_CLAIMS_REQUIRED');
  if(!Array.isArray(body?.execution?.commands)||!body.execution.commands.length) errors.push('QUALITY_RECEIPT_COMMANDS_REQUIRED');

  const started=Date.parse(body?.execution?.started_at??'');
  const finished=Date.parse(body?.execution?.finished_at??'');
  if(!Number.isFinite(started)||!Number.isFinite(finished)||finished<started) errors.push('QUALITY_RECEIPT_EXECUTION_TIME_INVALID');

  const checks=Array.isArray(body?.checks)?body.checks:[];
  if(!checks.length) errors.push('QUALITY_RECEIPT_CHECKS_REQUIRED');
  const ids=new Set();
  for(const check of checks){
    if(!/^[A-Z0-9][A-Z0-9._-]+$/.test(check?.id??'')) errors.push(`QUALITY_CHECK_ID_INVALID:${check?.id??'(missing)'}`);
    if(ids.has(check?.id)) errors.push(`QUALITY_CHECK_ID_DUPLICATE:${check?.id}`);
    ids.add(check?.id);
    if(!STATUS_ORDER.includes(check?.status)) errors.push(`QUALITY_CHECK_STATUS_INVALID:${check?.id}`);
    if(!Array.isArray(check?.evidence)) errors.push(`QUALITY_CHECK_EVIDENCE_INVALID:${check?.id}`);
    if(check?.status==='PASS' && !check.evidence?.length) errors.push(`QUALITY_CHECK_PASS_EVIDENCE_REQUIRED:${check?.id}`);
    if((check?.status==='FAIL'||check?.status==='HOLD') && (!check.evidence?.length||!check.remediation||!check.recheck)){
      errors.push(`QUALITY_CHECK_BLOCKING_DETAIL_REQUIRED:${check?.id}`);
    }
  }

  const derived=deriveResult(checks);
  if(body?.result?.status!==derived.status) errors.push('QUALITY_RECEIPT_RESULT_STATUS_MISMATCH');
  for(const status of STATUS_ORDER){
    if(body?.result?.counts?.[status]!==derived.counts[status]) errors.push(`QUALITY_RECEIPT_RESULT_COUNT_MISMATCH:${status}`);
  }

  const payload={subject:body?.subject,hub:body?.hub,scope:body?.scope,execution:body?.execution,checks:body?.checks,source_hashes:body?.source_hashes??{},result:body?.result};
  const expected=finalizeCoreHubReceipt({kind:'quality',prefix:'qr',payload,legacyContract:'devcenter-quality-receipt/v1',createdAt:receipt?.ended_at}).receipt_id;
  if(receipt?.receipt_id!==expected) errors.push('QUALITY_RECEIPT_ID_DIGEST_MISMATCH');

  if(!Number.isFinite(Date.parse(receipt?.ended_at??''))) errors.push('QUALITY_RECEIPT_CREATED_AT_INVALID');
  return errors;
}

export function finalizeQualityReceipt(draft,{hubRegistry,createdAt=new Date().toISOString()}={}){
  const result=deriveResult(draft.checks??[]);
  const payload={
    subject:draft.subject,
    hub:draft.hub,
    scope:draft.scope,
    execution:draft.execution,
    checks:draft.checks,
    source_hashes:draft.source_hashes??{}
  };
  payload.result=result;
  const receipt=finalizeCoreHubReceipt({kind:'quality',prefix:'qr',payload,legacyContract:'devcenter-quality-receipt/v1',createdAt});
  const errors=validateQualityReceipt(receipt,hubRegistry);
  if(errors.length){
    const error=new Error('QUALITY_RECEIPT_INVALID');
    error.details=errors;
    throw error;
  }
  return receipt;
}

export function loadHubRegistry(baseDir=HERE){
  return JSON.parse(fs.readFileSync(path.resolve(baseDir,'..','registry','hubs.json'),'utf8'));
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const [command,input,output]=process.argv.slice(2);
  try{
    if(!['validate','finalize'].includes(command)||!input) throw new Error('usage: quality-receipt.mjs validate|finalize <input.json> [output.json]');
    const data=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));
    const hubRegistry=loadHubRegistry();
    if(command==='validate'){
      const errors=validateQualityReceipt(data,hubRegistry);
      console.log(JSON.stringify({status:errors.length?'FAIL':'PASS',errors},null,2));
      process.exitCode=errors.length?1:0;
    }else{
      const receipt=finalizeQualityReceipt(data,{hubRegistry});
      const json=JSON.stringify(receipt,null,2)+'\n';
      if(output) fs.writeFileSync(path.resolve(output),json);
      else process.stdout.write(json);
    }
  }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message,details:error.details??[]},null,2));
    process.exitCode=1;
  }
}
