#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const HERE=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function readJson(file){ return JSON.parse(fs.readFileSync(file,'utf8')); }

function gitShow(repoPath,revision,filePath){
  const result=spawnSync('git',['show',`${revision}:${filePath}`],{cwd:repoPath,encoding:'utf8',windowsHide:true});
  if(result.status!==0) throw new Error(`DESIGN_CORE_SOURCE_UNAVAILABLE:${filePath}:${(result.stderr||'').trim()}`);
  return result.stdout;
}

function gitBlob(repoPath,revision,filePath){
  const result=spawnSync('git',['rev-parse',`${revision}:${filePath}`],{cwd:repoPath,encoding:'utf8',windowsHide:true});
  if(result.status!==0) throw new Error(`DESIGN_CORE_BLOB_UNAVAILABLE:${filePath}`);
  return (result.stdout||'').trim();
}

export function loadCoreBundle({binding,aiCorePath}){
  if(!aiCorePath) throw new Error('DESIGN_AI_CORE_PATH_REQUIRED');
  const revision=binding.ai_core.revision;
  const sources=binding.sources;
  const bundle={
    entrypoint:JSON.parse(gitShow(aiCorePath,revision,sources.entrypoint.path)),
    featureRegistry:JSON.parse(gitShow(aiCorePath,revision,sources.feature_registry.path)),
    tokens:JSON.parse(gitShow(aiCorePath,revision,sources.tokens.path)),
    components:JSON.parse(gitShow(aiCorePath,revision,sources.components.path)),
    patterns:JSON.parse(gitShow(aiCorePath,revision,sources.patterns.path)),
    freepassProductProfile:gitShow(aiCorePath,revision,sources.freepass_product_profile.path),
    startHere:gitShow(aiCorePath,revision,sources.start_here.path)
  };

  const checks=[
    ['entrypoint',bundle.entrypoint],
    ['feature_registry',bundle.featureRegistry],
    ['tokens',bundle.tokens],
    ['components',bundle.components],
    ['patterns',bundle.patterns]
  ];
  for(const [key,value] of checks){
    const source=sources[key];
    if(value.contract!==source.contract) throw new Error(`DESIGN_CORE_CONTRACT_MISMATCH:${key}`);
    if(value.version!==source.version) throw new Error(`DESIGN_CORE_VERSION_MISMATCH:${key}`);
    const blob=gitBlob(aiCorePath,revision,source.path);
    if(blob!==source.blob_sha) throw new Error(`DESIGN_CORE_BLOB_MISMATCH:${key}`);
  }
  const runtimeBlob=gitBlob(aiCorePath,revision,sources.runtime_css.path);
  if(runtimeBlob!==sources.runtime_css.blob_sha) throw new Error('DESIGN_CORE_BLOB_MISMATCH:runtime_css');

  for(const key of ['freepass_product_profile','start_here']){
    const source=sources[key];
    const blob=gitBlob(aiCorePath,revision,source.path);
    if(blob!==source.blob_sha) throw new Error(`DESIGN_CORE_BLOB_MISMATCH:${key}`);
  }

  if(bundle.entrypoint.status!=='CANONICAL_ENTRYPOINT') {
    throw new Error('DESIGN_CORE_ENTRYPOINT_NOT_CANONICAL');
  }
  if(bundle.entrypoint.product_profiles?.FREEPASS!==sources.freepass_product_profile.path) {
    throw new Error('DESIGN_CORE_FREEPASS_PROFILE_BINDING_MISMATCH');
  }
  return bundle;
}

export function validateDesignJob(job){
  const errors=[];
  if(job?.contract!=='devcenter-design-job/v1') errors.push('DESIGN_JOB_CONTRACT_INVALID');
  if(!/^[^/]+\/[^/]+$/.test(job?.target?.repository??'')) errors.push('DESIGN_JOB_REPOSITORY_INVALID');
  if(!/^[a-f0-9]{40}$/.test(job?.target?.revision??'')) errors.push('DESIGN_JOB_REVISION_INVALID');
  if(!job?.surface?.id) errors.push('DESIGN_JOB_SURFACE_REQUIRED');
  if(!Array.isArray(job?.surface?.viewports)||!job.surface.viewports.length) errors.push('DESIGN_JOB_VIEWPORT_REQUIRED');
  if(!job?.product_profile?.brand_profile_ref) errors.push('DESIGN_JOB_BRAND_PROFILE_REF_REQUIRED');
  if(!job?.product_profile?.ui_profile_ref) errors.push('DESIGN_JOB_UI_PROFILE_REF_REQUIRED');
  const isFreePass =
    String(job?.target?.project_id??'').toLowerCase().includes('freepass') ||
    String(job?.target?.repository??'').toLowerCase().includes('freepass');
  if(isFreePass && job?.product_profile?.ui_profile_ref!=='FREEPASS') {
    errors.push('DESIGN_JOB_FREEPASS_UI_PROFILE_REQUIRED');
  }
  if(!Array.isArray(job?.feature_ids)||!job.feature_ids.length) errors.push('DESIGN_JOB_FEATURES_REQUIRED');
  if(new Set(job?.feature_ids??[]).size!==(job?.feature_ids??[]).length) errors.push('DESIGN_JOB_FEATURE_DUPLICATE');
  if(!Array.isArray(job?.composition)||!job.composition.length) errors.push('DESIGN_JOB_COMPOSITION_REQUIRED');
  for(const block of job?.composition??[]){
    if(!job.feature_ids?.includes(block.feature_id)) errors.push(`DESIGN_JOB_COMPOSITION_FEATURE_NOT_DECLARED:${block.id}`);
  }
  if('token_values' in (job??{})) errors.push('DESIGN_JOB_INLINE_TOKEN_VALUES_FORBIDDEN');
  return errors;
}

function indexBy(list,key='feature_id'){
  return new Map((list??[]).map((item)=>[item[key],item]));
}

export function compileDesignJob(job,{binding,coreBundle}){
  const errors=validateDesignJob(job);
  if(errors.length) return {status:'FAIL',errors};

  const featureIndex=indexBy(coreBundle.featureRegistry.features,'id');
  const componentIndex=indexBy(coreBundle.components.components);
  const patternIndex=indexBy(coreBundle.patterns.patterns);
  const unknown=job.feature_ids.filter((id)=>!featureIndex.has(id));
  if(unknown.length) return {status:'FAIL',errors:unknown.map((id)=>`DESIGN_FEATURE_UNKNOWN:${id}`)};

  const features=job.feature_ids.map((id)=>{
    const feature=featureIndex.get(id);
    const component=componentIndex.get(id);
    const pattern=patternIndex.get(id);
    const implementation=component??pattern??null;
    return {
      feature_id:id,
      kind:feature.kind,
      profiles:feature.profiles??[],
      required_states:feature.required_states??[],
      verification:feature.verification??[],
      runtime:{
        implementation_status:implementation?.implementation_status??'UNMAPPED',
        css_selector:implementation?.css_selector??null,
        layer:implementation?.layer??(component?'component':null)
      }
    };
  });

  const composition=[...job.composition]
    .sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))
    .map((block)=>{
      const feature=features.find((f)=>f.feature_id===block.feature_id);
      return {...block,runtime:feature.runtime};
    });

  const runtimeGaps=features.filter((f)=>!['RUNTIME_V2','BASE_COMPAT'].includes(f.runtime.implementation_status));
  const qaProbes=[...new Set(features.flatMap((f)=>f.verification))].sort();
  const requiredStates=Object.fromEntries(features.map((f)=>[f.feature_id,f.required_states]));

  const holdForRuntime=job.quality.require_runtime_implementation && runtimeGaps.length>0;
  const result={
    status:holdForRuntime?'HOLD':'COMPILED',
    blocking_reasons:holdForRuntime?runtimeGaps.map((f)=>`RUNTIME_NOT_IMPLEMENTED:${f.feature_id}:${f.runtime.implementation_status}`):[]
  };

  return {
    contract:'devcenter-design-plan/v1',
    target:job.target,
    surface:job.surface,
    product_profile:job.product_profile,
    approved_design_refs:job.approved_design_refs??[],
    core_binding:{
      repository:binding.ai_core.repository,
      revision:binding.ai_core.revision,
      feature_registry_version:binding.sources.feature_registry.version,
      token_version:binding.sources.tokens.version,
      component_registry_version:binding.sources.components.version,
      pattern_registry_version:binding.sources.patterns.version,
      runtime_css_path:binding.sources.runtime_css.path,
      entrypoint_path:binding.sources.entrypoint.path,
      ui_profile_ref:job.product_profile.ui_profile_ref,
      product_profile_path:
        job.product_profile.ui_profile_ref==='FREEPASS'
          ? binding.sources.freepass_product_profile.path
          : null
    },
    features,
    composition,
    qa:{
      viewports:job.surface.viewports,
      probes:qaProbes,
      required_states:requiredStates,
      visual_receipt_required:Boolean(job.quality.require_visual_receipt)
    },
    result
  };
}

export function makeQualityDraft(plan,{startedAt,finishedAt}){
  const runtimePass=plan.result.status==='COMPILED';
  const runtimeEvidence=[{kind:'JSON',ref:'design-plan.json'}];
  return {
    subject:plan.target,
    hub:{primary:'design',secondary:['quality']},
    scope:{
      claims:[
        `Design plan compiled for surface ${plan.surface.id}`,
        `AI Core UI/UX binding pinned to ${plan.core_binding.revision}`
      ],
      exclusions:[
        'Browser screenshot/visual regression is not proven by compilation alone',
        'Production deployment is out of scope'
      ]
    },
    execution:{
      runner:'devcenter-design-compiler-v1',
      commands:['node scripts/design-compiler.mjs compile <job.json> <design-plan.json>'],
      started_at:startedAt,
      finished_at:finishedAt
    },
    checks:[
      {
        id:'DESIGN.CORE_BINDING',
        title:'AI Core UI/UX sources pinned and matched',
        status:'PASS',
        evidence:runtimeEvidence
      },
      {
        id:'DESIGN.RUNTIME_MAPPING',
        title:'Requested features have executable runtime mappings',
        status:runtimePass?'PASS':'HOLD',
        evidence:runtimeEvidence,
        ...(runtimePass?{}:{
          remediation:'Implement or adopt runtime mappings for every blocking feature before rendered conformance.',
          recheck:'Recompile the same project revision and design job against the pinned AI Core revision.'
        })
      },
      {
        id:'DESIGN.VISUAL_QA',
        title:'Visual QA receipt exists for required viewports and probes',
        status:plan.qa.visual_receipt_required?'HOLD':'NOTICE',
        evidence:[{kind:'JSON',ref:'design-plan.json'}],
        ...(plan.qa.visual_receipt_required?{
          remediation:'Render the compiled plan in a controlled browser and attach screenshot/visual-diff evidence.',
          recheck:'Run Design Hub visual QA against all plan.qa.viewports and plan.qa.probes.'
        }:{notes:'Visual receipt not required by this design job.'})
      }
    ],
    source_hashes:{}
  };
}

export function loadBinding(baseDir=HERE){
  return readJson(path.join(baseDir,'hubs','design','core-binding.json'));
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const [command,input,output]=process.argv.slice(2);
  try{
    if(command!=='compile'||!input) throw new Error('usage: design-compiler.mjs compile <job.json> [design-plan.json]');
    const job=readJson(path.resolve(input));
    const binding=loadBinding();
    const aiCorePath=process.env.AI_CORE_PATH||path.resolve(HERE,'..','ai-core');
    const coreBundle=loadCoreBundle({binding,aiCorePath});
    const plan=compileDesignJob(job,{binding,coreBundle});
    const json=JSON.stringify(plan,null,2)+'\n';
    if(output) fs.writeFileSync(path.resolve(output),json);
    else process.stdout.write(json);
    process.exitCode=plan.status==='FAIL'?1:plan.result?.status==='HOLD'?2:0;
  }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message},null,2));
    process.exitCode=1;
  }
}
