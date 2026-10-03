'use client';
import {useEffect,useState} from 'react';
import {Button} from './primitives';

type Status='PASS'|'NOTICE'|'HOLD'|'FAIL';
type Check={id:string;group:string;title:string;status:Status;evidence:string[];remediation:string;verification:string;dispatch:string;autoFix:boolean};
type Report={kind:string;capturedAt:string;policy:{id:string;source:string;sha256:string};target:{name:string;path:string;fingerprint:string};summary:{overall:Status;PASS:number;NOTICE:number;HOLD:number;FAIL:number;total:number};checks:Check[];limitations:string[]};
const labels:Record<Status,string>={PASS:'통과',NOTICE:'개선',HOLD:'판정 보류',FAIL:'규격 위반'};
function validate(value:unknown):Report{
 if(!value||typeof value!=='object')throw Error('지도점검 보고서 형식이 올바르지 않습니다.');
 const r=value as Report,statuses:Status[]=['PASS','NOTICE','HOLD','FAIL'];
 if(r.kind!=='devcenter_inspection_report_v1'||!r.target||typeof r.target.fingerprint!=='string'||!r.policy||!/^([a-f0-9]{64})$/.test(r.policy.sha256)||!r.summary||!Array.isArray(r.checks)||!Array.isArray(r.limitations))throw Error('지도점검 보고서 형식이 올바르지 않습니다.');
 if(!statuses.includes(r.summary.overall)||r.summary.total!==r.checks.length||r.checks.some(c=>!c.id||!c.title||!statuses.includes(c.status)||!Array.isArray(c.evidence)||!c.remediation||!c.verification))throw Error('지도점검 항목 형식이 올바르지 않습니다.');
 for(const s of statuses)if(r.checks.filter(c=>c.status===s).length!==r.summary[s])throw Error('지도점검 집계가 항목과 일치하지 않습니다.');
 const expected=r.summary.FAIL?'FAIL':r.summary.HOLD?'HOLD':r.summary.NOTICE?'NOTICE':'PASS';if(r.summary.overall!==expected)throw Error('지도점검 전체 판정이 항목과 일치하지 않습니다.');
 return r;
}
function order(status:Status){return {FAIL:0,HOLD:1,NOTICE:2,PASS:3}[status]}
export default function Inspection(){
 const [report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[copied,setCopied]=useState('');
 useEffect(()=>{const controller=new AbortController();setError('');fetch('/catalog/inspection.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('지도점검 보고서를 불러오지 못했습니다.');return r.json()}).then(v=>setReport(validate(v))).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()},[retry]);
 if(error)return <div className="error-box" role="alert">{error}<Button onClick={()=>setRetry(n=>n+1)}>점검 보고서 다시 읽기</Button></div>;
 if(!report)return <p role="status">현재 작업장의 점검 증거를 읽는 중입니다.</p>;
 const workOrder=(c?:Check)=>JSON.stringify({kind:'devcenter_corrective_work_order_v1',target:report.target,inspection:report.capturedAt,policy:report.policy,findings:(c?[c]:report.checks.filter(x=>x.status!=='PASS')).map(x=>({id:x.id,status:x.status,rule:x.title,evidence:x.evidence,requiredAction:x.remediation,recheck:x.verification})),approval:'required_when_target_or_authority_changes',completion:'new_hash_and_recheck_required'},null,2);
 async function copy(text:string,message:string){try{await navigator.clipboard.writeText(text);setCopied(message)}catch{setCopied('복사하지 못했습니다. 화면의 지시서를 직접 선택하세요.')}}
 return <section aria-label="개발 지도점검 관제실" className="inspection">
  <div className="command-banner"><div><span className="eyebrow">DEVELOPMENT CONTROL ROOM</span><h2>개발센터가 점검하고, 시정하고, 다시 검사합니다.</h2><p>AI 개인의 판단이 아니라 정본·규격·재현 증거·승인 상태로 작업을 지휘합니다.</p></div><strong className={`inspection-state ${report.summary.overall.toLowerCase()}`}>{labels[report.summary.overall]}</strong></div>
  <div className="governance-split"><article><h3>개발센터가 관장</h3><p>작업 범위, 규격 연결, 재사용 원자, 검사 기준, 시정명령, 수정 이력, 재검사와 종결</p></article><article><h3>원본이 결정</h3><p>업무 의미, 데이터 단위, 승인된 정책과 프로젝트별 계약. 센터는 원본을 복사해 새 정본을 만들지 않습니다.</p></article></div>
  <ol className="inspection-flow">{['대상 등록','정본·버전 고정','규격 점검','시정 배정','수정 실행','재검사·종결'].map((x,i)=><li key={x}><b>{i+1}</b><span>{x}</span></li>)}</ol>
  <section className="metrics" aria-label="점검 집계">{([['전체',report.summary.total],['통과',report.summary.PASS],['보류',report.summary.HOLD],['위반·개선',report.summary.FAIL+report.summary.NOTICE]] as const).map(([label,n])=><div key={label}><span>{label}</span><strong>{n}<small>건</small></strong></div>)}</section>
  <div className="inspection-target"><div><span>현재 점검 대상</span><strong>{report.target.name}</strong><code>{report.target.path}</code><small>fingerprint {report.target.fingerprint.slice(0,16)}</small></div><Button onClick={()=>copy(workOrder(),'전체 시정 작업 지시서 복사됨')}>전체 시정 지시서 복사</Button></div>
  <div className="audit-list">{[...report.checks].sort((a,b)=>order(a.status)-order(b.status)).map(c=><details key={c.id} open={c.status==='FAIL'||c.status==='HOLD'}><summary><span className="rule-id">{c.id}</span><strong>{c.title}</strong><span className={`inspection-badge ${c.status.toLowerCase()}`}>{labels[c.status]}</span></summary><div className="audit-body"><p>{c.group} · {c.dispatch==='instruction'?'시정 지시 가능':'검토 필요'} · 자동 수정 {c.autoFix?'허용':'미허용'}</p><h4>근거</h4>{c.evidence.map((e,i)=><code className="path" key={i}>{e}</code>)}<h4>시정 방법</h4><p>{c.remediation}</p><h4>재검사</h4><code className="path">{c.verification}</code>{c.status!=='PASS'&&<Button variant="outline" onClick={()=>copy(workOrder(c),`${c.id} 시정 지시서 복사됨`)}>이 항목 시정 지시서 복사</Button>}</div></details>)}</div>
  <p role="status">{copied}</p><details className="note"><summary>이번 자동 점검의 한계</summary>{report.limitations.map(x=><p key={x}>{x}</p>)}<p>점검 시각 {report.capturedAt} · 정책 {report.policy.id}</p></details>
 </section>
}
