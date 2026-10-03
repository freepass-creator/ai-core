export type Question={id:string;cardId:string;prompt:string;choices:string[];answer:number;explanation:string};
export const planFields={project:'대상 프로젝트',objective:'요청과 완료 조건',sourcePath:'기준 원본 경로',sourceVersion:'원본 버전 또는 작업 트리 상태',reuseDecision:'재사용할 자산 또는 신규 제작 이유',verification:'검증할 입력·기대 결과·증거 위치'};
export type WorkPlan=Record<keyof typeof planFields,string>;
export function checkPlan(plan:Partial<WorkPlan>){const missing=(Object.keys(planFields) as (keyof WorkPlan)[]).filter(k=>typeof plan[k]!=='string'||!plan[k]!.trim()||/^(미확인|모름|unknown|추후|나중에)$/i.test(plan[k]!.trim()));return {missing,readyForReview:missing.length===0,sourceVerified:false as const,approved:false as const};}
export function gradeQuestions(questions:Question[],answers:Record<string,number>){
 const ids=new Set<string>();
 for(const q of questions){if(ids.has(q.id)||!q.id||!Array.isArray(q.choices)||q.choices.length<2||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.choices.length)throw Error('잘못된 학습 문제입니다.');ids.add(q.id)}
 const invalid=Object.entries(answers).some(([id,a])=>{const q=questions.find(q=>q.id===id);return !q||!Number.isInteger(a)||a<0||a>=q.choices.length});
 if(invalid)throw Error('답안의 문항 또는 선택값을 확인하세요.');
 const results=questions.map(q=>({id:q.id,cardId:q.cardId,answered:Object.hasOwn(answers,q.id),correct:Object.hasOwn(answers,q.id)&&answers[q.id]===q.answer}));
 return {total:questions.length,answered:results.filter(r=>r.answered).length,correct:results.filter(r=>r.correct).length,results,certification:false as const};
}

// Browser-local, self-reported learning evidence. This is never an approval ledger.
export const historyKey='devcenter.learning-history.v1';
export type LearningRecord={id:string;session:string;createdAt:string;questionVersion:string;kind:'learning'|'practice';answers:Record<string,number>;plan:Partial<WorkPlan>;outcome:'not-run'|'passed'|'failed';evidence:string};
export type LearningArchive={version:1;records:LearningRecord[]};
const plain=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
function fields(x:Record<string,unknown>,allowed:string[]){if(Object.keys(x).some(k=>!allowed.includes(k)))throw Error('알 수 없는 이력 필드가 있습니다.');}
function textField(x:unknown,max:number,required=false){if(typeof x!=='string'||x.length>max||(required&&!x.trim()))throw Error('이력의 필수 내용 또는 길이를 확인하세요.');}
export function parseHistory(raw:string,questions:Question[],currentVersion:string):LearningArchive{
 if(raw.length>1000000)throw Error('이력은 1MB 이하만 읽을 수 있습니다.');
 const value:unknown=JSON.parse(raw);if(!plain(value)||value.version!==1||!Array.isArray(value.records)||value.records.length>200)throw Error('지원하지 않는 이력 형식 또는 200건 초과입니다.');
 fields(value,['version','records']);const ids=new Set<string>();
 for(const item of value.records){
  if(!plain(item))throw Error('잘못된 이력입니다.');fields(item,['id','session','createdAt','questionVersion','kind','answers','plan','outcome','evidence']);
  if(typeof item.id!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(item.id)||ids.has(item.id))throw Error('이력 ID가 잘못되었거나 중복입니다.');ids.add(item.id);
  textField(item.session,120,true);textField(item.evidence,4000);
  if(typeof item.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.createdAt)||!Number.isFinite(Date.parse(item.createdAt))||new Date(item.createdAt).toISOString()!==item.createdAt)throw Error('이력 시각이 잘못되었습니다.');
  if(typeof item.questionVersion!=='string'||!/^[a-f0-9]{64}$/.test(item.questionVersion))throw Error('문제 버전이 잘못되었습니다.');
  if(!['learning','practice'].includes(String(item.kind))||!['not-run','passed','failed'].includes(String(item.outcome))||!plain(item.answers)||!plain(item.plan))throw Error('이력 종류 또는 결과가 잘못되었습니다.');
  if(Object.keys(item.answers).length>100||Object.entries(item.answers).some(([id,a])=>id.length>120||!Number.isInteger(a)||Number(a)<0||Number(a)>100))throw Error('답안 형식이 잘못되었습니다.');
  fields(item.plan,Object.keys(planFields));for(const v of Object.values(item.plan))textField(v,4000);
  if(item.questionVersion===currentVersion)gradeQuestions(questions,item.answers as Record<string,number>);
  if(item.kind==='learning'&&(Object.keys(item.plan).length||item.outcome!=='not-run'||item.evidence!==''))throw Error('학습 이력에는 실무 결과를 넣을 수 없습니다.');
  if(item.kind==='practice'&&(Object.keys(item.answers).length||!checkPlan(item.plan as Partial<WorkPlan>).readyForReview))throw Error('실습 이력은 필수 계획 6개가 필요합니다.');
  if(item.kind==='practice'&&item.outcome!=='not-run'&&!String(item.evidence).trim())throw Error('실행 결과의 근거 위치를 입력하세요.');
 }
 return value as LearningArchive;
}
export function mergeHistory(existing:LearningArchive,incoming:LearningArchive):LearningArchive{
 const canonical=(r:LearningRecord)=>JSON.stringify([r.id,r.session,r.createdAt,r.questionVersion,r.kind,Object.entries(r.answers).sort(),Object.entries(r.plan).sort(),r.outcome,r.evidence]);
 const records=[...existing.records];for(const record of incoming.records){const old=records.find(r=>r.id===record.id);if(old){if(canonical(old)!==canonical(record))throw Error('같은 ID의 내용이 다릅니다. 기존 이력을 보존했습니다.');}else records.push(record);}
 if(records.length>200)throw Error('최대 200건입니다. 기존 이력을 보존했습니다.');return {version:1,records};
}

export async function validateLearningCatalog(value:unknown){
 const invalid=()=>{throw Error('학습 목록의 형식이나 문제 버전이 올바르지 않습니다. 다시 불러오세요.');};
 if(!plain(value)||!Array.isArray(value.cards)||!Array.isArray(value.questions)||!plain(value.counts))return invalid();
 for(const k of ['registered','structured','sourceCurrent','testEvidence','independentReviewed','approved'])if(!Number.isInteger(value.counts[k])||Number(value.counts[k])<0)return invalid();
 const cardIds=new Set<string>();
 for(const c of value.cards){
  if(!plain(c)||typeof c.id!=='string'||!c.id||cardIds.has(c.id))return invalid();cardIds.add(c.id);
  for(const k of ['title','group','scope','explanation','reuse'])if(typeof c[k]!=='string')return invalid();
  if(!Array.isArray(c.sources)||!c.sources.every(s=>plain(s)&&typeof s.path==='string'&&typeof s.sha256==='string')||!Array.isArray(c.failureCases)||!c.failureCases.every(s=>typeof s==='string'))return invalid();
  if(!plain(c.example)||typeof c.example.page!=='string'||typeof c.example.label!=='string'||!plain(c.verification)||typeof c.verification.limitations!=='string'||!Array.isArray(c.verification.suites)||!c.verification.suites.every(s=>typeof s==='string')||!plain(c.audit))return invalid();
  for(const k of ['structureComplete','sourceCurrent','testsPassed','reviewComplete','approved'])if(typeof c.audit[k]!=='boolean')return invalid();
 }
 for(const q of value.questions){if(!plain(q)||typeof q.id!=='string'||typeof q.cardId!=='string'||!cardIds.has(q.cardId)||typeof q.prompt!=='string'||typeof q.explanation!=='string'||!Array.isArray(q.choices)||!q.choices.every(s=>typeof s==='string'))return invalid();}
 try{gradeQuestions(value.questions as Question[],{})}catch{return invalid()}
 if(value.evidence!==null&&(!plain(value.evidence)||typeof value.evidence.capturedAt!=='string'||typeof value.evidence.current!=='boolean'))return invalid();
 if(!globalThis.crypto?.subtle)throw Error('학습 버전 검증에는 HTTPS 또는 localhost 접속이 필요합니다.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value.questions))),hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==value.questionVersion)return invalid();
}
