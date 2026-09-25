import { capabilityIndex, projectIndex, validateCapabilityRegistryReferences, capabilitySupportsProject } from './capability-registry.mjs';
import { normalizeAdapterResult } from './adapter-contract.mjs';
import { createWorkResult } from './result-envelope.mjs';
import { createProjectRuntime } from './project-runtime.mjs';
import { createDefaultBuiltins } from './builtins.mjs';

const nonempty=v=>typeof v==='string'&&v.trim()===v&&v.length>0;
const missingInputs=(cap,input)=>cap.inputs.filter(x=>x.required&&(input?.[x.name]===undefined||input?.[x.name]===null)).map(x=>x.name);

export function createCapabilityEngine({capabilityRegistry,projectRegistry,builtins=null,runtime=createProjectRuntime(),verifyAuthority=null,authorityProvider=null,executorIdentity=null,readWorkProjection=null,clock=Date.now}={}){
  validateCapabilityRegistryReferences(capabilityRegistry,projectRegistry);
  const caps=capabilityIndex(capabilityRegistry), projects=projectIndex(projectRegistry), builtinAdapters=builtins??createDefaultBuiltins({readWorkProjection});

  function plan({route,orderId=null,workId=null}={}){
    if(!route?.capability_id||!route?.target_project_id) return{status:'HOLD',reason:'ROUTE_REQUIRED'};
    const cap=caps.get(route.capability_id), project=projects.get(route.target_project_id);
    if(!cap) return{status:'HOLD',reason:'CAPABILITY_NOT_REGISTERED'};
    if(!project) return{status:'HOLD',reason:'PROJECT_NOT_REGISTERED'};
    if(!capabilitySupportsProject(cap,project.project_id)) return{status:'HOLD',reason:'CAPABILITY_PROJECT_MISMATCH'};
    if(cap.status!=='ACTIVE') return{status:'HOLD',reason:'CAPABILITY_NOT_ACTIVE',hold_reason:cap.hold_reason,capability_id:cap.id,project_id:project.project_id};
    const projectReadiness=project.execution_readiness_status??project.status;
    if(projectReadiness!=='ACTIVE') return{status:'HOLD',reason:'PROJECT_NOT_ACTIVE',capability_id:cap.id,project_id:project.project_id};
    if(route.target_revision!==project.head_revision) return{status:'HOLD',reason:'ROUTE_REVISION_STALE',capability_id:cap.id,project_id:project.project_id};
    return{status:'PLANNED',capability_id:cap.id,project_id:project.project_id,subject_revision:project.head_revision,
      order_id:nonempty(orderId)?orderId:null,work_id:nonempty(workId)?workId:null,mode:cap.mode,adapter:structuredClone(cap.adapter),
      required_scopes:[...cap.required_scopes],walls:[...cap.walls],result_contract:cap.result_contract,authorization_source:null};
  }

  async function run({route,orderId=null,workId=null,requestId=null,input={},perform=false,authority=null}={}){
    let p=plan({route,orderId,workId});
    if(p.status!=='PLANNED') return createWorkResult({plan:p.capability_id?{capability_id:p.capability_id,project_id:p.project_id}:null,status:'HOLD',summary:'capability 실행 경로가 HOLD입니다.',blockers:[p.reason],nextAction:p.hold_reason??'route/project/capability 상태를 확인합니다.',clock});
    const cap=caps.get(p.capability_id), project=projects.get(p.project_id);
    const missing=missingInputs(cap,input);
    if(missing.length) return createWorkResult({plan:p,status:'HOLD',summary:'capability 입력이 부족합니다.',blockers:missing.map(x=>`INPUT_REQUIRED_${x.toUpperCase()}`),nextAction:'필수 입력을 채웁니다.',clock});

    let effectiveAuthority=authority;
    if(cap.mode==='EXTERNAL_MUTATION'){
      if(!perform) return createWorkResult({plan:p,status:'PREPARED',summary:'외부 변경 capability를 준비했습니다. 실행하지 않았습니다.',adapterResult:{data:{required_scopes:cap.required_scopes,walls:cap.walls},evidence:[],artifacts:[],checks:[{name:'authority',status:'SKIP',detail:'perform=false'}],blockers:[],external_effect:false},performed:false,nextAction:'현재 work/revision의 권한 receipt가 있어야 실행됩니다.',clock});
      if(!p.order_id||!p.work_id) return createWorkResult({plan:p,status:'HOLD',summary:'외부 변경은 order/work 문맥 없이 실행할 수 없습니다.',blockers:['EXECUTION_CONTEXT_REQUIRED'],clock});
      if(!effectiveAuthority&&typeof authorityProvider==='function') effectiveAuthority=await authorityProvider({plan:structuredClone(p),capability:structuredClone(cap)});
      if(effectiveAuthority?.status==='HOLD') return createWorkResult({plan:p,status:'HOLD',summary:'현재 정본 상태에서 실행 권한이 없습니다.',blockers:[effectiveAuthority.reason??'AUTHORITY_NOT_AVAILABLE'],clock});
      const shape=effectiveAuthority?.schema==='ai-core-authority-receipt/v1'&&effectiveAuthority?.status==='GRANTED'&&effectiveAuthority.order_id===p.order_id&&effectiveAuthority.work_id===p.work_id&&effectiveAuthority.capability_id===cap.id&&effectiveAuthority.project_id===p.project_id&&effectiveAuthority.subject_revision===p.subject_revision&&Array.isArray(effectiveAuthority.scopes)&&cap.required_scopes.every(s=>effectiveAuthority.scopes.includes(s));
      if(!shape) return createWorkResult({plan:p,status:'HOLD',summary:'현재 revision 권한 receipt가 없습니다.',blockers:['AUTHORITY_RECEIPT_INVALID'],clock});
      if(typeof verifyAuthority!=='function') return createWorkResult({plan:p,status:'HOLD',summary:'승인 receipt 검증기가 없습니다.',blockers:['AUTHORITY_VERIFIER_REQUIRED'],clock});
      if(await verifyAuthority({authority:structuredClone(effectiveAuthority),plan:structuredClone(p),capability:structuredClone(cap)})!==true) return createWorkResult({plan:p,status:'HOLD',summary:'승인 receipt 검증 실패.',blockers:['AUTHORITY_NOT_VERIFIED'],clock});
      p={...p,authorization_source:effectiveAuthority.receipt_id??effectiveAuthority.ledger_event_id??effectiveAuthority.ledger_head??null};
    }

    if(cap.mode==='LOCAL_MUTATION'&&!perform) return createWorkResult({plan:p,status:'PREPARED',summary:'로컬 capability를 준비했습니다. 실행하지 않았습니다.',adapterResult:{data:null,evidence:[],artifacts:[],checks:[{name:cap.id,status:'SKIP',detail:'perform=false'}],blockers:[],external_effect:false},performed:false,nextAction:'perform=true에서 revision/dirty 상태를 다시 확인합니다.',clock});

    const startedAt=new Date(clock()).toISOString();
    try{
      let result;
      if(cap.adapter.kind==='BUILTIN'){
        const a=builtinAdapters.get?.(cap.adapter.id)??builtinAdapters[cap.adapter.id];
        if(!a||typeof a.invoke!=='function') throw new Error('BUILTIN_ADAPTER_MISSING');
        result=await a.invoke({plan:p,capability:cap,project,input,authority:effectiveAuthority??authority});
      }else if(cap.adapter.kind==='PROJECT_MODULE'){
        result=normalizeAdapterResult(await runtime.runModule(cap,project,input,{plan:p,authority:effectiveAuthority??authority,executorIdentity,requestId}));
      }else if(['PROJECT_COMMAND','PROJECT_REGISTRY_COMMAND'].includes(cap.adapter.kind)){
        result=normalizeAdapterResult(await runtime.runCommand(cap,project));
      }else throw new Error('CAPABILITY_ADAPTER_KIND_UNSUPPORTED');
      return createWorkResult({plan:p,status:result.status,adapterResult:result,performed:true,startedAt,clock});
    }catch(error){
      return createWorkResult({plan:p,status:'HOLD',summary:'capability 실행 경계에서 중단했습니다.',performed:false,startedAt,blockers:[error?.message||'CAPABILITY_EXECUTION_FAILED'],nextAction:'blocker를 해소한 뒤 같은 route/revision에서 다시 실행합니다.',clock});
    }
  }
  return Object.freeze({plan,run});
}
