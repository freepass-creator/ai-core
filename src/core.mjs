import { resolveSourceRequirements, bindResolvedSources } from './source-resolver.mjs';
import { compileContext } from './context-compiler.mjs';
import { resolveCapabilities } from './capability-resolver.mjs';

const DEV_HINTS=['개발','코드','ui','ux','erp','웹','앱','버그','기능','firebase','react','typescript','javascript','api'];
const DOC_HINTS=['문서','보고서','pdf','계약서','양식'];
const LEGAL_HINTS=['법률','소송','준비서면','고소','판례','법원'];

export function normalizeTask(input={}){
 if(!input.goal||typeof input.goal!=='string') throw new Error('goal is required');
 return {task_id:input.task_id??`CORE-${Date.now()}`,goal:input.goal.trim(),project:input.project??null,domain:input.domain??inferDomain(input.goal),risk:input.risk??'A',authority_required:Boolean(input.authority_required),done_when:input.done_when??[],constraints:input.constraints??[],changed_files_estimate:Number(input.changed_files_estimate??0),needs_build:Boolean(input.needs_build),needs_dependency_install:Boolean(input.needs_dependency_install),needs_runtime_debug:Boolean(input.needs_runtime_debug),cloud_reproducible:input.cloud_reproducible!==false,external_effect:input.external_effect??'none'};
}
export function inferDomain(goal){const s=goal.toLowerCase();if(DEV_HINTS.some(x=>s.includes(x)))return'development';if(LEGAL_HINTS.some(x=>s.includes(x)))return'legal';if(DOC_HINTS.some(x=>s.includes(x)))return'document';return'business';}
export function capabilityPlan(task){if(!['development','document'].includes(task.domain))return[];const scopes=['dev.repo.lifecycle'];const g=task.goal.toLowerCase();if(['ui','ux','화면','상품'].some(x=>g.includes(x)))scopes.push('dev.design.token','dev.design.atom');if(['상품','카드'].some(x=>g.includes(x)))scopes.push('dev.design.atom.product_card');if(task.domain==='document')scopes.push('dev.doc.form');return[...new Set(scopes)];}
export function executionRoute(task){const external=task.external_effect!=='none'||task.authority_required||task.risk==='D';if(external)return{route:'HUMAN_GATE',reason:'external or authority-sensitive action; owner-system approval required'};if(!task.cloud_reproducible)return{route:'LOCAL_REQUIRED',reason:'not reproducible in cloud'};if(task.changed_files_estimate>=10||task.needs_build||task.needs_dependency_install||task.needs_runtime_debug)return{route:'WORK_CODEX',reason:'repository execution/build/test/debug loop required'};return{route:'GPT_DIRECT',reason:'bounded GitHub-native work'};}

export function orchestrate(input, environment={}){
 const task=normalizeTask(input);
 const requirements=resolveSourceRequirements(task);
 const sourceBindings=bindResolvedSources(requirements,environment.resolved_sources??[]);
 const requestedScopes=capabilityPlan(task);
 const capabilityBindings=environment.devcenter_registry?resolveCapabilities(requestedScopes,environment.devcenter_registry):requestedScopes.map(scope=>({scope,status:'RESOLVE_REQUIRED'}));
 const context=compileContext({task,sourcePointers:(environment.resolved_sources??[]).map(x=>({...x,required:requirements.some(r=>r.system===x.system&&r.kind===x.kind&&r.required)})),capabilityRefs:environment.capability_refs??[],failures:environment.failures??[],decisions:environment.decisions??[]});
 const execution=executionRoute(task);
 const holds=[];
 if(!task.project&&task.domain==='development')holds.push('PROJECT_UNRESOLVED');
 if(!task.done_when.length)holds.push('DONE_WHEN_UNSPECIFIED');
 if(sourceBindings.some(x=>x.status==='HOLD'))holds.push('SOURCE_HOLD');
 if(capabilityBindings.some(x=>x.status==='HOLD'))holds.push('CAPABILITY_CONFLICT');
 if(context.status==='HOLD')holds.push('CONTEXT_HOLD');
 const status=holds.length?'HOLD':execution.route==='HUMAN_GATE'?'APPROVAL_REQUIRED':'READY';
 return {core_version:'0.2.0-candidate',task,source_requirements:requirements,source_bindings:sourceBindings,requested_capability_scopes:requestedScopes,capability_bindings:capabilityBindings,context,execution,status,holds,work_packet:{task_id:task.task_id,project:task.project,goal:task.goal,allowed_scope:task.constraints,done_when:task.done_when,source_bindings:sourceBindings.filter(x=>x.status==='BOUND').map(x=>x.pointer),capabilities:capabilityBindings.filter(x=>x.status==='RESOLVED').map(x=>x.asset),execution_route:execution.route,evidence_required:['subject_revision','source_revision_set','capability_revision_set','checks_executed','failures_and_skips','review_status']},execution_authorized:false};
}
