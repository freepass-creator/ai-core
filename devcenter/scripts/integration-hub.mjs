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

export function validateConnectors(registry){
  const errors=[];
  if(registry?.contract!=='devcenter-integration-connectors/v1') errors.push('INTEGRATION_CONTRACT_INVALID');
  if(!Array.isArray(registry?.connectors)||!registry.connectors.length) errors.push('INTEGRATION_CONNECTORS_REQUIRED');
  const ids=new Set();
  for(const c of registry?.connectors??[]){
    if(!c?.id||ids.has(c.id)) errors.push(`INTEGRATION_ID_INVALID:${c?.id??'(missing)'}`);
    ids.add(c?.id);
    if(!/^[a-f0-9]{40}$/.test(c?.source?.revision??'')) errors.push(`INTEGRATION_REVISION_INVALID:${c?.id}`);
    if(!/^[a-f0-9]{40}$/.test(c?.source?.blob_sha??'')) errors.push(`INTEGRATION_BLOB_INVALID:${c?.id}`);
    if(!Number.isInteger(c?.execution?.timeout_ms)||c.execution.timeout_ms<=0) errors.push(`INTEGRATION_TIMEOUT_INVALID:${c?.id}`);
    if(!Number.isInteger(c?.execution?.retry?.max_attempts)||c.execution.retry.max_attempts<1) errors.push(`INTEGRATION_RETRY_INVALID:${c?.id}`);
    if(c?.execution?.idempotency?.required&&!c.execution.idempotency.key_ref) errors.push(`INTEGRATION_IDEMPOTENCY_KEY_REQUIRED:${c?.id}`);
    if(!c?.auth?.secret_location) errors.push(`INTEGRATION_AUTH_BOUNDARY_REQUIRED:${c?.id}`);
    if(!c?.health?.probe||!c?.health?.success_receipt) errors.push(`INTEGRATION_HEALTH_REQUIRED:${c?.id}`);
    if(!c?.recovery?.disable_path) errors.push(`INTEGRATION_RECOVERY_REQUIRED:${c?.id}`);
    if(!Array.isArray(c?.verification)||!c.verification.length) errors.push(`INTEGRATION_VERIFICATION_REQUIRED:${c?.id}`);
  }
  return errors;
}

export function verifyConnectorSources(registry,{repoRoots={}}={}){
  return (registry.connectors??[]).map((c)=>{
    const root=repoRoots[c.source.repository];
    if(!root) return {id:c.id,status:'HOLD',reason:'SOURCE_REPOSITORY_NOT_MOUNTED'};
    const blob=gitBlob(root,c.source.revision,c.source.path);
    return blob===c.source.blob_sha
      ? {id:c.id,status:'PASS',blob_sha:blob}
      : {id:c.id,status:'FAIL',expected:c.source.blob_sha,actual:blob};
  });
}

export function evaluateIntegrationRequest(connector,request){
  const blockers=[];
  if(!connector) return {status:'FAIL',blockers:['CONNECTOR_UNKNOWN']};
  if(['RETIRED','DEPRECATED'].includes(connector.status)) blockers.push(`CONNECTOR_NOT_ACTIVE:${connector.status}`);
  if(connector.status==='CANDIDATE') blockers.push('CONNECTOR_CANDIDATE_NOT_PRODUCTION_ACTIVE');
  if(connector.execution.idempotency.required&&!request?.idempotency_key) blockers.push('IDEMPOTENCY_KEY_REQUIRED');
  if(!request?.timeout_ms||request.timeout_ms>connector.execution.timeout_ms) blockers.push('TIMEOUT_OUTSIDE_CONTRACT');
  if(!request?.auth_context_ref) blockers.push('AUTH_CONTEXT_REQUIRED');
  return {
    status:blockers.length?'HOLD':'READY',
    connector_id:connector.id,
    blockers,
    retry:connector.execution.retry,
    recovery:connector.recovery
  };
}

export function finalizeIntegrationReceipt(draft){
  if(!draft?.connector_id) throw new Error('INTEGRATION_RECEIPT_CONNECTOR_REQUIRED');
  if(!/^[a-f0-9]{40}$/.test(draft?.subject_revision??'')) throw new Error('INTEGRATION_RECEIPT_REVISION_INVALID');
  if(!['PASS','HOLD','FAIL'].includes(draft?.status)) throw new Error('INTEGRATION_RECEIPT_STATUS_INVALID');
  if(!draft?.health_evidence_ref) throw new Error('INTEGRATION_RECEIPT_HEALTH_EVIDENCE_REQUIRED');
  if(draft.status!=='PASS'&&!draft?.recovery_evidence_ref) throw new Error('INTEGRATION_RECEIPT_RECOVERY_EVIDENCE_REQUIRED');
  return {
    contract:'devcenter-integration-receipt/v1',
    connector_id:draft.connector_id,
    subject_revision:draft.subject_revision,
    status:draft.status,
    attempts:draft.attempts??1,
    idempotency_key_ref:draft.idempotency_key_ref??null,
    health_evidence_ref:draft.health_evidence_ref,
    recovery_evidence_ref:draft.recovery_evidence_ref??null
  };
}

export function planConnectorPromotion(connector,{decision,evidence_refs=[]}={}){
  if(!connector?.id) throw new Error('INTEGRATION_PROMOTION_CONNECTOR_REQUIRED');
  if(!['ACTIVATE','HOLD','DEGRADE','DEPRECATE','RETIRE'].includes(decision)) throw new Error('INTEGRATION_PROMOTION_DECISION_INVALID');
  if(!evidence_refs.length) throw new Error('INTEGRATION_PROMOTION_EVIDENCE_REQUIRED');
  const target={
    ACTIVATE:'ACTIVE',
    HOLD:connector.status,
    DEGRADE:'DEGRADED',
    DEPRECATE:'DEPRECATED',
    RETIRE:'RETIRED'
  }[decision];
  return {
    contract:'devcenter-integration-promotion/v1',
    connector_id:connector.id,
    from_status:connector.status,
    decision,
    target_status:target,
    evidence_refs
  };
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const [command]=process.argv.slice(2);
  try{
    const registry=readJson(path.join(HERE,'hubs','integration','connectors.json'));
    if(command==='validate'){
      const errors=validateConnectors(registry);
      console.log(JSON.stringify({status:errors.length?'FAIL':'PASS',errors,connector_count:registry.connectors.length},null,2));
      process.exitCode=errors.length?1:0;
    }else throw new Error('commands: validate');
  }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message},null,2));
    process.exitCode=1;
  }
}
