#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {finalizeCoreHubReceipt} from '../../src/engine/core-hub-receipt.mjs';

const HERE=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map((k)=>[k,stable(value[k])]));
  return value;
}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}

function gitShow(repoPath,revision,filePath){
  const r=spawnSync('git',['show',`${revision}:${filePath}`],{cwd:repoPath,encoding:'utf8',windowsHide:true});
  if(r.status!==0) throw new Error(`DOCUMENT_SOURCE_UNAVAILABLE:${filePath}`);
  return r.stdout;
}
function gitBlob(repoPath,revision,filePath){
  const r=spawnSync('git',['rev-parse',`${revision}:${filePath}`],{cwd:repoPath,encoding:'utf8',windowsHide:true});
  if(r.status!==0) throw new Error(`DOCUMENT_BLOB_UNAVAILABLE:${filePath}`);
  return (r.stdout||'').trim();
}

export function extractTemplateCatalog(appSource){
  const head=appSource.match(/const templates = \[([\s\S]*?)\];/);
  if(!head) throw new Error('DOCUMENT_TEMPLATE_CATALOG_NOT_FOUND');
  const rows=[];
  const re=/{id:'([^']+)',category:'([^']+)',title:'([^']+)',desc:'([^']+)',render:([A-Za-z0-9_]+)}/g;
  let m;
  while((m=re.exec(head[1]))){
    rows.push({id:m[1],category:m[2],title:m[3],description:m[4],renderer:m[5]});
  }
  if(!rows.length) throw new Error('DOCUMENT_TEMPLATE_CATALOG_EMPTY');
  return rows;
}

export function loadDocumentSource({binding,docshubPath}){
  if(!docshubPath) throw new Error('DOCUMENT_DOCSHUB_PATH_REQUIRED');
  const source={};
  for(const [key,item] of Object.entries(binding.sources)){
    const blob=gitBlob(docshubPath,binding.revision,item.path);
    if(blob!==item.blob_sha) throw new Error(`DOCUMENT_SOURCE_BLOB_MISMATCH:${key}`);
    source[key]=gitShow(docshubPath,binding.revision,item.path);
  }
  return {
    source,
    catalog:extractTemplateCatalog(source.catalog)
  };
}

export function validateDocumentJob(job,catalog){
  const errors=[];
  if(job?.contract!=='devcenter-document-job/v1') errors.push('DOCUMENT_JOB_CONTRACT_INVALID');
  if(!/^[^/]+\/[^/]+$/.test(job?.subject?.repository??'')) errors.push('DOCUMENT_JOB_REPOSITORY_INVALID');
  if(!/^[a-f0-9]{40}$/.test(job?.subject?.revision??'')) errors.push('DOCUMENT_JOB_REVISION_INVALID');
  if(!catalog.some((t)=>t.id===job?.template_id)) errors.push(`DOCUMENT_TEMPLATE_UNKNOWN:${job?.template_id}`);
  if(!job?.content_ref) errors.push('DOCUMENT_CONTENT_REF_REQUIRED');
  if(!Array.isArray(job?.output?.formats)||!job.output.formats.length) errors.push('DOCUMENT_OUTPUT_FORMAT_REQUIRED');
  return errors;
}

export function makeRenderPlan(job,{binding,catalog}){
  const errors=validateDocumentJob(job,catalog);
  if(errors.length) return {status:'FAIL',errors};
  const template=catalog.find((t)=>t.id===job.template_id);
  return {
    contract:'devcenter-document-render-plan/v1',
    subject:job.subject,
    source:{
      repository:binding.repository,
      revision:binding.revision,
      template_catalog_blob:binding.sources.catalog.blob_sha,
      shell_blob:binding.sources.shell.blob_sha,
      styles_blob:binding.sources.styles.blob_sha
    },
    template,
    content_ref:job.content_ref,
    brand_profile_ref:job.brand_profile_ref??null,
    output:job.output,
    quality:{
      content_accuracy_required:Boolean(job.quality?.content_accuracy),
      visual_review_required:Boolean(job.quality?.visual_review),
      required_checks:['template-source-bound','content-completeness','numeric-text-accuracy','layout-overflow','brand-consistency']
    },
    result:{status:'PLANNED'}
  };
}

function deriveStatus(checks=[]){
  if(checks.some((x)=>x.status==='FAIL')) return 'FAIL';
  if(checks.some((x)=>x.status==='HOLD')) return 'HOLD';
  return 'PASS';
}

export function finalizeDocumentReceipt(draft,{createdAt=new Date().toISOString()}={}){
  if(!/^[a-f0-9]{40}$/.test(draft?.subject?.revision??'')) throw new Error('DOCUMENT_RECEIPT_REVISION_INVALID');
  if(!draft?.template?.id) throw new Error('DOCUMENT_RECEIPT_TEMPLATE_REQUIRED');
  if(!Array.isArray(draft?.artifacts)||!draft.artifacts.length) throw new Error('DOCUMENT_RECEIPT_ARTIFACT_REQUIRED');
  for(const artifact of draft.artifacts){
    if(!artifact.ref||!artifact.format||!/^[a-f0-9]{64}$/.test(artifact.sha256??'')) throw new Error('DOCUMENT_RECEIPT_ARTIFACT_EVIDENCE_INVALID');
  }
  if(!Array.isArray(draft?.checks)||!draft.checks.length) throw new Error('DOCUMENT_RECEIPT_CHECKS_REQUIRED');
  for(const check of draft.checks){
    if(!['PASS','HOLD','FAIL'].includes(check?.status)) throw new Error('DOCUMENT_RECEIPT_CHECK_STATUS_INVALID');
    if(check.status==='PASS'&&(!Array.isArray(check.evidence)||!check.evidence.length)) throw new Error('DOCUMENT_RECEIPT_PASS_EVIDENCE_REQUIRED');
  }
  const result={status:deriveStatus(draft.checks)};
  const payload={
    subject:draft.subject,
    template:draft.template,
    source:draft.source,
    artifacts:draft.artifacts,
    checks:draft.checks,
    result
  };
  return finalizeCoreHubReceipt({kind:'document',prefix:'doc',payload,legacyContract:'devcenter-document-receipt/v1',createdAt});
}

export function finalizeDocumentLock(draft,{createdAt=new Date().toISOString()}={}){
  if(draft?.approval?.status!=='APPROVED'||!draft?.approval?.evidence_ref) throw new Error('DOCUMENT_LOCK_APPROVAL_REQUIRED');
  if(!/^[a-f0-9]{40}$/.test(draft?.docshub_revision??'')) throw new Error('DOCUMENT_LOCK_REVISION_INVALID');
  const identity={
    contract:'devcenter-document-lock/v1',
    template_id:draft.template_id,
    docshub_revision:draft.docshub_revision,
    approval:draft.approval,
    artifact_ref:draft.artifact_ref,
    previous_lock_ref:draft.previous_lock_ref??null
  };
  return {...identity,lock_id:`dlock_${digest(identity).slice(0,24)}`,created_at:createdAt};
}

export function loadBinding(baseDir=HERE){
  return readJson(path.join(baseDir,'hubs','document','source-binding.json'));
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const [command,input,output]=process.argv.slice(2);
  try{
    if(command!=='plan'||!input) throw new Error('usage: document-hub.mjs plan <document-job.json> [render-plan.json]');
    const binding=loadBinding();
    const docshubPath=process.env.DOCSHUB_PATH||path.resolve(HERE,'..','docshub');
    const {catalog}=loadDocumentSource({binding,docshubPath});
    const plan=makeRenderPlan(readJson(path.resolve(input)),{binding,catalog});
    const json=JSON.stringify(plan,null,2)+'\n';
    if(output) fs.writeFileSync(path.resolve(output),json); else process.stdout.write(json);
    process.exitCode=plan.status==='FAIL'?1:0;
  }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message},null,2));
    process.exitCode=1;
  }
}
