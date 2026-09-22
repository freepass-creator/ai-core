import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const digest = body => createHash('sha256').update(body).digest('hex');
const portable = path => path.replaceAll('\\', '/').replace(/^docs\//, 'standards/');

async function put(path, body) {
  await mkdir(dirname(path), { recursive: true });
  try {
    const current = await readFile(path, 'utf8');
    if (current !== body) throw new Error(`KIT_FILE_CONFLICT:${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(path, body, { flag: 'wx' });
  }
}

export async function installAcademyStarterKit({ output, receipt, readings, coreRevision, operatingKnowledge = null, catalog = [] }) {
  if (receipt?.status !== 'READY') throw new Error('READY_RECEIPT_REQUIRED');
  const files = [];
  for (const item of readings) {
    const path = portable(item.path);
    await put(join(output, path), item.body);
    files.push({ path, sha256: digest(item.body), source: item.path });
  }
  const manifest = {
    schema: 'ai-core-starter-kit/v1', core_revision: coreRevision, generated_at: receipt.observed_at,
    task: receipt.task, track: receipt.track, target: receipt.target, files,
    verification: receipt.precheck.completion_verification,
    reuse_policy: 'New assets require a recorded reuse decision before creation.',
  };
  const start = `# AI 작업 시작 키트\n\n1. 프로젝트 루트에서 \`node .ai-core/session-bootstrap.mjs\`를 실행해 정체성·정본·GitHub 연결·원격 최신성·검증 명령을 한 번에 확인한다.\n2. 원격보다 뒤처졌고 작업 트리가 깨끗하면 \`node .ai-core/session-bootstrap.mjs --sync\`로 현재 브랜치를 fast-forward only 방식으로 갱신한다. dirty·diverged·접근 실패 상태에서는 자동 반영하지 않는다.\n3. \`kit.json\`의 대상 repository와 baseline revision, 출력의 AI Core kit revision을 확인한다.\n4. \`standards/\`의 규격만 적용하고 대상 프로젝트 지침을 우선한다.\n5. 기존 자산을 먼저 찾고, 새 자산은 재사용 판정을 기록한다.\n6. \`node .ai-core/verify-kit.mjs\`로 키트 무결성을 확인한다.\n7. 완료 시 \`WORK_RESULT.md\`를 채운다.\n`;
  const result = `# AI Work Result\n\n- 목적: ${receipt.task}\n- 대상 revision: ${receipt.target.revision}\n- 변경:\n- 검증:\n- 남음:\n- next_start_here:\n`;
  const verifier = `import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import{readFile}from'node:fs/promises';import{dirname,join}from'node:path';import{fileURLToPath}from'node:url';const root=dirname(fileURLToPath(import.meta.url)),projectRoot=dirname(root);const m=JSON.parse(await readFile(join(root,'kit.json'),'utf8'));const bad=[];for(const f of m.files){const b=await readFile(join(root,f.path),'utf8');if(createHash('sha256').update(b).digest('hex')!==f.sha256)bad.push(f.path)}let actualRevision=null,revisionStatus='UNAVAILABLE';try{actualRevision=execFileSync('git',['-C',projectRoot,'rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();revisionStatus=m.target?.revision===actualRevision?'MATCH':'MISMATCH'}catch{}const failed=bad.length>0||revisionStatus!=='MATCH';console.log(JSON.stringify({schema:'ai-core-starter-kit-check/v2',status:failed?'FAIL':'PASS',core_revision:m.core_revision,changed:bad,revision:{expected:m.target?.revision??null,actual:actualRevision,status:revisionStatus}},null,2));if(failed)process.exitCode=1;\n`;
  const bootstrap = `import{spawnSync}from'node:child_process';
import{readFile}from'node:fs/promises';
import{dirname,resolve,join}from'node:path';
import{fileURLToPath}from'node:url';
const core=dirname(fileURLToPath(import.meta.url)),root=resolve(core,'..'),sync=process.argv.includes('--sync');
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
const coreFreshness=coreHead.ok?(coreHead.stdout===kit.core_revision?'CURRENT':'STALE'):'UNKNOWN';
const blockers=[];
if(!gitVersion.ok)blockers.push('GIT_UNAVAILABLE');
if(!remote.ok)blockers.push('GIT_REMOTE_UNAVAILABLE');
if(!ghVersion.ok)blockers.push('GH_CLI_UNAVAILABLE');else if(!ghAuth.ok)blockers.push('GH_AUTH_UNAVAILABLE');else if(expected&&ghUser.stdout!==expected)blockers.push('GH_IDENTITY_MISMATCH');
if(!repoAccess.ok)blockers.push('GITHUB_REPOSITORY_UNAVAILABLE');
if(dirty.ok&&dirty.stdout)blockers.push('DIRTY_WORKTREE_REVIEW_REQUIRED');
if(!remoteHead)blockers.push('REMOTE_BRANCH_HEAD_UNAVAILABLE');else if(projectFreshness!=='CURRENT')blockers.push(syncResult==='DIVERGED'?'LOCAL_BRANCH_DIVERGED':'LOCAL_BRANCH_NOT_CURRENT');
if(!coreHead.ok)blockers.push('AI_CORE_REMOTE_HEAD_UNAVAILABLE');else if(coreFreshness!=='CURRENT')blockers.push('AI_CORE_KIT_STALE');
if(syncResult==='FETCH_FAILED'||syncResult==='FAST_FORWARD_FAILED')blockers.push('SAFE_SYNC_FAILED');
const next=blockers.includes('AI_CORE_KIT_STALE')?'Refresh this project through the AI Core starter-kit distribution PR, then rerun bootstrap.':blockers.includes('LOCAL_BRANCH_NOT_CURRENT')?'If the worktree is clean and the branch should follow origin, rerun with --sync.':blockers.length?'Resolve only the listed blockers; preserve local work and continue safe read-only work where possible.':'Read project instructions and begin the user task directly.';
const out={schema:'ai-core-session-bootstrap/v2',status:blockers.length?'HOLD':'READY',mode:sync?'SYNC':'OBSERVE',project:{repository:repo,expected_baseline:kit.target?.revision??null,remote:remote.ok?remote.stdout:null,branch:branch.ok?branch.stdout:null,head:head.ok?head.stdout:null,remote_head:remoteHead,remote_freshness:projectFreshness,dirty:dirty.ok?Boolean(dirty.stdout):null,sync_result:syncResult},civilization:{core_repository:coreRepo,kit_revision:kit.core_revision,remote_head:coreHead.ok?coreHead.stdout:null,remote_freshness:coreFreshness,constitution:'standards/AI_WORKING_STANDARD.md',operating_knowledge:'OPERATING_KNOWLEDGE.json',catalog:'catalog/',handoff:'WORK_RESULT.md',evolution_inbox:'https://github.com/freepass-creator/ai-core/issues/211',verification:kit.verification},access:{node:nodeVersion.stdout,git:gitVersion.ok?gitVersion.stdout:null,github:{expected_identity:expected,actual_identity:ghUser.ok?ghUser.stdout:null,cli:ghVersion.ok?'AVAILABLE':'UNAVAILABLE',auth:ghAuth.ok?'READY':'UNAVAILABLE',repository:repoAccess.ok?'READY':'UNAVAILABLE'}},rules:{github_latest_required:true,fast_forward_only:true,reuse_first:true,preserve_dirty_work:true,no_secret_output:true,no_repeated_login:true},blockers,next_action:next};
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
