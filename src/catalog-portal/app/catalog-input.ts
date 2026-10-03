import type {Catalog,Rule} from './evidence';
export type SourceCode={path:string;sha256:string;source:string};
const expectedSourceHashes:Record<string,string>=JSON.parse('__DEVCENTER_SOURCE_HASHES__');
type ObjectValue=Record<string,unknown>;
const object=(v:unknown):v is ObjectValue=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string';
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const line=(v:unknown)=>count(v)&&Number(v)>0;
const texts=(v:unknown)=>Array.isArray(v)&&v.every(text);
const hash=(v:unknown)=>text(v)&&/^[a-f0-9]{64}$/i.test(v);
const strings=(v:ObjectValue,keys:string[])=>keys.every(k=>text(v[k]));
const pointer=(v:unknown)=>object(v)&&text(v.path)&&v.path.length>0&&line(v.line);
function invalid(label:string):never{throw Error(`${label}의 자료 형식이 올바르지 않습니다. 다시 불러오세요.`)}
async function sha256(value:string){
 if(!globalThis.crypto?.subtle)throw Error('원본 코드 확인에는 HTTPS 또는 localhost 접속이 필요합니다.');
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
// Structural boundary only: source truth, approval and semantic correctness remain separate.
export async function validateCatalogInputs(c:unknown,a:unknown,s:unknown):Promise<{catalog:Catalog;rules:Rule[];sources:Record<string,SourceCode>}>{
 if(!object(c)||!text(c.capturedAt)||!Number.isFinite(Date.parse(c.capturedAt))||!object(c.coverage)||!Array.isArray(c.documents)||!Array.isArray(c.projects)||!texts(c.limitations))invalid('규격 목록');
 for(const k of ['projectDirectories','walkedFiles','codeFilesRead','documents','readErrors','extractedRuleLines','displayedRuleLines'])if(!count(c.coverage[k]))invalid('조사 범위');
 const ids=new Set<string>();
 for(const d of c.documents){
  if(!object(d)||!strings(d,['id','project','path','title','lifecycle'])||!d.id||ids.has(d.id as string)||!hash(d.sha256)||!texts(d.categories)||!count(d.lineCount)||!Array.isArray(d.rules)||!d.rules.every(r=>object(r)&&line(r.line)&&text(r.text)))invalid('규격 문서');
  ids.add(d.id as string);
 }
 const projects=new Set<string>();for(const p of c.projects){if(!object(p)||!strings(p,['name','lifecycle'])||!p.name||projects.has(p.name as string)||(p.documents!==undefined&&!count(p.documents))||(p.codeFiles!==undefined&&!count(p.codeFiles)))invalid('프로젝트 목록');projects.add(p.name as string)}
 if(c.coverage.documents!==c.documents.length)invalid('규격 문서 수');
 if(!object(a)||!Array.isArray(a.rules))invalid('원자 대조');const ruleIds=new Set<string>();
 for(const r of a.rules){if(!object(r)||!strings(r,['id','rule','scope','atomKind','status','conflictOrLimit'])||!r.id||ruleIds.has(r.id as string)||!pointer(r.source)||!object(r.source)||!hash(r.source.sha256)||(r.consumption!==null&&(!pointer(r.consumption)||!object(r.consumption)||!text(r.consumption.evidence)||!hash(r.consumption.sha256))))invalid('원자 대조');ruleIds.add(r.id as string)}
 if(!object(s))invalid('원본 코드');for(const k of ['buttons','inputs','table','box','tokens']){const v=s[k];if(!object(v)||!strings(v,['path','source'])||!v.path||!hash(v.sha256)||v.sha256!==expectedSourceHashes[k]||await sha256(v.source as string)!==v.sha256)invalid('원본 코드')}
 return {catalog:c as unknown as Catalog,rules:a.rules as Rule[],sources:s as Record<string,SourceCode>};
}
