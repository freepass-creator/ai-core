#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {finalizeCoreHubReceipt} from '../../src/engine/core-hub-receipt.mjs';

function readJson(file){ return JSON.parse(fs.readFileSync(file,'utf8')); }

export function validateVisualJob(job){
  const errors=[];
  if(job?.contract!=='devcenter-design-visual-job/v1') errors.push('VISUAL_JOB_CONTRACT_INVALID');
  if(!job?.design_plan_ref) errors.push('VISUAL_JOB_PLAN_REF_REQUIRED');
  if(!/^https?:\/\//.test(job?.preview?.origin??'')) errors.push('VISUAL_JOB_ORIGIN_INVALID');
  if(!Array.isArray(job?.cases)||!job.cases.length) errors.push('VISUAL_JOB_CASES_REQUIRED');
  const ids=new Set();
  for(const c of job?.cases??[]){
    if(!/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(c?.id??'')) errors.push(`VISUAL_JOB_CASE_ID_INVALID:${c?.id??'(missing)'}`);
    if(ids.has(c?.id)) errors.push(`VISUAL_JOB_CASE_ID_DUPLICATE:${c?.id}`);
    ids.add(c?.id);
    if(!String(c?.path??'').startsWith('/')) errors.push(`VISUAL_JOB_CASE_PATH_INVALID:${c?.id}`);
    if(!['LTR','RTL'].includes(c?.direction)) errors.push(`VISUAL_JOB_DIRECTION_INVALID:${c?.id}`);
  }
  if(!Number.isInteger(job?.capture?.height)||job.capture.height<320) errors.push('VISUAL_JOB_CAPTURE_HEIGHT_INVALID');
  if(!Number.isInteger(job?.capture?.settle_ms)||job.capture.settle_ms<0) errors.push('VISUAL_JOB_SETTLE_INVALID');
  return errors;
}

export function makeVisualPlan(designPlan,job){
  const errors=validateVisualJob(job);
  if(errors.length) return {status:'FAIL',errors};
  if(designPlan?.contract!=='devcenter-design-plan/v1') return {status:'FAIL',errors:['DESIGN_PLAN_CONTRACT_INVALID']};
  if(designPlan?.result?.status!=='COMPILED') return {status:'HOLD',errors:['DESIGN_PLAN_NOT_COMPILED']};
  if(!/^[a-f0-9]{40}$/.test(designPlan?.target?.revision??'')) return {status:'FAIL',errors:['DESIGN_PLAN_TARGET_REVISION_INVALID']};
  if(!/^[a-f0-9]{40}$/.test(designPlan?.core_binding?.revision??'')) return {status:'FAIL',errors:['DESIGN_PLAN_CORE_REVISION_INVALID']};

  const captures=[];
  for(const visualCase of job.cases){
    for(const width of designPlan.qa?.viewports??[]){
      const url=new URL(visualCase.path,job.preview.origin).toString();
      captures.push({
        case_id:`${visualCase.id}@${width}`,
        variant_id:visualCase.id,
        state:visualCase.state,
        locale:visualCase.locale,
        direction:visualCase.direction,
        url,
        viewport:{width,height:job.capture.height},
        settle_ms:job.capture.settle_ms,
        screenshot_ref:`visual/${visualCase.id}-${width}.png`
      });
    }
  }
  const requiredViewports=[...new Set(designPlan.qa?.viewports??[])].sort((a,b)=>a-b);
  const covered=[...new Set(captures.map((c)=>c.viewport.width))].sort((a,b)=>a-b);
  const missing=requiredViewports.filter((w)=>!covered.includes(w));

  return {
    contract:'devcenter-design-visual-plan/v1',
    subject:{...designPlan.target,surface_id:designPlan.surface?.id},
    design_plan_ref:job.design_plan_ref,
    core_revision:designPlan.core_binding.revision,
    preview_origin:job.preview.origin,
    captures,
    review_requirements:{
      required_viewports:requiredViewports,
      required_probes:designPlan.qa?.probes??[],
      required_states:designPlan.qa?.required_states??{},
      checks:['layout-integrity','overflow-clipping','typography-hierarchy','action-visibility','state-visibility','brand-consistency']
    },
    result:{
      status:missing.length?'HOLD':'PLANNED',
      blocking_reasons:missing.map((w)=>`VIEWPORT_NOT_COVERED:${w}`)
    }
  };
}

export function validateCaptureManifest(manifest,visualPlan){
  const errors=[];
  if(manifest?.contract!=='devcenter-browser-capture-manifest/v1') errors.push('CAPTURE_MANIFEST_CONTRACT_INVALID');
  if(!manifest?.adapter?.id||!manifest?.adapter?.browser) errors.push('CAPTURE_ADAPTER_REQUIRED');
  const expected=new Map((visualPlan?.captures??[]).map((c)=>[c.case_id,c]));
  const seen=new Set();
  for(const capture of manifest?.captures??[]){
    if(!expected.has(capture?.case_id)) errors.push(`CAPTURE_CASE_UNKNOWN:${capture?.case_id}`);
    if(seen.has(capture?.case_id)) errors.push(`CAPTURE_CASE_DUPLICATE:${capture?.case_id}`);
    seen.add(capture?.case_id);
    if(!['PASS','FAIL'].includes(capture?.status)) errors.push(`CAPTURE_STATUS_INVALID:${capture?.case_id}`);
    if(capture?.status==='PASS'){
      if(!capture?.screenshot_ref) errors.push(`CAPTURE_SCREENSHOT_REQUIRED:${capture?.case_id}`);
      if(!/^[a-f0-9]{64}$/.test(capture?.sha256??'')) errors.push(`CAPTURE_SHA_REQUIRED:${capture?.case_id}`);
    }else if(!capture?.error){
      errors.push(`CAPTURE_ERROR_REQUIRED:${capture?.case_id}`);
    }
  }
  for(const caseId of expected.keys()) if(!seen.has(caseId)) errors.push(`CAPTURE_CASE_MISSING:${caseId}`);
  const failed=(manifest?.captures??[]).filter((c)=>c.status==='FAIL').length;
  const expectedStatus=failed?'FAIL':'PASS';
  if(manifest?.result?.status!==expectedStatus) errors.push('CAPTURE_RESULT_STATUS_MISMATCH');
  if(manifest?.result?.total!==expected.size) errors.push('CAPTURE_RESULT_TOTAL_MISMATCH');
  if(manifest?.result?.failed!==failed) errors.push('CAPTURE_RESULT_FAILED_MISMATCH');
  return errors;
}

function deriveReviewResult(caseResults=[]){
  const counts={PASS:0,HOLD:0,FAIL:0};
  for(const row of caseResults){
    if(row?.status in counts) counts[row.status]+=1;
  }
  return {
    status:counts.FAIL?'FAIL':counts.HOLD?'HOLD':'PASS',
    counts
  };
}

export function finalizeVisualReceipt(draft,{visualPlan,captureManifest,createdAt=new Date().toISOString()}={}){
  const captureErrors=validateCaptureManifest(captureManifest,visualPlan);
  if(captureErrors.length){
    const e=new Error('VISUAL_CAPTURE_MANIFEST_INVALID'); e.details=captureErrors; throw e;
  }
  if(captureManifest.result.status!=='PASS') throw new Error('VISUAL_CAPTURE_NOT_COMPLETE');
  if(!['AI_VISUAL_REVIEW','HUMAN_REVIEW'].includes(draft?.reviewer?.type)||!draft?.reviewer?.id) throw new Error('VISUAL_REVIEWER_REQUIRED');

  const expected=new Map(visualPlan.captures.map((c)=>[c.case_id,c]));
  const screenshotById=new Map(captureManifest.captures.map((c)=>[c.case_id,c]));
  const seen=new Set();
  const normalized=[];
  for(const row of draft?.case_results??[]){
    if(!expected.has(row?.case_id)) throw new Error(`VISUAL_REVIEW_CASE_UNKNOWN:${row?.case_id}`);
    if(seen.has(row.case_id)) throw new Error(`VISUAL_REVIEW_CASE_DUPLICATE:${row.case_id}`);
    seen.add(row.case_id);
    if(!['PASS','HOLD','FAIL'].includes(row?.status)) throw new Error(`VISUAL_REVIEW_STATUS_INVALID:${row.case_id}`);
    if(!Array.isArray(row?.checks)||!row.checks.length) throw new Error(`VISUAL_REVIEW_CHECKS_REQUIRED:${row.case_id}`);
    const shot=screenshotById.get(row.case_id);
    normalized.push({
      case_id:row.case_id,
      status:row.status,
      checks:row.checks,
      notes:row.notes??'',
      evidence:[{kind:'SCREENSHOT',ref:shot.screenshot_ref,sha256:shot.sha256}]
    });
  }
  for(const caseId of expected.keys()) if(!seen.has(caseId)) throw new Error(`VISUAL_REVIEW_CASE_MISSING:${caseId}`);

  const result=deriveReviewResult(normalized);
  const payload={
    subject:visualPlan.subject,
    visual_plan_ref:draft.visual_plan_ref,
    capture_manifest_ref:draft.capture_manifest_ref,
    reviewer:draft.reviewer,
    case_results:normalized,
    result
  };
  return finalizeCoreHubReceipt({kind:'design-visual',prefix:'dvr',payload,legacyContract:'devcenter-design-visual-receipt/v1',createdAt});
}

export function makeVisualQualityDraft(receipt,{startedAt,finishedAt}){
  const visual=receipt.payload;
  const evidence=[{kind:'REPORT',ref:visual.capture_manifest_ref},{kind:'REPORT',ref:visual.visual_plan_ref}];
  const check={
    id:'DESIGN.VISUAL_QA',
    title:'Browser visual review for all planned cases',
    status:visual.result.status,
    evidence,
    ...(visual.result.status==='PASS'?{}:{
      remediation:'Resolve every HOLD/FAIL visual review case and recapture the exact project revision.',
      recheck:'Re-run capture and visual review against the same design plan or issue a new plan when inputs change.'
    })
  };
  return {
    subject:{
      project_id:visual.subject.project_id,
      repository:visual.subject.repository,
      revision:visual.subject.revision
    },
    hub:{primary:'design',secondary:['quality']},
    scope:{
      claims:[`Visual QA reviewed all planned captures for ${visual.subject.surface_id}`],
      exclusions:['Production deployment remains outside this receipt']
    },
    execution:{
      runner:'devcenter-design-visual-qa-v1',
      commands:['capture visual plan','review screenshot manifest','finalize visual receipt'],
      started_at:startedAt,
      finished_at:finishedAt
    },
    checks:[check],
    source_hashes:{}
  };
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const [command,...args]=process.argv.slice(2);
  try{
    if(command==='plan'){
      const [designPlanFile,jobFile,output]=args;
      if(!designPlanFile||!jobFile) throw new Error('usage: design-visual-qa.mjs plan <design-plan.json> <visual-job.json> [visual-plan.json]');
      const result=makeVisualPlan(readJson(path.resolve(designPlanFile)),readJson(path.resolve(jobFile)));
      const json=JSON.stringify(result,null,2)+'\n';
      if(output) fs.writeFileSync(path.resolve(output),json); else process.stdout.write(json);
      process.exitCode=result.status==='FAIL'?1:result.result?.status==='HOLD'?2:0;
    }else if(command==='validate-captures'){
      const [visualPlanFile,manifestFile]=args;
      const errors=validateCaptureManifest(readJson(path.resolve(manifestFile)),readJson(path.resolve(visualPlanFile)));
      console.log(JSON.stringify({status:errors.length?'FAIL':'PASS',errors},null,2));
      process.exitCode=errors.length?1:0;
    }else{
      throw new Error('commands: plan | validate-captures');
    }
  }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message,details:error.details??[]},null,2));
    process.exitCode=1;
  }
}
