import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { 흐르나 } from '../governance/branch-flow.mjs';

// ★2026-09-29: 해시는 «줄끝을 LF 로 맞춘 글»로 잰다. Windows(core.autocrlf=true) 체크아웃은 CRLF 로 풀려
//   원바이트 해시가 모든 저장소에서 어긋났고, verify-kit 은 아무것도 안 고친 키트를 전부 FAIL 로 찍었다.
//   늘 실패하는 검사는 아무도 믿지 않는다. 키트 파일은 전부 글(md·mjs·json)이다.
export const KIT_DIGEST_RULE = 'sha256(utf8, CRLF→LF)';
const lf = body => String(body).replace(/\r\n/g, '\n');
const digest = body => createHash('sha256').update(lf(body)).digest('hex');
const portable = path => path.replaceAll('\\', '/').replace(/^docs\//, 'standards/');

// ★2026-09-30: 키트가 «낡았다»는 ai-core main 이 움직였다는 뜻이 아니라, 키트를 만든 «입력»이 바뀌었다는 뜻이어야 한다.
//   예전 규칙(main head === kit.core_revision)은 ai-core 에 무엇이든 병합되는 순간 모든 프로젝트를 HOLD 로 만들었다.
//   실측: 87b0f4f 이후 341커밋 — 배포된 키트 20곳 전부 AI_CORE_KIT_STALE. 늘 켜진 경보는 아무도 보지 않는다.
//   Codex 합의: 내용 기준(태그는 발행 누락 위험). 이름변경·간접 입력·갈라진 이력·잘린 비교는 닫는 쪽(STALE/UNKNOWN)으로.
export const KIT_GENERATOR_INPUTS = ['src/academy/starter-kit.mjs', 'src/academy/start-gate.mjs', 'scripts/academy-start.mjs', 'src/governance/branch-flow.mjs'];
export const BRANCH_FLOW_POLICY_SOURCE = 'registry/development-continuity-policy.json';

// ★2026-09-30: 「메인으로 붙어서 가는지도 봐야 함」(대표). ai-core 에만 있던 «한 방향» 검사를 모든 저장소의 세션 시작에 싣는다.
//   실측: 제품 저장소 12곳에 main 에 안 들어간 가지 57개, 그중 48개가 3일 넘게 멈춰 있었다.
//   판정은 새로 만들지 않는다 — src/governance/branch-flow.mjs 의 흐르나() 를 그대로 박는다(판정기가 둘이 되면 갈린다).
//   ★경고만 한다. 정리(병합·보관)는 운영(AI Ops) 몫이고, 세션을 막으면 멈춘 가지 하나 때문에 아무 일도 못 한다.
/** 가지 목록 → 흐르지 않는 가지 경고. 순수 함수 — 이 소스가 그대로 session-bootstrap.mjs 에 박힌다. */
export function branchFlowWarnings({ branches, policy, defaultBranch, now, judge, prKnown = true }) {
  if (!policy || !Array.isArray(branches)) return { checked: 0, violations: [], unconfirmed: [] };
  const p = { ...policy, flow_enforcement: { ...policy.flow_enforcement, exempt_refs: [...new Set([...(policy.flow_enforcement.exempt_refs || []), defaultBranch].filter(Boolean))] } };
  const violations = [], unconfirmed = [];
  for (const b of branches) {
    const r = judge(b, p, now);
    if (r.흐름 !== '위반') continue;
    // ★Codex 검토: PR 을 못 읽었으면 «열린 PR 없음»이 아니라 «모른다»다. PR 여부에 달린 STALLED 는 확정하지 않는다.
    //   (actor 접두사 위반은 PR 과 무관하므로 그대로 위반)
    if (!prKnown && /^STALLED/.test(r.까닭)) unconfirmed.push(b.ref);
    else violations.push({ ref: b.ref, why: r.까닭, fix: r.고치는법 || null });
  }
  return { checked: branches.length, violations, unconfirmed };
}

/** 키트 신선도 판정. 순수 함수 — 이 소스가 그대로 session-bootstrap.mjs 에 박힌다(밖의 이름을 쓰지 않는다). */
export function kitFreshness({ kitRevision, coreHead, inputs, catalogInputs, compare, verificationSource, verification, currentVerification }) {
  // ★Codex 검토(PR #346): kit.verification 은 registry/projects.json 의 이 프로젝트 commands 다. 파일째 넣으면 매일 STALE,
  //   빼면 명령이 바뀌어도 모른다 → 그 «칸»만 비교한다. 못 읽었으면(undefined) 닫는다.
  const same = (a, b) => { const c = (v) => (v && typeof v === 'object' ? (Array.isArray(v) ? '[' + v.map(c).join(',') + ']' : '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + c(v[k])).join(',') + '}') : JSON.stringify(v ?? null)); return c(a) === c(b); };
  const none = { changed: [], catalog_changed: [] };
  if (!coreHead) return { status: 'UNKNOWN', reason: 'CORE_HEAD_UNAVAILABLE', ...none };
  if (coreHead === kitRevision) return { status: 'CURRENT', reason: 'SAME_REVISION', ...none };
  if (!Array.isArray(inputs) || inputs.length === 0) return { status: 'STALE', reason: 'LEGACY_KIT_WITHOUT_INPUTS', ...none };
  if (!compare || !compare.ok || !Array.isArray(compare.files)) return { status: 'UNKNOWN', reason: 'COMPARE_UNAVAILABLE', ...none };
  if (compare.status === 'identical') return { status: 'CURRENT_CONTENT', reason: 'IDENTICAL', ...none };
  if (compare.status !== 'ahead') return { status: 'STALE', reason: 'HISTORY_' + String(compare.status).toUpperCase(), ...none };
  if (compare.files.length >= 300) return { status: 'STALE', reason: 'COMPARE_TRUNCATED', ...none };
  const touched = new Set(compare.files);
  const changed = inputs.filter((p) => touched.has(p));
  const catalog_changed = (catalogInputs || []).filter((p) => touched.has(p));
  if (verificationSource && touched.has(verificationSource)) {
    if (currentVerification === undefined) return { status: 'UNKNOWN', reason: 'VERIFICATION_UNREAD', changed, catalog_changed };
    if (!same(verification, currentVerification)) changed.push(verificationSource + '#commands');
  }
  return changed.length
    ? { status: 'STALE', reason: 'INPUT_CHANGED', changed, catalog_changed }
    : { status: 'CURRENT_CONTENT', reason: 'INPUTS_UNCHANGED', changed, catalog_changed };
}

async function put(path, body) {
  await mkdir(dirname(path), { recursive: true });
  try {
    const current = await readFile(path, 'utf8');
    if (lf(current) !== lf(body)) throw new Error(`KIT_FILE_CONFLICT:${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(path, body, { flag: 'wx' });
  }
}

export async function installAcademyStarterKit({ output, receipt, readings, coreRevision, operatingKnowledge = null, catalog = [], branchFlowPolicy = null }) {
  if (receipt?.status !== 'READY') throw new Error('READY_RECEIPT_REQUIRED');
  const files = [];
  for (const item of readings) {
    const path = portable(item.path);
    await put(join(output, path), item.body);
    files.push({ path, sha256: digest(item.body), source: item.path });
  }
  const manifest = {
    schema: 'ai-core-starter-kit/v1', digest_rule: KIT_DIGEST_RULE, core_revision: coreRevision, generated_at: receipt.observed_at,
    task: receipt.task, track: receipt.track, target: receipt.target, files,
    freshness_inputs: [...new Set([...readings.map(item => item.path.replaceAll('\\', '/')), ...(operatingKnowledge ? ['registry/operating-knowledge.json'] : []), ...(branchFlowPolicy ? [BRANCH_FLOW_POLICY_SOURCE] : []), ...KIT_GENERATOR_INPUTS])],
    // ★Codex 검토: ai-core 의 보관 접두사만 실으면 제품 저장소의 보관 가지가 늘 위반으로 뜬다. 그 프로젝트 것만 더한다 — 범용 archive- 면제는 구멍이다.
    branch_flow_policy: branchFlowPolicy ? { flow_enforcement: { ...branchFlowPolicy.flow_enforcement, exempt_prefixes: [...new Set([...(branchFlowPolicy.flow_enforcement.exempt_prefixes ?? []), ...(receipt.target?.project_id ? [`work/${receipt.target.project_id}/archive-`] : [])])] }, branch_naming: { forbidden_actor_prefixes: branchFlowPolicy.branch_naming?.forbidden_actor_prefixes ?? [] } } : null,
    catalog_inputs: catalog.map(item => item.source),
    verification_source: 'registry/projects.json',
    verification: receipt.precheck.completion_verification,
    reuse_policy: 'New assets require a recorded reuse decision before creation.',
  };
  const start = `# AI 작업 시작 키트\n\n> AI Core revision: ${coreRevision} · target revision: ${receipt.target.revision}\n\n1. 프로젝트 루트에서 \`node .ai-core/session-bootstrap.mjs\`를 실행해 정체성·정본·GitHub 연결·원격 최신성·검증 명령을 한 번에 확인한다.\n2. 원격보다 뒤처졌고 작업 트리가 깨끗하면 \`node .ai-core/session-bootstrap.mjs --sync\`로 현재 브랜치를 fast-forward only 방식으로 갱신한다. dirty·diverged·접근 실패 상태에서는 자동 반영하지 않는다.\n3. \`kit.json\`의 대상 repository와 baseline revision, 출력의 AI Core kit revision을 확인한다.\n4. \`standards/\`의 규격만 적용하고 대상 프로젝트 지침을 우선한다.\n5. 기존 자산을 먼저 찾고, 새 자산은 재사용 판정을 기록한다.\n6. \`node .ai-core/verify-kit.mjs\`로 키트 무결성과 대상 revision binding을 확인한다.\n7. 완료 시 \`WORK_RESULT.md\`를 채운다.\n`;
  const result = `# AI Work Result\n\n- 목적: ${receipt.task}\n- 대상 revision: ${receipt.target.revision}\n- 변경:\n- 검증:\n- 남음:\n- next_start_here:\n`;
  const verifier = `import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import{readFile}from'node:fs/promises';import{dirname,join}from'node:path';import{fileURLToPath}from'node:url';const root=dirname(fileURLToPath(import.meta.url)),projectRoot=dirname(root);const git=args=>execFileSync('git',['-C',projectRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();const m=JSON.parse(await readFile(join(root,'kit.json'),'utf8'));const bad=[];for(const f of m.files){const b=(await readFile(join(root,f.path),'utf8')).replace(/\\r\\n/g,'\\n');if(createHash('sha256').update(b).digest('hex')!==f.sha256)bad.push(f.path)}let actualRevision=null,revisionStatus='UNAVAILABLE',advancedPaths=[];try{actualRevision=git(['rev-parse','HEAD']);if(m.target?.revision===actualRevision)revisionStatus='MATCH';else{git(['merge-base','--is-ancestor',m.target?.revision,actualRevision]);advancedPaths=git(['diff','--name-only',m.target.revision+'..'+actualRevision]).split(/\\r?\\n/).filter(Boolean);revisionStatus=advancedPaths.length>0&&advancedPaths.every(path=>path.startsWith('.ai-core/'))?'KIT_ONLY_ADVANCE':'MISMATCH'}}catch{}const failed=bad.length>0||!['MATCH','KIT_ONLY_ADVANCE'].includes(revisionStatus);console.log(JSON.stringify({schema:'ai-core-starter-kit-check/v2',status:failed?'FAIL':'PASS',core_revision:m.core_revision,changed:bad,revision:{expected:m.target?.revision??null,actual:actualRevision,status:revisionStatus,advanced_paths:advancedPaths}},null,2));if(failed)process.exitCode=1;\n`;
  const bootstrap = `import{spawnSync}from'node:child_process';
import{readFile}from'node:fs/promises';
import{dirname,resolve,join}from'node:path';
import{fileURLToPath}from'node:url';
const core=dirname(fileURLToPath(import.meta.url)),root=resolve(core,'..'),sync=process.argv.includes('--sync');
const generatedAuthority={core_revision:${JSON.stringify(coreRevision)},target_revision:${JSON.stringify(receipt.target.revision)}};
const run=(cmd,args=[])=>{const r=spawnSync(cmd,args,{cwd:root,encoding:'utf8',windowsHide:true,shell:false});return{ok:!r.error&&r.status===0,status:r.status,stdout:(r.stdout??'').trim(),error:r.error?.code??null}};
const kit=JSON.parse(await readFile(join(core,'kit.json'),'utf8'));
const knowledge=JSON.parse(await readFile(join(core,'OPERATING_KNOWLEDGE.json'),'utf8'));
const gitVersion=run('git',['--version']),nodeVersion={ok:true,stdout:process.version};
const remote=run('git',['remote','get-url','origin']),branch=run('git',['branch','--show-current']);
let head=run('git',['rev-parse','HEAD']),dirty=run('git',['status','--porcelain']);
const ghVersion=run('gh',['--version']),ghAuth=ghVersion.ok?run('gh',['auth','status']):{ok:false,error:'GH_NOT_FOUND'},ghUser=ghAuth.ok?run('gh',['api','user','--jq','.login']):{ok:false,error:'GH_AUTH_UNAVAILABLE'};
const repo=kit.target?.repository??null,repoAccess=ghUser.ok&&repo?run('gh',['repo','view',repo,'--json','nameWithOwner','--jq','.nameWithOwner']):{ok:false,error:'GH_IDENTITY_OR_REPO_MISSING'};
const expected=knowledge.platforms?.find(x=>x.id==='platform.github')?.connection?.account??null;
const remoteLine=remote.ok&&branch.ok&&branch.stdout?run('git',['ls-remote','--heads','origin','refs/heads/'+branch.stdout]):{ok:false,error:'BRANCH_OR_REMOTE_MISSING'};
let remoteHead=remoteLine.ok?remoteLine.stdout.split(/\\s+/)[0]||null:null,syncResult='NOT_REQUESTED';
if(sync&&dirty.ok&&!dirty.stdout&&branch.ok&&branch.stdout&&remoteHead&&head.ok&&head.stdout!==remoteHead){
  const fetched=run('git',['fetch','--quiet','origin',branch.stdout]);
  const remoteRef='refs/remotes/origin/'+branch.stdout;
  const fetchedHead=fetched.ok?run('git',['rev-parse',remoteRef]):{ok:false};
  const ancestor=fetchedHead.ok?run('git',['merge-base','--is-ancestor',head.stdout,fetchedHead.stdout]):{ok:false};
  if(fetched.ok&&fetchedHead.ok&&ancestor.ok){const merged=run('git',['merge','--ff-only',remoteRef]);syncResult=merged.ok?'FAST_FORWARDED':'FAST_FORWARD_FAILED';}
  else syncResult=fetched.ok?'DIVERGED':'FETCH_FAILED';
  head=run('git',['rev-parse','HEAD']);dirty=run('git',['status','--porcelain']);
  const refreshed=run('git',['ls-remote','--heads','origin','refs/heads/'+branch.stdout]);remoteHead=refreshed.ok?refreshed.stdout.split(/\\s+/)[0]||remoteHead:remoteHead;
}else if(sync&&dirty.ok&&dirty.stdout)syncResult='SKIPPED_DIRTY';
else if(sync&&head.ok&&remoteHead===head.stdout)syncResult='ALREADY_CURRENT';
else if(sync)syncResult='REMOTE_HEAD_UNAVAILABLE';
const coreRepo='freepass-creator/ai-core';
const coreHead=ghAuth.ok?run('gh',['api','repos/'+coreRepo+'/commits/main','--jq','.sha']):{ok:false,error:'GH_AUTH_UNAVAILABLE'};
const projectFreshness=remoteHead&&head.ok?(remoteHead===head.stdout?'CURRENT':'STALE_OR_DIVERGED'):'UNKNOWN';
${kitFreshness.toString()}
const 흐르나=${흐르나.toString()};
${branchFlowWarnings.toString()}
const coreCompareRun=coreHead.ok&&coreHead.stdout!==kit.core_revision&&Array.isArray(kit.freshness_inputs)?run('gh',['api','repos/'+coreRepo+'/compare/'+kit.core_revision+'...'+coreHead.stdout,'--jq','{status:.status,ahead_by:.ahead_by,files:[.files[]|.filename,(.previous_filename//empty)]}']):null;
let coreCompare=null;try{coreCompare=coreCompareRun?.ok?{ok:true,...JSON.parse(coreCompareRun.stdout)}:(coreCompareRun?{ok:false}:null)}catch{coreCompare={ok:false}}
let currentVerification;
if(coreCompare?.ok&&kit.verification_source&&coreCompare.files?.includes(kit.verification_source)){const raw=run('gh',['api','-H','Accept: application/vnd.github.raw','repos/'+coreRepo+'/contents/'+kit.verification_source+'?ref='+coreHead.stdout]);try{if(raw.ok){const reg=JSON.parse(raw.stdout);const p=(reg.projects??[]).find(x=>x.project_id===kit.target?.project_id);currentVerification=p?.commands??null;}}catch{}}
const freshness=kitFreshness({kitRevision:kit.core_revision,coreHead:coreHead.ok?coreHead.stdout:null,inputs:kit.freshness_inputs,catalogInputs:kit.catalog_inputs,compare:coreCompare,verificationSource:kit.verification_source,verification:kit.verification,currentVerification});
const coreFreshness=freshness.status;
const authorityPaths=['.ai-core/kit.json','.ai-core/session-bootstrap.mjs','.ai-core/verify-kit.mjs','.ai-core/START_HERE.md'];
const authorityEpochPaths=['.ai-core/session-bootstrap.mjs','.ai-core/kit.json','.ai-core/START_HERE.md'];
const authorityHistory=run('git',['log','--format=%H','--','.ai-core/session-bootstrap.mjs']);
const authorityEpochs=[];
if(authorityHistory.ok){for(const candidate of authorityHistory.stdout.split(/\\r?\\n/).filter(Boolean)){const changed=run('git',['diff-tree','--no-commit-id','--name-only','-r',candidate]);if(!changed.ok)continue;const paths=changed.stdout.split(/\\r?\\n/).filter(Boolean);if(!authorityEpochPaths.every(path=>paths.includes(path)))continue;const manifestAtCandidate=run('git',['show',candidate+':.ai-core/kit.json']);if(!manifestAtCandidate.ok)continue;try{const candidateKit=JSON.parse(manifestAtCandidate.stdout);const coreRevisionAtCandidate=candidateKit.core_revision,targetRevisionAtCandidate=candidateKit.target?.revision;if(!coreRevisionAtCandidate||!targetRevisionAtCandidate)continue;authorityEpochs.push({commit:candidate,generation_key:coreRevisionAtCandidate+':'+targetRevisionAtCandidate});}catch{}}}
let authorityAnchor=null;
for(let index=0;index<authorityEpochs.length;index+=1){const candidate=authorityEpochs[index];const generationAlreadyIntroduced=authorityEpochs.slice(index+1).some(item=>item.generation_key===candidate.generation_key);if(!generationAlreadyIntroduced){authorityAnchor=candidate.commit;break;}}
const authorityChanged=[];
if(authorityAnchor){for(const path of authorityPaths){const anchored=run('git',['rev-parse',authorityAnchor+':'+path]);const current=run('git',['hash-object',path]);if(!anchored.ok||!current.ok||anchored.stdout!==current.stdout)authorityChanged.push(path.replace('.ai-core/',''));}}
if(kit.core_revision!==generatedAuthority.core_revision||kit.target?.revision!==generatedAuthority.target_revision){if(!authorityChanged.includes('kit.json'))authorityChanged.push('kit.json');}
const authorityStatus=!authorityAnchor?'UNAVAILABLE':authorityChanged.length?'MISMATCH':'MATCH';
const kitCheck=authorityStatus==='MATCH'?run(process.execPath,[join(core,'verify-kit.mjs')]):{ok:false,status:null,stdout:'',error:'STARTER_KIT_AUTHORITY_UNVERIFIED'};
let kitVerification=null;
try{kitVerification=kitCheck.stdout?JSON.parse(kitCheck.stdout):null}catch{}
const kitRevisionStatus=kitVerification?.revision?.status??'UNAVAILABLE';
const kitReady=authorityStatus==='MATCH'&&kitCheck.ok&&kitVerification?.status==='PASS';
const blockers=[];
if(!gitVersion.ok)blockers.push('GIT_UNAVAILABLE');
if(!remote.ok)blockers.push('GIT_REMOTE_UNAVAILABLE');
if(!ghVersion.ok)blockers.push('GH_CLI_UNAVAILABLE');else if(!ghAuth.ok)blockers.push('GH_AUTH_UNAVAILABLE');else if(expected&&ghUser.stdout!==expected)blockers.push('GH_IDENTITY_MISMATCH');
if(!repoAccess.ok)blockers.push('GITHUB_REPOSITORY_UNAVAILABLE');
if(dirty.ok&&dirty.stdout)blockers.push('DIRTY_WORKTREE_REVIEW_REQUIRED');
if(!remoteHead)blockers.push('REMOTE_BRANCH_HEAD_UNAVAILABLE');else if(projectFreshness!=='CURRENT')blockers.push(syncResult==='DIVERGED'?'LOCAL_BRANCH_DIVERGED':'LOCAL_BRANCH_NOT_CURRENT');
if(!coreHead.ok)blockers.push('AI_CORE_REMOTE_HEAD_UNAVAILABLE');else if(coreFreshness==='UNKNOWN')blockers.push('AI_CORE_KIT_FRESHNESS_UNKNOWN');else if(coreFreshness==='STALE')blockers.push('AI_CORE_KIT_STALE');
const warnings=freshness.catalog_changed.length?['AI_CORE_CATALOG_CHANGED: catalog/ 는 참고용 사본이다 — 쓰기 전에 ai-core registry 에서 다시 읽는다 ('+freshness.catalog_changed.join(', ')+')']:[];
const flowScan=kit.branch_flow_policy?run('git',['ls-remote','--symref','origin']):{ok:false,stdout:''};
let defaultBranch=null;const remoteHeads=new Map();
if(flowScan.ok){for(const line of flowScan.stdout.split(/\\r?\\n/).filter(Boolean)){const sym=line.match(/^ref:\\s+refs\\/heads\\/(\\S+)\\s+HEAD$/);if(sym){defaultBranch=sym[1];continue;}const m=line.match(/^([0-9a-f]{40})\\s+refs\\/heads\\/(.+)$/);if(m)remoteHeads.set(m[2],m[1]);}}
const localAll=flowScan.ok?run('git',['for-each-ref','--format=%(objectname)|%(committerdate:iso-strict)','refs/remotes/origin']):{ok:false,stdout:''};
const shaDate=new Map();if(localAll.ok)for(const l of localAll.stdout.split(/\\r?\\n/).filter(Boolean)){const [s,d]=l.split('|');shaDate.set(s,d);}
const defaultSha=defaultBranch?remoteHeads.get(defaultBranch):null;
const noMergedRun=flowScan.ok&&defaultSha&&shaDate.has(defaultSha)?run('git',['for-each-ref','--no-merged='+defaultSha,'--format=%(objectname)','refs/remotes/origin']):{ok:false,stdout:''};
const noMerged=new Set(noMergedRun.ok?noMergedRun.stdout.split(/\\r?\\n/).filter(Boolean):[]);
const openPrs=kit.branch_flow_policy&&defaultBranch&&ghAuth.ok&&repo?run('gh',['pr','list','--repo',repo,'--state','open','--base',defaultBranch,'--limit','1000','--json','headRefName,number,isCrossRepository']):{ok:false,stdout:''};
const prByRef=new Map();let prListTruncated=false,prKnown=false;try{if(openPrs.ok){const list=JSON.parse(openPrs.stdout||'[]');prListTruncated=list.length>=1000;for(const p of list)if(!p.isCrossRepository)prByRef.set(p.headRefName,p.number);prKnown=!prListTruncated;}}catch{}
const flowBranches=[],unscanned=[];
if(noMergedRun.ok){for(const [ref,sha] of remoteHeads){if(ref===defaultBranch)continue;if(!shaDate.has(sha)){unscanned.push(ref);continue;}if(!noMerged.has(sha))continue;flowBranches.push({ref,마지막커밋:shaDate.get(sha),열린PR:prByRef.get(ref)??null});}}
const branchFlow=branchFlowWarnings({branches:flowBranches,policy:kit.branch_flow_policy,defaultBranch,now:new Date(),judge:흐르나,prKnown});
if(branchFlow.unconfirmed.length)warnings.push('BRANCH_FLOW_PR_UNKNOWN: 열린 PR 을 확인하지 못해 멈춘 것으로 보이는 가지 '+branchFlow.unconfirmed.length+'개를 확정하지 못했다('+branchFlow.unconfirmed.slice(0,5).join(', ')+') — gh 인증 뒤 다시 본다');
if(kit.branch_flow_policy&&!noMergedRun.ok)warnings.push('BRANCH_FLOW_UNKNOWN: 원격 가지를 판정하지 못했다(원격 조회 또는 기본 가지 커밋이 로컬에 없음) — 「흐르지 않는 가지 없음」이 아니라 «모른다»다. git fetch 뒤 다시 본다');
if(unscanned.length)warnings.push('BRANCH_FLOW_PARTIAL: 로컬에 없는 원격 가지 '+unscanned.length+'개는 판정하지 못했다 — git fetch 뒤 다시 본다');
if(prListTruncated)warnings.push('BRANCH_FLOW_PR_LIST_TRUNCATED: 열린 PR 이 1000개 이상이라 목록이 잘렸을 수 있다 — PR 여부에 달린 판정은 확정하지 않는다');
if(branchFlow.violations.length)warnings.push('BRANCH_NOT_FLOWING: main 으로 흐르지 않는 가지 '+branchFlow.violations.length+'개 — '+branchFlow.violations.slice(0,5).map(v=>v.ref).join(', ')+(branchFlow.violations.length>5?' …':'')+' · 정리(PR 로 보내기·보관으로 닫기)는 운영 몫이다. 이 경고는 세션을 막지 않는다');
if(!kitReady){if(kitRevisionStatus==='MISMATCH')blockers.push('STARTER_KIT_REVISION_MISMATCH');else blockers.push('STARTER_KIT_VERIFICATION_FAILED');}
if(syncResult==='FETCH_FAILED'||syncResult==='FAST_FORWARD_FAILED')blockers.push('SAFE_SYNC_FAILED');
const next=blockers.includes('STARTER_KIT_REVISION_MISMATCH')?'Regenerate the AI Core starter kit against this exact project revision before starting work.':blockers.includes('STARTER_KIT_VERIFICATION_FAILED')?'Repair starter-kit verification before starting work.':blockers.includes('AI_CORE_KIT_STALE')?'Refresh this project through the AI Core starter-kit distribution PR, then rerun bootstrap.':blockers.includes('LOCAL_BRANCH_NOT_CURRENT')?'If the worktree is clean and the branch should follow origin, rerun with --sync.':blockers.length?'Resolve only the listed blockers; preserve local work and continue safe read-only work where possible.':'Read project instructions and begin the user task directly.';
const out={schema:'ai-core-session-bootstrap/v2',status:blockers.length?'HOLD':'READY',mode:sync?'SYNC':'OBSERVE',project:{repository:repo,expected_baseline:kit.target?.revision??null,remote:remote.ok?remote.stdout:null,branch:branch.ok?branch.stdout:null,head:head.ok?head.stdout:null,remote_head:remoteHead,remote_freshness:projectFreshness,dirty:dirty.ok?Boolean(dirty.stdout):null,sync_result:syncResult,branch_flow:{default_branch:defaultBranch,checked:branchFlow.checked,unscanned:unscanned.length,pr_known:prKnown,unconfirmed:branchFlow.unconfirmed.slice(0,20),violations:branchFlow.violations.slice(0,20)},kit_authority:{status:authorityStatus,anchor_commit:authorityAnchor,changed:authorityChanged},kit_verification:kitVerification},civilization:{core_repository:coreRepo,kit_revision:kit.core_revision,remote_head:coreHead.ok?coreHead.stdout:null,remote_freshness:coreFreshness,freshness_reason:freshness.reason,ahead_by:coreCompare?.ahead_by??null,changed_inputs:freshness.changed,constitution:'standards/AI_WORKING_STANDARD.md',operating_knowledge:'OPERATING_KNOWLEDGE.json',catalog:'catalog/',handoff:'WORK_RESULT.md',evolution_inbox:'https://github.com/freepass-creator/ai-core/issues/211',verification:kit.verification},access:{node:nodeVersion.stdout,git:gitVersion.ok?gitVersion.stdout:null,github:{expected_identity:expected,actual_identity:ghUser.ok?ghUser.stdout:null,cli:ghVersion.ok?'AVAILABLE':'UNAVAILABLE',auth:ghAuth.ok?'READY':'UNAVAILABLE',repository:repoAccess.ok?'READY':'UNAVAILABLE'}},rules:{github_latest_required:true,fast_forward_only:true,reuse_first:true,preserve_dirty_work:true,no_secret_output:true,no_repeated_login:true},blockers,warnings,next_action:next};
console.log(JSON.stringify(out,null,2));if(blockers.length)process.exitCode=2;
`;
  files.push({ path: 'session-bootstrap.mjs', sha256: digest(bootstrap), source: 'generated:session-bootstrap/v2' });
  await put(join(output, 'START_HERE.md'), start);
  await put(join(output, 'WORK_RESULT.md'), result);
  await put(join(output, 'verify-kit.mjs'), verifier);
  await put(join(output, 'session-bootstrap.mjs'), bootstrap);
  await put(join(output, 'kit.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  if (operatingKnowledge) await put(join(output, 'OPERATING_KNOWLEDGE.json'), `${JSON.stringify(operatingKnowledge, null, 2)}\n`);
  const catalogIndex=[];
  for(const item of catalog){
    const body=`${JSON.stringify(item.data,null,2)}\n`;
    const path=`catalog/${item.name}`;
    await put(join(output,path),body);
    catalogIndex.push({path,sha256:digest(body),source:item.source,core_revision:coreRevision});
  }
  if(catalogIndex.length) await put(join(output,'CATALOG_INDEX.json'),`${JSON.stringify({schema:'ai-core-starter-catalog/v1',generated_at:receipt.observed_at,items:catalogIndex},null,2)}\n`);
  return { status: 'INSTALLED', output, manifest, entrypoint: join(output, 'START_HERE.md') };
}
