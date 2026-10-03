'use client';
import {useState} from 'react';
import {Button} from './primitives';
import {checkPlan,planFields,type WorkPlan} from './learning-model';
export default function Practice({onPlanChange}:{onPlanChange?:(plan:Partial<WorkPlan>)=>void}){
 const [plan,setPlan]=useState<Partial<WorkPlan>>({}),[checked,setChecked]=useState(false),[copied,setCopied]=useState('');const result=checkPlan(plan);
 return <section className="mini-card learning-panel" style={{marginTop:24}}><h2>내 작업에 적용하는 실습</h2><p>원본과 재사용 후보를 직접 찾은 뒤 작성하세요. 필수 칸의 누락을 확인하며, 내용의 진위·원본 접근·실제 실행을 자동 승인하지 않습니다.</p>{Object.entries(planFields).map(([id,label])=><label key={id} style={{display:'block',margin:'16px 0'}}>{label}<textarea className="ui-input" aria-label={label} rows={2} value={plan[id as keyof WorkPlan]||''} onChange={e=>{const next={...plan,[id]:e.target.value};setPlan(next);onPlanChange?.(next);setChecked(false);setCopied('')}}/></label>)}<Button onClick={()=>setChecked(true)}>계획 누락 확인</Button>{checked&&<div role="status"><p>{result.readyForReview?'필수 칸 작성됨 · 내용 검토 대기':`보완할 항목 ${result.missing.length}개`}</p>{result.missing.map(k=><p key={k}>{planFields[k]}</p>)}<p>원본 확인과 실무 승인은 별도입니다. 이 결과는 검수 통과가 아닙니다.</p><Button onClick={async()=>{try{await navigator.clipboard.writeText(JSON.stringify({kind:'work_plan_draft',plan,check:result},null,2));setCopied('작업 계획 복사됨')}catch{setCopied('복사 실패')}}}>작업 계획 복사</Button><p>{copied}</p></div>}</section>
}
