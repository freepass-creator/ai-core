import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const [adoption,schema,contracts,projects]=await Promise.all([
  readJson('registry/core-contract-adoption.json'),
  readJson('contracts/core-contract-adoption.schema.json'),
  readJson('registry/core-contracts.json'),
  readJson('registry/projects.json')
]);

const errors=[];
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv);
const validate=ajv.compile(schema);
if(!validate(adoption)){
  for(const e of validate.errors??[]) errors.push({code:'ADOPTION_SCHEMA_INVALID',path:e.instancePath||'$',detail:e.message});
}

const contractIds=new Set((contracts.contracts??[]).map(x=>x.id));
const projectIndex=new Map((projects.projects??[]).map(x=>[x.project_id,x]));
const seenProjects=new Set();

for(const entry of adoption.entries??[]){
  if(seenProjects.has(entry.project_id)) errors.push({code:'ADOPTION_PROJECT_DUPLICATE',project_id:entry.project_id});
  seenProjects.add(entry.project_id);

  const project=projectIndex.get(entry.project_id);
  if(!project){
    errors.push({code:'ADOPTION_PROJECT_UNKNOWN',project_id:entry.project_id});
    continue;
  }
  if(project.repository!==entry.repository) errors.push({code:'ADOPTION_REPOSITORY_MISMATCH',project_id:entry.project_id});
  const revisions=new Set((project.authoritative_sources??[]).map(x=>x.revision));
  if(!revisions.has(entry.subject_revision)) errors.push({code:'ADOPTION_REVISION_NOT_AUTHORITATIVE',project_id:entry.project_id,revision:entry.subject_revision});

  const assessmentIds=new Set();
  for(const item of entry.assessments??[]){
    if(!contractIds.has(item.contract_id)) errors.push({code:'ADOPTION_CONTRACT_UNKNOWN',project_id:entry.project_id,contract_id:item.contract_id});
    if(assessmentIds.has(item.contract_id)) errors.push({code:'ADOPTION_CONTRACT_DUPLICATE',project_id:entry.project_id,contract_id:item.contract_id});
    assessmentIds.add(item.contract_id);

    if(item.classification==='NOT_APPLICABLE'){
      if(item.priority!=='NA') errors.push({code:'ADOPTION_NA_PRIORITY_INVALID',project_id:entry.project_id,contract_id:item.contract_id});
      if(item.binding_state!=='NONE') errors.push({code:'ADOPTION_NA_BINDING_INVALID',project_id:entry.project_id,contract_id:item.contract_id});
    }
    if(['D_OWNED_WORKFLOW','B_OWNED_PRESENTATION'].includes(item.classification)&&item.priority!=='NA'){
      errors.push({code:'ADOPTION_OTHER_OWNER_PRIORITY_INVALID',project_id:entry.project_id,contract_id:item.contract_id});
    }
    if(item.classification==='LEGACY_RETIRED'&&item.binding_state!=='RETIRED'){
      errors.push({code:'ADOPTION_RETIRED_BINDING_INVALID',project_id:entry.project_id,contract_id:item.contract_id});
    }
    if(item.binding_state!=='NONE'&&(!Array.isArray(item.artifact_refs)||item.artifact_refs.length===0)){
      errors.push({code:'ADOPTION_BINDING_ARTIFACT_REQUIRED',project_id:entry.project_id,contract_id:item.contract_id,binding_state:item.binding_state});
    }
    for(const artifact of item.artifact_refs??[]){
      if(!artifact.startsWith('registry/adoption/')&&!artifact.startsWith('test/')){
        errors.push({code:'ADOPTION_ARTIFACT_PATH_INVALID',project_id:entry.project_id,contract_id:item.contract_id,artifact});
      }
    }

    for(const ref of item.evidence_refs??[]){
      const prefix=entry.repository+'@'+entry.subject_revision+':';
      if(!ref.startsWith(prefix)){
        errors.push({code:'ADOPTION_EVIDENCE_REVISION_MISMATCH',project_id:entry.project_id,contract_id:item.contract_id,evidence_ref:ref});
      }
    }
  }

  for(const id of contractIds){
    if(!assessmentIds.has(id)) errors.push({code:'ADOPTION_CONTRACT_MISSING',project_id:entry.project_id,contract_id:id});
  }
}

const result={
  status:errors.length?'INVALID':'VALID',
  project_count:adoption.entries?.length??0,
  canonical_contract_count:contractIds.size,
  assessment_count:(adoption.entries??[]).reduce((n,e)=>n+(e.assessments?.length??0),0),
  errors
};
console.log(JSON.stringify(result,null,2));
if(errors.length) process.exitCode=1;
