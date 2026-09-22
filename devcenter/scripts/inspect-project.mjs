import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const exists=file=>fs.existsSync(file)&&fs.statSync(file).isFile();

function git(target,args){
 const r=spawnSync('git',args,{cwd:target,encoding:'utf8',windowsHide:true});
 return {ok:r.status===0,out:(r.stdout||'').trim(),error:(r.stderr||'').trim(),status:r.status};
}

export function inspectProject(targetInput,{acceptancePath}={}){
 const target=path.resolve(targetInput),checks=[];
 const add=(id,group,title,status,evidence,remediation,verification,dispatch='instruction')=>checks.push({id,group,title,status,evidence,remediation,verification,dispatch,autoFix:false});
 if(!fs.existsSync(target)||!fs.statSync(target).isDirectory())throw Error('Inspection target must be an existing directory');
 const top=git(target,['rev-parse','--show-toplevel']);
 if(!top.ok){
  add('GOV-REPO-001','기준 고정','Git 저장소 식별','HOLD',[top.error||'git root unavailable'],'저장소 경로와 버전 관리 기준을 확정한다.','git rev-parse --show-toplevel');
 }else{
  const branch=git(target,['branch','--show-current']),head=git(target,['rev-parse','HEAD']),status=git(target,['status','--porcelain=v1']),tracked=git(target,['ls-files']);
  add('GOV-REPO-001','기준 고정','Git 저장소 식별',head.ok?'PASS':'HOLD',[`root=${top.out}`,`branch=${branch.out||'(detached)'}`,`HEAD=${head.out||'(unborn)'}`],head.ok?'없음.':'첫 기준 커밋 또는 명시적인 작업 트리 스냅샷을 고정한다.','같은 HEAD와 작업 트리 상태를 다시 기록한다.');
  add('GOV-WORKTREE-001','기준 고정','작업 트리 변경 분리',!status.ok?'HOLD':status.out?'NOTICE':'PASS',[!status.ok?status.error||'git status failed':status.out?`changed=${status.out.split(/\r?\n/).length}`:'changed=0'],!status.ok?'Git 상태 판독 오류를 해결하고 변경 범위를 다시 확인한다.':status.out?'기존 변경과 지도점검 수정 범위를 파일별로 분리한다.':'없음.','git status --short');
  const gitLock=git(target,['rev-parse','--git-path','index.lock']),lock=gitLock.ok?path.resolve(target,gitLock.out):path.join(top.out,'.git','index.lock');
  add('GOV-LOCK-001','실행 안전','Git 쓰기 잠금',!gitLock.ok||fs.existsSync(lock)?'HOLD':'PASS',[!gitLock.ok?gitLock.error||'git lock path unavailable':fs.existsSync(lock)?`present=${lock}`:'index.lock absent'],!gitLock.ok?'Git 메타데이터 경로를 복구한 뒤 잠금을 다시 확인한다.':fs.existsSync(lock)?'실행 중인 Git 프로세스와 잠금 소유를 확인한 뒤 안전하게 복구한다.':'없음.','git rev-parse --git-path index.lock 후 실제 파일과 Git 상태를 확인한다.');
  const sensitive=(tracked.out?tracked.out.split(/\r?\n/):[]).filter(f=>{const name=f.split('/').at(-1)||'';return name==='.env'||(name.startsWith('.env.')&&name!=='.env.example')||/^id_rsa(?:\..+)?$/i.test(name)||/^credentials?[^/]*$/i.test(name)||/^secrets?[^/]*$/i.test(name)||/\.(pem|p12|pfx)$/i.test(name)});
  add('GOV-SECRET-001','보안 경계','민감 파일명 추적 차단',!tracked.ok?'HOLD':sensitive.length?'FAIL':'PASS',!tracked.ok?[tracked.error||'git ls-files failed']:sensitive.length?sensitive:['민감 파일명 패턴의 Git 추적 없음'],!tracked.ok?'Git 색인을 복구한 뒤 파일명만 다시 검사한다.':sensitive.length?'값을 출력하지 말고 추적 중단·회전 필요 여부를 별도 보안 절차로 확인한다.':'없음.','git ls-files 이름만 재검사한다.');
 }
 const ruleFiles=['AGENTS.md','CLAUDE.md'].filter(f=>exists(path.join(target,f)));
 add('GOV-RULE-001','규격 연결','프로젝트 작업 규칙 진입점',ruleFiles.length?'PASS':'HOLD',ruleFiles.length?ruleFiles.map(f=>`${f} sha256=${sha(fs.readFileSync(path.join(target,f)))}`):['AGENTS.md/CLAUDE.md 없음'],ruleFiles.length?'적용 범위와 상위 정본 포인터가 현행인지 확인한다.':'프로젝트의 최소 작업 규칙과 정본 포인터를 승인받아 만든다.','새 세션에서 진입 파일을 읽고 동일 경로와 해시를 보고하는지 확인한다.');
 const packageFiles=[path.join(target,'package.json'),...fs.readdirSync(target,{withFileTypes:true}).filter(e=>e.isDirectory()&&!e.name.startsWith('.')).map(e=>path.join(target,e.name,'package.json'))].filter(exists);
 if(packageFiles.length){
  try{
   const found=packageFiles.map(file=>{const pkg=JSON.parse(fs.readFileSync(file,'utf8'));return {file:path.relative(target,file).replaceAll('\\','/'),names:Object.keys(pkg.scripts||{})}}),names=[...new Set(found.flatMap(x=>x.names))],required=['build','test','typecheck'],missing=required.filter(x=>!names.includes(x));
   add('GOV-CHECK-001','검증 계약','빌드·테스트·타입검사 명령',missing.length?'NOTICE':'PASS',[...found.map(x=>`${x.file}: ${x.names.sort().join(',')||'(none)'}`),`missing=${missing.join(',')||'(none)'}`],missing.length?'없는 명령이 불필요한지 근거를 남기고, 필요한 검사를 표준 명령으로 연결한다.':'없음.','선택한 명령을 실행하고 종료코드와 산출물을 기록한다.');
  }catch(e){add('GOV-CHECK-001','검증 계약','package.json 검사 명령','HOLD',[e.name],'JSON 형식을 복구한 뒤 검사 명령을 다시 읽는다.','package.json 재파싱');}
 }else add('GOV-CHECK-001','검증 계약','검사 명령 진입점','NOTICE',['package.json 없음'],'사용 기술에 맞는 공식 검사 진입점을 문서화한다.','대상 프로젝트의 실제 검사 명령 실행');
 const acceptance=acceptancePath||path.join(target,'portal','static','catalog','acceptance.json');
 if(exists(acceptance)){
  try{
   const report=JSON.parse(fs.readFileSync(acceptance,'utf8')),criteria=Array.isArray(report.areas)?report.areas.flatMap(a=>Array.isArray(a.criteria)?a.criteria:[]):[],pending=criteria.filter(c=>c.status!=='PASS').map(c=>c.id),passCount=criteria.filter(c=>c.status==='PASS').length,ids=criteria.map(c=>c.id),basicPass=criteria.filter(c=>!c.deep&&c.status==='PASS').length,deepPass=criteria.filter(c=>c.deep&&c.status==='PASS').length,basicTotal=criteria.filter(c=>!c.deep).length,deepTotal=criteria.filter(c=>c.deep).length;
   const baselineFile=path.join(target,'quality','acceptance-v1.json'),baselineIds=exists(baselineFile)?JSON.parse(fs.readFileSync(baselineFile,'utf8')).areas?.flatMap(a=>a.criteria?.map(c=>c.id)||[]):null,idSetValid=!baselineIds||(baselineIds.length===50&&baselineIds.every(id=>ids.includes(id))&&ids.every(id=>baselineIds.includes(id)));
   const areasValid=Array.isArray(report.areas)&&report.areas.length===5&&report.areas.every(a=>{const list=Array.isArray(a.criteria)?a.criteria:[],n=list.filter(c=>c.status==='PASS').length;return list.length===10&&a.total===10&&a.passed===n&&a.percentage===n*10});
   const valid=report.total===50&&areasValid&&criteria.length===50&&new Set(ids).size===50&&idSetValid&&criteria.every(c=>typeof c.id==='string'&&typeof c.deep==='boolean'&&['PASS','UNVERIFIED','PENDING'].includes(c.status))&&Number.isInteger(report.passed)&&report.passed===passCount&&report.average===passCount*2&&Number.isInteger(report.basic?.passed)&&Number.isInteger(report.deep?.passed)&&report.basic.total===40&&report.deep.total===10&&basicTotal===40&&deepTotal===10&&report.basic.passed===basicPass&&report.deep.passed===deepPass;
   add('GOV-EVIDENCE-001','검증 증거','고정 인수 보고서',valid?'PASS':'HOLD',[valid?`passed=${report.passed}/${report.total}; pending=${pending.join(',')||'(none)'}`:'인수 보고서 구조 불일치'],valid?'미통과 항목을 통과로 올리지 말고 각각 증거를 연결한다.':'보고서 스키마와 고정 분모를 복구한다.','node scripts/report-acceptance.mjs');
   const reviewStatus=!valid?'HOLD':report.overallReview==='HOLD'?'HOLD':report.overallReview==='PASS'?'PASS':'NOTICE';
   add('GOV-REVIEW-001','독립 검토','전체 검토 게이트',reviewStatus,[valid?`overallReview=${report.overallReview??'(missing)'}`:'인수 보고서 구조 불일치로 검토 상태를 신뢰하지 않음'],'같은 최종 해시로 필요한 독립 검토 응답과 이견 해소 근거를 확보한다.','역할별 실제 응답·해시·판정을 재대조한다.');
  }catch(e){add('GOV-EVIDENCE-001','검증 증거','고정 인수 보고서','HOLD',[e.name],'손상된 보고서를 재생성한다.','node scripts/report-acceptance.mjs');add('GOV-REVIEW-001','독립 검토','전체 검토 게이트','HOLD',['인수 보고서를 신뢰할 수 없어 검토 상태 미확인'],'보고서를 복구하고 같은 최종 해시로 독립 검토를 다시 확인한다.','역할별 실제 응답·해시·판정을 재대조한다.');}
 }
 const ssotGate=path.join(target,'ssot','four-ai-review-gate.json'),engine=path.join(target,'ssot','ssot_audit.py');
 if(exists(ssotGate)&&exists(engine)){
  try{const gate=JSON.parse(fs.readFileSync(ssotGate,'utf8')),actual=sha(fs.readFileSync(engine));const ok=gate.source_sha256===actual&&gate.explicit_ok_count>=2;add('GOV-SSOT-001','SSOT 엔진','검토 대상 해시 일치',ok?'PASS':'HOLD',[`current=${actual}`,`reviewed=${gate.source_sha256}`,`okCount=${gate.explicit_ok_count}`],ok?'검수 범위 밖의 운영 연결을 별도로 표시한다.':'현재 해시로 독립 검토를 다시 받는다.','엔진 SHA-256과 검토 게이트를 재대조한다.');}catch(e){add('GOV-SSOT-001','SSOT 엔진','검토 게이트 판독','HOLD',[e.name],'검토 게이트 형식을 복구한다.','게이트 JSON 재파싱');}
 }
 const counts=Object.fromEntries(['PASS','NOTICE','HOLD','FAIL'].map(s=>[s,checks.filter(c=>c.status===s).length]));
 const overall=counts.FAIL?'FAIL':counts.HOLD?'HOLD':counts.NOTICE?'NOTICE':'PASS';
 const identity={target:target.replaceAll('\\','/'),gitHead:git(target,['rev-parse','HEAD']).out||null,checks:checks.map(c=>[c.id,c.status,c.evidence])};
 const policyFile=path.join(here,'operations','inspection','POLICY.md');
 return {kind:'devcenter_inspection_report_v1',capturedAt:new Date().toISOString(),policy:{id:'devcenter-inspection-v1',source:'operations/inspection/POLICY.md',sha256:sha(fs.readFileSync(policyFile))},target:{name:path.basename(target),path:target.replaceAll('\\','/'),fingerprint:sha(JSON.stringify(identity))},summary:{overall,...counts,total:checks.length},checks,limitations:['읽기 전용 구조 점검이며 대상 코드를 실행하지 않는다.','업무 의미·UI 상태·운영 데이터는 대상별 어댑터와 승인된 원본 대조가 필요하다.','NOTICE와 HOLD는 자동 수정 대상이 아니다.']};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 const value=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined};
 const target=value('--target')||here,output=value('--output'),acceptancePath=value('--acceptance');
 try{const report=inspectProject(target,{acceptancePath});const json=JSON.stringify(report,null,2);if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(path.resolve(output),json)}else console.log(json);process.exitCode=report.summary.FAIL?1:report.summary.HOLD?2:0;}catch(e){console.error(e.message);process.exitCode=3}
}
