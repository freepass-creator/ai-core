import { 브리핑 } from '../integration/core-brief.mjs';
import { defineCapabilityAdapter } from './adapter-contract.mjs';
export function createDefaultBuiltins({readWorkProjection=null}={}){
  const m=new Map();
  m.set('core.brief',defineCapabilityAdapter({id:'core.brief',modes:['READ_ONLY'],invoke:async({input})=>({
    status:'SUCCEEDED',summary:'AI Core 브리핑을 구성했습니다.',data:브리핑(input??{}),
    evidence:['READ: src/integration/core-brief.mjs'],artifacts:[],checks:[{name:'core.brief',status:'PASS'}],blockers:[],external_effect:false
  })}));
  m.set('work.projection',defineCapabilityAdapter({id:'work.projection',modes:['READ_ONLY'],invoke:async({input})=>{
    if(typeof readWorkProjection!=='function') return{status:'HOLD',summary:'운영 Work projection provider가 없습니다.',evidence:[],artifacts:[],checks:[{name:'work.projection.provider',status:'FAIL'}],blockers:['WORK_PROJECTION_PROVIDER_REQUIRED'],external_effect:false};
    const p=await readWorkProjection(input.order_id), hold=['HOLD','UNLINKED'].includes(p?.status);
    return{status:hold?'HOLD':'SUCCEEDED',summary:hold?'정본 Work projection이 HOLD입니다.':'정본 Work projection을 읽었습니다.',data:p,evidence:['READ: canonical work projection'],artifacts:[],checks:[{name:'work.projection',status:hold?'FAIL':'PASS'}],blockers:hold?[p?.reason??p?.status??'WORK_PROJECTION_HOLD']:[],external_effect:false};
  }}));
  return m;
}
