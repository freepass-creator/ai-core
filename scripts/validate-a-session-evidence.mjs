import { readFile } from 'node:fs/promises';

const SHA40 = /^[0-9a-f]{40}$/;
const CLASSIFICATIONS = new Set(['PROJECT_GT_CORE','CORE_GT_PROJECT','DIFFERENT']);
const STATUSES = new Set(['ACTIVE','ROUTED','MIGRATION_REQUIRED','HOLD','CORRECTED','SUPERSEDED']);
const EVIDENCE_LEVELS = new Set(['PROPOSED','PLATFORM_CONSENSUS','PROJECT_VERIFIED','CROSS_PROJECT_VERIFIED','FAILURE_RUNTIME_EVIDENCE']);
const ROUTES = new Set(['B','C','D']);
const EVIDENCE_TYPES = new Set(['CODE','DOC','SCHEMA','TEST','CI','DEPLOYMENT','RUNTIME']);

function add(errors,code,path,detail){ errors.push({code,path,...(detail?{detail}:{})}); }
function nonEmptyStrings(xs){ return Array.isArray(xs)&&xs.length>0&&xs.every(x=>typeof x==='string'&&x.trim()); }

export function validateAEvidenceRegistry(registry){
  const errors=[];
  if(!registry||typeof registry!=='object'||Array.isArray(registry)) return {status:'INVALID',errors:[{code:'REGISTRY_NOT_OBJECT',path:'$'}]};
  if(registry.schema!=='ai-core-a-session-evidence-registry/v1') add(errors,'SCHEMA_ID_INVALID','/schema');
  if(registry.status!=='RESEARCH_ROUTING_INDEX_NOT_CANONICAL') add(errors,'CANONICAL_BOUNDARY_INVALID','/status');
  if(!Array.isArray(registry.findings)) return {status:'INVALID',errors:[...errors,{code:'FINDINGS_NOT_ARRAY',path:'/findings'}]};
  const ids=new Set();
  registry.findings.forEach((f,i)=>{
    const p=`/findings/${i}`;
    if(typeof f?.id!=='string'||!f.id.trim()) add(errors,'FINDING_ID_INVALID',`${p}/id`);
    else if(ids.has(f.id)) add(errors,'FINDING_ID_DUPLICATE',`${p}/id`);
    else ids.add(f.id);
    if(!CLASSIFICATIONS.has(f?.classification)) add(errors,'CLASSIFICATION_INVALID',`${p}/classification`);
    if(!STATUSES.has(f?.current_status)) add(errors,'STATUS_INVALID',`${p}/current_status`);
    if(!EVIDENCE_LEVELS.has(f?.evidence_level)) add(errors,'EVIDENCE_LEVEL_INVALID',`${p}/evidence_level`);
    if(!Array.isArray(f?.routes)||f.routes.length===0||f.routes.some(x=>!ROUTES.has(x))) add(errors,'ROUTE_INVALID',`${p}/routes`);
    if(new Set(f.routes||[]).size!==(f.routes||[]).length) add(errors,'ROUTE_DUPLICATE',`${p}/routes`);
    if(typeof f?.summary!=='string'||f.summary.trim().length<20) add(errors,'SUMMARY_TOO_SHORT',`${p}/summary`);
    if(!Array.isArray(f?.revision_evidence)||f.revision_evidence.length===0) add(errors,'REVISION_EVIDENCE_REQUIRED',`${p}/revision_evidence`);
    else f.revision_evidence.forEach((e,j)=>{
      const ep=`${p}/revision_evidence/${j}`;
      if(typeof e?.repository!=='string'||!e.repository.includes('/')) add(errors,'EVIDENCE_REPOSITORY_INVALID',`${ep}/repository`);
      if(!SHA40.test(e?.revision??'')) add(errors,'EVIDENCE_REVISION_INVALID',`${ep}/revision`);
      if(!Array.isArray(e?.evidence_types)||e.evidence_types.length===0||e.evidence_types.some(x=>!EVIDENCE_TYPES.has(x))) add(errors,'EVIDENCE_TYPE_INVALID',`${ep}/evidence_types`);
    });
    if(!Array.isArray(f?.state_history)||f.state_history.length===0) add(errors,'STATE_HISTORY_REQUIRED',`${p}/state_history`);
    else {
      f.state_history.forEach((h,j)=>{
        const hp=`${p}/state_history/${j}`;
        if(!STATUSES.has(h?.status)) add(errors,'HISTORY_STATUS_INVALID',`${hp}/status`);
        if(Number.isNaN(Date.parse(h?.observed_at??''))) add(errors,'HISTORY_TIME_INVALID',`${hp}/observed_at`);
        if(typeof h?.reason!=='string'||h.reason.trim().length<10) add(errors,'HISTORY_REASON_INVALID',`${hp}/reason`);
      });
      if(f.state_history.at(-1)?.status!==f.current_status) add(errors,'CURRENT_STATUS_NOT_HISTORY_TAIL',`${p}/current_status`);
    }
    if(f.classification==='PROJECT_GT_CORE'){
      if(f.current_status==='MIGRATION_REQUIRED') add(errors,'PROJECT_GT_CORE_CANNOT_BE_MIGRATION',`${p}/current_status`);
      if(f.migration) add(errors,'PROJECT_GT_CORE_MIGRATION_FORBIDDEN',`${p}/migration`);
    }
    if(f.classification==='CORE_GT_PROJECT'){
      if(f.current_status!=='MIGRATION_REQUIRED'&&f.current_status!=='CORRECTED'&&f.current_status!=='SUPERSEDED') add(errors,'CORE_GT_PROJECT_STATUS_INVALID',`${p}/current_status`);
      if(!f.migration||typeof f.migration!=='object') add(errors,'MIGRATION_REQUIRED',`${p}/migration`);
      else {
        if(typeof f.migration.target_repository!=='string'||!f.migration.target_repository.includes('/')) add(errors,'MIGRATION_TARGET_INVALID',`${p}/migration/target_repository`);
        if(!nonEmptyStrings(f.migration.breaking_impact)) add(errors,'BREAKING_IMPACT_REQUIRED',`${p}/migration/breaking_impact`);
        if(!nonEmptyStrings(f.migration.verification_needs)) add(errors,'VERIFICATION_NEEDS_REQUIRED',`${p}/migration/verification_needs`);
      }
    }
    if(f.classification==='DIFFERENT'){
      if(typeof f.difference_reason!=='string'||f.difference_reason.trim().length<30) add(errors,'DIFFERENCE_REASON_REQUIRED',`${p}/difference_reason`);
      if(f.current_status==='MIGRATION_REQUIRED') add(errors,'DIFFERENT_CANNOT_BE_MIGRATION',`${p}/current_status`);
    }
  });
  return {status:errors.length?'INVALID':'VALID',errors};
}

if(process.argv[1]?.endsWith('validate-a-session-evidence.mjs')){
  if(!process.argv[2]){ console.error('Usage: node scripts/validate-a-session-evidence.mjs <registry.json>'); process.exit(2); }
  const registry=JSON.parse(await readFile(process.argv[2],'utf8'));
  const result=validateAEvidenceRegistry(registry);
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='VALID') process.exitCode=1;
}
