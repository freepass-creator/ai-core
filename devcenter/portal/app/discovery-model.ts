// Learning candidates only. Pure in-memory models, not production storage or HTTP adapters.
// Source: this file. Published source views are derived copies with a build-time SHA.
export type DocumentVersion={value:string;version:number};
export function saveVersion(current:DocumentVersion,expected:number,value:string,protect:boolean){
 if(!Number.isSafeInteger(expected)||expected<1||!Number.isSafeInteger(current.version)||current.version<1||current.version>=Number.MAX_SAFE_INTEGER)throw Error('유효한 버전이 필요합니다.');
 if(typeof value!=='string'||!value.trim()||value.length>120)throw Error('저장 내용은 1~120자입니다.');
 if(protect&&expected!==current.version)return {status:'conflict' as const,document:current};
 return {status:'saved' as const,document:{value,version:current.version+1}};
}
export type RequestLedger={rows:{key:string;payload:string;result:string}[]};
export function submitOnce(ledger:RequestLedger,key:string,payload:string,protect:boolean){
 if(typeof key!=='string'||!key.trim()||key.length>80||typeof payload!=='string'||!payload.trim()||payload.length>120)throw Error('요청 표식은 1~80자, 내용은 1~120자입니다.');
 const prior=ledger.rows.find(r=>r.key===key);
 if(protect&&prior)return {status:prior.payload===payload?'replayed' as const:'conflict' as const,ledger,result:prior.payload===payload?prior.result:null};
 if(ledger.rows.length>=30)throw Error('실험은 30건까지입니다. 초기화 후 다시 진행하세요.');
 const result=`DEMO-${ledger.rows.length+1}`;
 return {status:'created' as const,ledger:{rows:[...ledger.rows,{key,payload,result}]},result};
}
export type SearchRace={latest:number;next:number;visible:string;pending:{id:number;query:string}[]};
export function startSearch(state:SearchRace,query:string):SearchRace{
 if(!query.trim()||query.length>80)throw Error('검색어는 1~80자입니다.');
 if(state.pending.length>=10)throw Error('대기 요청은 10개까지입니다. 먼저 응답을 도착시키세요.');
 if(!Number.isSafeInteger(state.next)||state.next<1||state.next>=Number.MAX_SAFE_INTEGER)throw Error('요청 순번을 초기화하세요.');
 return {...state,latest:state.next,next:state.next+1,pending:[...state.pending,{id:state.next,query}]};
}
export function finishSearch(state:SearchRace,id:number,protect:boolean){
 const request=state.pending.find(r=>r.id===id);if(!request)throw Error('대기 중인 요청이 아닙니다.');
 const ignored=protect&&id!==state.latest;
 return {ignored,state:{...state,pending:state.pending.filter(r=>r.id!==id),visible:ignored?state.visible:request.query}};
}
export const emptySearch=():SearchRace=>({latest:0,next:1,visible:'아직 결과 없음',pending:[]});
