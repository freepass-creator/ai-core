import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installAcademyStarterKit, kitFreshness, KIT_GENERATOR_INPUTS, branchFlowWarnings } from '../src/academy/starter-kit.mjs';

const receipt={status:'READY',observed_at:'2026-09-22T00:00:00Z',task:'기능 구현',track:'development',target:{repository:'o/r',revision:'a'.repeat(40)},precheck:{completion_verification:{test:'npm test'}}};
const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const sha256=body=>createHash('sha256').update(body).digest('hex');

test('starter kit carries pinned standards, verification and result template',async()=>{
  const root=await mkdtemp(join(tmpdir(),'academy-kit-'));
  const result=await installAcademyStarterKit({output:join(root,'.ai-core'),receipt,coreRevision:'b'.repeat(40),readings:[{path:'docs/AI_WORKING_STANDARD.md',body:'constitution'}],operatingKnowledge:{schema_version:'1.0',confirmed_decisions:[],methods:[]},catalog:[{name:'projects.json',source:'registry/projects.json',data:{projects:[{project_id:'one'}]}}]});
  const manifest=JSON.parse(await readFile(join(root,'.ai-core','kit.json'),'utf8'));
  assert.equal(result.status,'INSTALLED'); assert.equal(manifest.core_revision,'b'.repeat(40));
  assert.equal(await readFile(join(root,'.ai-core','standards','AI_WORKING_STANDARD.md'),'utf8'),'constitution');
  assert.match(await readFile(join(root,'.ai-core','WORK_RESULT.md'),'utf8'),/next_start_here/);
  assert.equal(JSON.parse(await readFile(join(root,'.ai-core','OPERATING_KNOWLEDGE.json'),'utf8')).schema_version,'1.0');
  assert.equal(JSON.parse(await readFile(join(root,'.ai-core','catalog','projects.json'),'utf8')).projects[0].project_id,'one');
  assert.equal(JSON.parse(await readFile(join(root,'.ai-core','CATALOG_INDEX.json'),'utf8')).items[0].core_revision,'b'.repeat(40));
  assert.match(await readFile(join(root,'.ai-core','START_HERE.md'),'utf8'),/session-bootstrap\.mjs/);
  assert.match(await readFile(join(root,'.ai-core','START_HERE.md'),'utf8'),new RegExp(`AI Core revision: ${'b'.repeat(40)}`));
  const bootstrapRun=spawnSync(process.execPath,[join(root,'.ai-core','session-bootstrap.mjs')],{encoding:'utf8',env:{...process.env,PATH:join(root,'missing-bin')}});
  const bootstrap=JSON.parse(bootstrapRun.stdout);
  assert.equal(bootstrap.schema,'ai-core-session-bootstrap/v2');
  assert.equal(bootstrap.mode,'OBSERVE');
  assert.equal(bootstrap.rules.github_latest_required,true);
  assert.equal(bootstrap.rules.fast_forward_only,true);
  assert.equal(bootstrap.project.remote_freshness,'UNKNOWN');
  assert.equal(bootstrap.civilization.remote_freshness,'UNKNOWN');
  assert.equal(bootstrap.status,'HOLD');
  assert.ok(bootstrap.blockers.includes('GIT_REMOTE_UNAVAILABLE'));
  assert.ok(bootstrap.blockers.includes('AI_CORE_REMOTE_HEAD_UNAVAILABLE'));
  assert.ok(bootstrap.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'));
  assert.match(await readFile(join(root,'.ai-core','START_HERE.md'),'utf8'),/--sync/);
});

test('starter kit never overwrites a conflicting local file',async()=>{
  const root=await mkdtemp(join(tmpdir(),'academy-kit-')), out=join(root,'.ai-core');
  await installAcademyStarterKit({output:out,receipt,coreRevision:'b'.repeat(40),readings:[{path:'docs/AI_WORKING_STANDARD.md',body:'one'}]});
  await writeFile(join(out,'standards','AI_WORKING_STANDARD.md'),'local change');
  await assert.rejects(()=>installAcademyStarterKit({output:out,receipt,coreRevision:'b'.repeat(40),readings:[{path:'docs/AI_WORKING_STANDARD.md',body:'one'}]}),/KIT_FILE_CONFLICT/);
});

test('starter kit bootstrap admits generated refresh but holds authority drift and project revision mismatch',async()=>{
  const root=await mkdtemp(join(tmpdir(),'academy-kit-git-'));
  git(root,'init','-q');
  git(root,'config','user.email','ai-core-test@example.invalid');
  git(root,'config','user.name','AI Core Test');
  await writeFile(join(root,'tracked.txt'),'v1\n');
  git(root,'add','tracked.txt');
  git(root,'commit','-q','-m','baseline');
  const pinned=git(root,'rev-parse','HEAD');
  const boundReceipt={...receipt,target:{...receipt.target,revision:pinned}};
  const out=join(root,'.ai-core');
  const knowledge={schema_version:'1.0',confirmed_decisions:[],methods:[],platforms:[]};
  await installAcademyStarterKit({output:out,receipt:boundReceipt,coreRevision:'b'.repeat(40),readings:[{path:'docs/AI_WORKING_STANDARD.md',body:'one'}],operatingKnowledge:knowledge});
  const verifier=join(out,'verify-kit.mjs');
  const current=spawnSync(process.execPath,[verifier],{cwd:root,encoding:'utf8'});
  assert.equal(current.status,0,current.stderr);
  assert.deepEqual(JSON.parse(current.stdout).revision,{expected:pinned,actual:pinned,status:'MATCH',advanced_paths:[]});

  git(root,'add','.ai-core');
  git(root,'commit','-q','-m','install academy kit');
  const installed=git(root,'rev-parse','HEAD');
  const committedKit=spawnSync(process.execPath,[verifier],{cwd:root,encoding:'utf8'});
  assert.equal(committedKit.status,0,committedKit.stderr);
  const committedResult=JSON.parse(committedKit.stdout);
  assert.equal(committedResult.status,'PASS');
  assert.equal(committedResult.revision.status,'KIT_ONLY_ADVANCE');
  assert.equal(committedResult.revision.actual,installed);
  assert.ok(committedResult.revision.advanced_paths.every(path=>path.startsWith('.ai-core/')));

  const bootstrapPath=join(out,'session-bootstrap.mjs');
  const committedBootstrapRun=spawnSync(process.execPath,[bootstrapPath],{cwd:root,encoding:'utf8'});
  const committedBootstrap=JSON.parse(committedBootstrapRun.stdout);
  assert.equal(committedBootstrap.project.kit_authority.status,'MATCH');
  assert.equal(committedBootstrap.project.kit_authority.anchor_commit,installed);
  assert.deepEqual(committedBootstrap.project.kit_authority.changed,[]);
  assert.equal(committedBootstrap.project.kit_verification.status,'PASS');
  assert.equal(committedBootstrap.project.kit_verification.revision.status,'KIT_ONLY_ADVANCE');
  assert.equal(committedBootstrap.blockers.includes('STARTER_KIT_REVISION_MISMATCH'),false);
  assert.equal(committedBootstrap.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'),false);

  const refreshRoot=await mkdtemp(join(tmpdir(),'academy-kit-refresh-'));
  const refreshOut=join(refreshRoot,'.ai-core');
  await installAcademyStarterKit({output:refreshOut,receipt:boundReceipt,coreRevision:'c'.repeat(40),readings:[{path:'docs/AI_WORKING_STANDARD.md',body:'one'}],operatingKnowledge:knowledge});
  for(const name of ['kit.json','session-bootstrap.mjs','verify-kit.mjs','START_HERE.md']){
    await writeFile(join(out,name),await readFile(join(refreshOut,name),'utf8'));
  }
  git(root,'add','.ai-core/kit.json','.ai-core/session-bootstrap.mjs','.ai-core/verify-kit.mjs','.ai-core/START_HERE.md');
  git(root,'commit','-q','-m','refresh academy kit');
  const refreshed=git(root,'rev-parse','HEAD');
  const refreshedBootstrapRun=spawnSync(process.execPath,[bootstrapPath],{cwd:root,encoding:'utf8'});
  const refreshedBootstrap=JSON.parse(refreshedBootstrapRun.stdout);
  assert.equal(refreshedBootstrap.project.kit_authority.status,'MATCH');
  assert.equal(refreshedBootstrap.project.kit_authority.anchor_commit,refreshed);
  assert.deepEqual(refreshedBootstrap.project.kit_authority.changed,[]);
  assert.equal(refreshedBootstrap.project.kit_verification.status,'PASS');
  assert.equal(refreshedBootstrap.project.kit_verification.core_revision,'c'.repeat(40));
  assert.equal(refreshedBootstrap.project.kit_verification.revision.status,'KIT_ONLY_ADVANCE');
  assert.equal(refreshedBootstrap.blockers.includes('STARTER_KIT_REVISION_MISMATCH'),false);
  assert.equal(refreshedBootstrap.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'),false);

  const refreshedVerifier=await readFile(verifier,'utf8');
  await writeFile(verifier,`${refreshedVerifier}// authority mutation\n`);
  git(root,'add','.ai-core/verify-kit.mjs');
  git(root,'commit','-q','-m','mutate kit verifier');
  const verifierMutationRun=spawnSync(process.execPath,[bootstrapPath],{cwd:root,encoding:'utf8'});
  const verifierMutation=JSON.parse(verifierMutationRun.stdout);
  assert.equal(verifierMutation.status,'HOLD');
  assert.equal(verifierMutation.project.kit_authority.status,'MISMATCH');
  assert.equal(verifierMutation.project.kit_authority.anchor_commit,refreshed);
  assert.deepEqual(verifierMutation.project.kit_authority.changed,['verify-kit.mjs']);
  assert.equal(verifierMutation.project.kit_verification,null);
  assert.ok(verifierMutation.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'));
  assert.equal(verifierMutation.blockers.includes('STARTER_KIT_REVISION_MISMATCH'),false);

  git(root,'reset','--hard',refreshed);
  const manifestPath=join(out,'kit.json');
  const mutatedManifest=JSON.parse(await readFile(manifestPath,'utf8'));
  mutatedManifest.reuse_policy='mutated after refresh';
  await writeFile(manifestPath,`${JSON.stringify(mutatedManifest,null,2)}\n`);
  git(root,'add','.ai-core/kit.json');
  git(root,'commit','-q','-m','mutate kit manifest');
  const manifestMutationRun=spawnSync(process.execPath,[bootstrapPath],{cwd:root,encoding:'utf8'});
  const manifestMutation=JSON.parse(manifestMutationRun.stdout);
  assert.equal(manifestMutation.status,'HOLD');
  assert.equal(manifestMutation.project.kit_authority.status,'MISMATCH');
  assert.equal(manifestMutation.project.kit_authority.anchor_commit,refreshed);
  assert.deepEqual(manifestMutation.project.kit_authority.changed,['kit.json']);
  assert.equal(manifestMutation.project.kit_verification,null);
  assert.ok(manifestMutation.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'));
  assert.equal(manifestMutation.blockers.includes('STARTER_KIT_REVISION_MISMATCH'),false);

  git(root,'reset','--hard',refreshed);
  const refreshedBootstrapSource=await readFile(bootstrapPath,'utf8');
  await writeFile(bootstrapPath,`${refreshedBootstrapSource}// bootstrap-only authority mutation\n`);
  git(root,'add','.ai-core/session-bootstrap.mjs');
  git(root,'commit','-q','-m','mutate bootstrap only');
  const bootstrapMutationRun=spawnSync(process.execPath,[bootstrapPath],{cwd:root,encoding:'utf8'});
  assert.equal(bootstrapMutationRun.status,2,bootstrapMutationRun.stderr||bootstrapMutationRun.stdout);
  const bootstrapMutation=JSON.parse(bootstrapMutationRun.stdout);
  assert.equal(bootstrapMutation.status,'HOLD');
  assert.equal(bootstrapMutation.project.kit_authority.status,'MISMATCH');
  assert.equal(bootstrapMutation.project.kit_authority.anchor_commit,refreshed);
  assert.deepEqual(bootstrapMutation.project.kit_authority.changed,['session-bootstrap.mjs']);
  assert.equal(bootstrapMutation.project.kit_verification,null);
  assert.ok(bootstrapMutation.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'));
  assert.equal(bootstrapMutation.blockers.includes('STARTER_KIT_REVISION_MISMATCH'),false);

  git(root,'reset','--hard',refreshed);
  const coordinatedBootstrapSource=await readFile(bootstrapPath,'utf8');
  const coordinatedBootstrap=`${coordinatedBootstrapSource}// coordinated bootstrap + manifest mutation\n`;
  await writeFile(bootstrapPath,coordinatedBootstrap);
  const coordinatedManifest=JSON.parse(await readFile(manifestPath,'utf8'));
  const bootstrapEntry=coordinatedManifest.files.find(file=>file.path==='session-bootstrap.mjs');
  assert.ok(bootstrapEntry);
  bootstrapEntry.sha256=sha256(coordinatedBootstrap);
  await writeFile(manifestPath,`${JSON.stringify(coordinatedManifest,null,2)}\n`);
  git(root,'add','.ai-core/session-bootstrap.mjs','.ai-core/kit.json');
  git(root,'commit','-q','-m','coordinate bootstrap and manifest mutation');
  const coordinatedMutationRun=spawnSync(process.execPath,[bootstrapPath],{cwd:root,encoding:'utf8'});
  assert.equal(coordinatedMutationRun.status,2,coordinatedMutationRun.stderr||coordinatedMutationRun.stdout);
  const coordinatedMutation=JSON.parse(coordinatedMutationRun.stdout);
  assert.equal(coordinatedMutation.status,'HOLD');
  assert.equal(coordinatedMutation.project.kit_authority.status,'MISMATCH');
  assert.equal(coordinatedMutation.project.kit_authority.anchor_commit,refreshed);
  assert.deepEqual(coordinatedMutation.project.kit_authority.changed,['kit.json','session-bootstrap.mjs']);
  assert.equal(coordinatedMutation.project.kit_verification,null);
  assert.ok(coordinatedMutation.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'));
  assert.equal(coordinatedMutation.blockers.includes('STARTER_KIT_REVISION_MISMATCH'),false);

  git(root,'reset','--hard',refreshed);
  const sameGenerationBootstrapSource=await readFile(bootstrapPath,'utf8');
  const sameGenerationBootstrap=`${sameGenerationBootstrapSource}// coordinated bootstrap + manifest + start mutation\n`;
  await writeFile(bootstrapPath,sameGenerationBootstrap);
  const sameGenerationManifest=JSON.parse(await readFile(manifestPath,'utf8'));
  const sameGenerationBootstrapEntry=sameGenerationManifest.files.find(file=>file.path==='session-bootstrap.mjs');
  assert.ok(sameGenerationBootstrapEntry);
  sameGenerationBootstrapEntry.sha256=sha256(sameGenerationBootstrap);
  await writeFile(manifestPath,`${JSON.stringify(sameGenerationManifest,null,2)}\n`);
  const startPath=join(out,'START_HERE.md');
  const refreshedStart=await readFile(startPath,'utf8');
  await writeFile(startPath,`${refreshedStart}\n<!-- coordinated same-generation marker mutation -->\n`);
  git(root,'add','.ai-core/session-bootstrap.mjs','.ai-core/kit.json','.ai-core/START_HERE.md');
  git(root,'commit','-q','-m','coordinate all mutable generation markers');
  const sameGenerationMutationRun=spawnSync(process.execPath,[bootstrapPath],{cwd:root,encoding:'utf8'});
  assert.equal(sameGenerationMutationRun.status,2,sameGenerationMutationRun.stderr||sameGenerationMutationRun.stdout);
  const sameGenerationMutation=JSON.parse(sameGenerationMutationRun.stdout);
  assert.equal(sameGenerationMutation.status,'HOLD');
  assert.equal(sameGenerationMutation.project.kit_authority.status,'MISMATCH');
  assert.equal(sameGenerationMutation.project.kit_authority.anchor_commit,refreshed);
  assert.deepEqual(sameGenerationMutation.project.kit_authority.changed,['kit.json','session-bootstrap.mjs','START_HERE.md']);
  assert.equal(sameGenerationMutation.project.kit_verification,null);
  assert.ok(sameGenerationMutation.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'));
  assert.equal(sameGenerationMutation.blockers.includes('STARTER_KIT_REVISION_MISMATCH'),false);

  git(root,'reset','--hard',refreshed);
  await writeFile(join(root,'tracked.txt'),'v2\n');
  git(root,'add','tracked.txt');
  git(root,'commit','-q','-m','advance project');
  const advanced=git(root,'rev-parse','HEAD');
  const stale=spawnSync(process.execPath,[verifier],{cwd:root,encoding:'utf8'});
  assert.equal(stale.status,1);
  const result=JSON.parse(stale.stdout);
  assert.equal(result.status,'FAIL');
  assert.equal(result.revision.expected,pinned);
  assert.equal(result.revision.actual,advanced);
  assert.equal(result.revision.status,'MISMATCH');
  assert.ok(result.revision.advanced_paths.includes('tracked.txt'));

  const staleBootstrapRun=spawnSync(process.execPath,[bootstrapPath],{cwd:root,encoding:'utf8'});
  assert.equal(staleBootstrapRun.status,2,staleBootstrapRun.stderr||staleBootstrapRun.stdout);
  const staleBootstrap=JSON.parse(staleBootstrapRun.stdout);
  assert.equal(staleBootstrap.status,'HOLD');
  assert.equal(staleBootstrap.project.kit_authority.status,'MATCH');
  assert.equal(staleBootstrap.project.kit_authority.anchor_commit,refreshed);
  assert.equal(staleBootstrap.project.kit_verification.status,'FAIL');
  assert.equal(staleBootstrap.project.kit_verification.revision.status,'MISMATCH');
  assert.ok(staleBootstrap.blockers.includes('STARTER_KIT_REVISION_MISMATCH'));
  assert.equal(staleBootstrap.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'),false);
  assert.match(staleBootstrap.next_action,/exact project revision/);
});

test('★kit integrity survives a Windows CRLF checkout but still catches a real edit',async()=>{
  /** 2026-09-29 실측: core.autocrlf=true 인 이 PC 에서 배포된 키트 20곳이 «아무것도 안 고쳤는데» 전부 verify-kit FAIL 이었다.
   *  늘 실패하는 무결성 검사는 경보가 아니라 소음이다. 줄끝만 다르면 PASS, 글이 바뀌면 FAIL 이어야 한다. */
  const root=await mkdtemp(join(tmpdir(),'academy-kit-crlf-'));
  git(root,'init','-q');
  git(root,'config','user.email','ai-core-test@example.invalid');
  git(root,'config','user.name','AI Core Test');
  await writeFile(join(root,'tracked.txt'),'v1\n');
  git(root,'add','tracked.txt');
  git(root,'commit','-q','-m','baseline');
  const bound={...receipt,target:{...receipt.target,revision:git(root,'rev-parse','HEAD')}};
  const out=join(root,'.ai-core'), std=join(out,'standards','AI_WORKING_STANDARD.md');
  const readings=[{path:'docs/AI_WORKING_STANDARD.md',body:'line one\nline two\n'}];
  const {manifest}=await installAcademyStarterKit({output:out,receipt:bound,coreRevision:'b'.repeat(40),readings});
  assert.equal(manifest.digest_rule,'sha256(utf8, CRLF→LF)');
  const verify=()=>JSON.parse(spawnSync(process.execPath,[join(out,'verify-kit.mjs')],{encoding:'utf8'}).stdout);

  await writeFile(std,'line one\r\nline two\r\n');
  const crlf=verify();
  assert.deepEqual(crlf.changed,[],'줄끝만 CRLF 로 바뀐 파일을 «고쳐졌다»고 찍었다');
  assert.equal(crlf.status,'PASS');
  await installAcademyStarterKit({output:out,receipt:bound,coreRevision:'b'.repeat(40),readings});

  await writeFile(std,'line one\r\nline TWO\r\n');
  const edited=verify();
  assert.deepEqual(edited.changed,['standards/AI_WORKING_STANDARD.md'],'글이 바뀌었는데 통과시켰다');
  assert.equal(edited.status,'FAIL');
});

test('★kit is stale only when its own inputs changed — not whenever ai-core main moves',()=>{
  /** 2026-09-30 실측: 옛 규칙(main head === kit.core_revision)은 341커밋 뒤 20곳을 전부 HOLD 로 만들었고,
   *  새로 깔아도 ai-core 에 아무 PR 이나 병합되면 다시 HOLD 였다. Codex 합의: 내용 기준, 의심스러우면 닫는다. */
  const base={kitRevision:'a'.repeat(40),coreHead:'b'.repeat(40),inputs:['docs/AI_WORKING_STANDARD.md','registry/operating-knowledge.json'],catalogInputs:['registry/projects.json']};
  const cmp=(files,status='ahead')=>({ok:true,status,files});
  assert.equal(kitFreshness({...base,coreHead:base.kitRevision}).status,'CURRENT');
  const unrelated=kitFreshness({...base,compare:cmp(['README.md','registry/projects.json'])});
  assert.equal(unrelated.status,'CURRENT_CONTENT','관계없는 파일만 바뀌었는데 낡았다고 했다 — 옛 병이 돌아왔다');
  assert.deepEqual(unrelated.catalog_changed,['registry/projects.json'],'catalog 변경은 막지 않되 알려야 한다');
  assert.deepEqual(kitFreshness({...base,compare:cmp(['docs/AI_WORKING_STANDARD.md'])}).changed,['docs/AI_WORKING_STANDARD.md']);
  assert.equal(kitFreshness({...base,compare:cmp(['docs/AI_WORKING_STANDARD.md'])}).status,'STALE');
  // 닫는 쪽 — Codex 반례: 갈라진 이력 · 잘린 비교 · 비교 실패 · 입력 목록 없는 옛 키트
  assert.equal(kitFreshness({...base,compare:cmp([],'diverged')}).status,'STALE');
  assert.equal(kitFreshness({...base,compare:cmp(Array.from({length:300},(_,i)=>'f'+i))}).reason,'COMPARE_TRUNCATED');
  assert.equal(kitFreshness({...base,compare:{ok:false}}).status,'UNKNOWN');
  assert.equal(kitFreshness({...base,compare:null}).status,'UNKNOWN');
  assert.equal(kitFreshness({...base,inputs:undefined,compare:cmp([])}).status,'STALE');
  assert.equal(kitFreshness({...base,coreHead:null}).status,'UNKNOWN');
});

test('★kit records its freshness inputs and the bootstrap embeds the tested judgement verbatim',async()=>{
  const root=await mkdtemp(join(tmpdir(),'academy-kit-fresh-')), out=join(root,'.ai-core');
  const {manifest}=await installAcademyStarterKit({output:out,receipt,coreRevision:'b'.repeat(40),readings:[{path:'docs/AI_WORKING_STANDARD.md',body:'one'}],operatingKnowledge:{schema_version:'1.0'},catalog:[{name:'projects.json',source:'registry/projects.json',data:{}}]});
  for(const p of ['docs/AI_WORKING_STANDARD.md','registry/operating-knowledge.json',...KIT_GENERATOR_INPUTS]) assert.ok(manifest.freshness_inputs.includes(p),`${p} 가 신선도 입력에서 빠졌다 — 바뀌어도 모른다`);
  assert.deepEqual(manifest.catalog_inputs,['registry/projects.json']);
  assert.ok(!manifest.freshness_inputs.includes('registry/projects.json'),'catalog 를 신선도에 넣으면 registry 가 매일 바뀌어 다시 늘 STALE 이 된다');
  const boot=await readFile(join(out,'session-bootstrap.mjs'),'utf8');
  assert.ok(boot.includes(kitFreshness.toString()),'bootstrap 에 박힌 판정이 테스트한 함수와 다르다');
  const parsed=spawnSync(process.execPath,['--check',join(out,'session-bootstrap.mjs')],{encoding:'utf8'});
  assert.equal(parsed.status,0,parsed.stderr);
});

test('★verification commands are compared field-wise — projects.json may change daily, commands must not change silently',()=>{
  /** Codex 검토(PR #346) 재현: projects.json 의 commands 가 바뀌어도 CURRENT_CONTENT 였다. */
  const base={kitRevision:'a'.repeat(40),coreHead:'b'.repeat(40),inputs:['docs/AI_WORKING_STANDARD.md'],catalogInputs:['registry/projects.json'],verificationSource:'registry/projects.json',
    verification:{test:'npm test',build:'npm run build'},compare:{ok:true,status:'ahead',files:['registry/projects.json']}};
  assert.equal(kitFreshness({...base,currentVerification:{build:'npm run build',test:'npm test'}}).status,'CURRENT_CONTENT','열쇠 순서만 다른 같은 명령을 바뀌었다고 했다');
  const moved=kitFreshness({...base,currentVerification:{test:'npm test -- --strict',build:'npm run build'}});
  assert.equal(moved.status,'STALE');
  assert.deepEqual(moved.changed,['registry/projects.json#commands']);
  assert.equal(kitFreshness({...base,currentVerification:undefined}).status,'UNKNOWN','못 읽은 것을 같다고 봤다');
  assert.equal(kitFreshness({...base,currentVerification:null}).status,'STALE','프로젝트가 등록부에서 사라졌는데 같다고 봤다');
  assert.equal(kitFreshness({...base,compare:{ok:true,status:'ahead',files:['README.md']},currentVerification:undefined}).status,'CURRENT_CONTENT','projects.json 이 안 바뀌었으면 읽을 필요가 없다');
});

test('★branch-flow warnings reuse the governance judge: stalled and actor-named branches warn, young/open-PR/default do not', async () => {
  /** 2026-09-30 대표: 「메인으로 붙어서 가는지도 봐야 함」. 제품 저장소 12곳에 흐르지 않는 가지 57개(48개 3일+). */
  const { 흐르나 } = await import('../src/governance/branch-flow.mjs');
  const policy = JSON.parse(await readFile(new URL('../registry/development-continuity-policy.json', import.meta.url), 'utf8'));
  const now = new Date('2026-09-30T00:00:00Z');
  const old = '2026-09-01T00:00:00Z', young = '2026-09-29T20:00:00Z';
  const r = branchFlowWarnings({ policy, defaultBranch: 'master', now, judge: 흐르나, branches: [
    { ref: 'work/x/stalled', 마지막커밋: old, 열린PR: null },
    { ref: 'work/x/young', 마지막커밋: young, 열린PR: null },
    { ref: 'work/x/in-review', 마지막커밋: old, 열린PR: 7 },
    { ref: 'master', 마지막커밋: old, 열린PR: null },
  ] });
  assert.deepEqual(r.violations.map((v) => v.ref), ['work/x/stalled']);
  assert.match(r.violations[0].why, /STALLED/);
  assert.equal(r.checked, 4);
  assert.deepEqual(branchFlowWarnings({ policy: null, branches: [], judge: 흐르나 }).violations, [], '정책 없는 옛 키트는 조용히 넘어간다');
  // ★Codex 검토: PR 을 못 읽었으면 STALLED 는 «모른다» — 확정 위반으로 올리지 않는다. actor 접두사는 PR 과 무관하게 위반
  const blind = branchFlowWarnings({ policy, defaultBranch: 'master', now, judge: 흐르나, prKnown: false, branches: [
    { ref: 'work/x/stalled', 마지막커밋: old, 열린PR: null }, { ref: 'codex/old', 마지막커밋: old, 열린PR: null } ] });
  assert.deepEqual(blind.unconfirmed, ['work/x/stalled']);
  assert.deepEqual(blind.violations.map((v) => v.ref), ['codex/old']);
});

test('★kit carries the branch-flow policy and the bootstrap embeds the same judge source', async () => {
  const { 흐르나 } = await import('../src/governance/branch-flow.mjs');
  const policy = JSON.parse(await readFile(new URL('../registry/development-continuity-policy.json', import.meta.url), 'utf8'));
  const root = await mkdtemp(join(tmpdir(), 'academy-kit-flow-')), out = join(root, '.ai-core');
  const { manifest } = await installAcademyStarterKit({ output: out, receipt, coreRevision: 'b'.repeat(40), readings: [{ path: 'docs/AI_WORKING_STANDARD.md', body: 'one' }], branchFlowPolicy: policy });
  assert.deepEqual(manifest.branch_flow_policy.flow_enforcement.flowing_when, policy.flow_enforcement.flowing_when);
  const withPid = await installAcademyStarterKit({ output: join(root, 'pid', '.ai-core'), receipt: { ...receipt, target: { ...receipt.target, project_id: 'demo' } }, coreRevision: 'b'.repeat(40), readings: [{ path: 'docs/AI_WORKING_STANDARD.md', body: 'one' }], branchFlowPolicy: policy });
  assert.ok(withPid.manifest.branch_flow_policy.flow_enforcement.exempt_prefixes.includes('work/demo/archive-'), '그 프로젝트의 보관 가지 접두사가 면제에 없다(Codex 검토)');
  assert.ok(!withPid.manifest.branch_flow_policy.flow_enforcement.exempt_prefixes.includes('archive-'), '범용 archive- 면제는 구멍이다');
  for (const p of ['registry/development-continuity-policy.json', 'src/governance/branch-flow.mjs']) assert.ok(manifest.freshness_inputs.includes(p), `${p} 가 신선도 입력에 없다 — 규칙이 바뀌어도 키트가 모른다`);
  const boot = await readFile(join(out, 'session-bootstrap.mjs'), 'utf8');
  assert.ok(boot.includes(흐르나.toString()), 'bootstrap 의 판정이 governance 판정과 다르다 — 판정기가 둘이 된다');
  assert.ok(boot.includes(branchFlowWarnings.toString()));
  const parsed = spawnSync(process.execPath, ['--check', join(out, 'session-bootstrap.mjs')], { encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr);
});

test('★end to end: a stalled remote branch shows up as a warning, not a blocker', async () => {
  const policy = JSON.parse(await readFile(new URL('../registry/development-continuity-policy.json', import.meta.url), 'utf8'));
  const base = await mkdtemp(join(tmpdir(), 'academy-kit-flow-e2e-'));
  const bare = join(base, 'origin.git'), root = join(base, 'work');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
  execFileSync('git', ['clone', '-q', bare, root]);
  git(root, 'config', 'user.email', 'ai-core-test@example.invalid'); git(root, 'config', 'user.name', 'AI Core Test');
  await writeFile(join(root, 'a.txt'), 'v1\n'); git(root, 'add', 'a.txt'); git(root, 'commit', '-q', '-m', 'base'); git(root, 'push', '-q', 'origin', 'main');
  git(root, 'remote', 'set-head', 'origin', 'main');
  const oldEnv = { ...process.env, GIT_COMMITTER_DATE: '2026-09-01T00:00:00Z', GIT_AUTHOR_DATE: '2026-09-01T00:00:00Z' };
  git(root, 'switch', '-q', '-c', 'work/x/stalled'); await writeFile(join(root, 'b.txt'), 'x\n'); git(root, 'add', 'b.txt');
  execFileSync('git', ['commit', '-q', '-m', 'old'], { cwd: root, env: oldEnv }); git(root, 'push', '-q', 'origin', 'work/x/stalled');
  git(root, 'switch', '-q', '-c', 'codex/old-actor'); execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'actor'], { cwd: root, env: oldEnv }); git(root, 'push', '-q', 'origin', 'codex/old-actor');
  git(root, 'switch', '-q', '-c', 'work/demo/archive-old'); execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'archived'], { cwd: root, env: oldEnv }); git(root, 'push', '-q', 'origin', 'work/demo/archive-old');
  git(root, 'switch', '-q', '-c', 'work/x/gone'); execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'gone'], { cwd: root, env: oldEnv }); git(root, 'push', '-q', 'origin', 'work/x/gone');
  git(root, 'switch', '-q', 'main');
  // 다른 곳에서: 원격의 work/x/gone 을 지우고, 새 가지를 올린다 — root 는 fetch 하지 않는다
  const other = join(base, 'other'); execFileSync('git', ['clone', '-q', bare, other]);
  git(other, 'config', 'user.email', 'ai-core-test@example.invalid'); git(other, 'config', 'user.name', 'AI Core Test');
  git(other, 'push', '-q', 'origin', '--delete', 'work/x/gone');
  git(other, 'switch', '-q', '-c', 'work/x/unfetched'); execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'new'], { cwd: other, env: oldEnv }); git(other, 'push', '-q', 'origin', 'work/x/unfetched');
  const bound = { ...receipt, target: { ...receipt.target, project_id: 'demo', revision: git(root, 'rev-parse', 'HEAD') } };
  await installAcademyStarterKit({ output: join(root, '.ai-core'), receipt: bound, coreRevision: 'b'.repeat(40), readings: [{ path: 'docs/AI_WORKING_STANDARD.md', body: 'one' }], operatingKnowledge: { schema_version: '1.0', platforms: [] }, branchFlowPolicy: policy });
  // gh 는 막되 PATH 는 그대로 둔다 — PATH 를 git 폴더 하나로 줄이면 Windows 에서 ls-remote 가 도우미를 못 찾아 죽는다(exit 139)
  const noGh = { ...process.env, GH_CONFIG_DIR: join(base, 'no-gh'), GH_TOKEN: '', GITHUB_TOKEN: '', GH_ENTERPRISE_TOKEN: '' };
  const run = spawnSync(process.execPath, [join(root, '.ai-core', 'session-bootstrap.mjs')], { cwd: root, encoding: 'utf8', env: noGh });
  const outp = JSON.parse(run.stdout);
  // gh 를 막았으므로 PR 을 모른다 → 멈춘 가지는 «확정 못 함», actor 접두사 가지는 PR 과 무관하게 위반
  assert.equal(outp.project.branch_flow.pr_known, false);
  assert.deepEqual(outp.project.branch_flow.unconfirmed, ['work/x/stalled']);
  assert.deepEqual(outp.project.branch_flow.violations.map((v) => v.ref), ['codex/old-actor']);
  assert.ok(outp.warnings.some((w) => w.startsWith('BRANCH_FLOW_PR_UNKNOWN')), 'PR 을 모르는데 조용했다');
  assert.ok(outp.warnings.some((w) => w.startsWith('BRANCH_NOT_FLOWING')), '멈춘 가지 경고가 없다');
  // ★Codex 검토: 로컬 캐시가 아니라 실제 원격을 본다 — 원격에서 지운 가지는 경고하지 않고, 안 받은 가지는 «모른다»로 알린다
  assert.ok(outp.warnings.some((w) => w.startsWith('BRANCH_FLOW_PARTIAL')), '로컬에 없는 원격 가지를 조용히 건너뛰었다');
  assert.equal(outp.project.branch_flow.unscanned, 1);
  // (이 임시 저장소엔 GitHub 가 없어 다른 차단은 선다 — 가지 흐름이 차단이 되지 않는지만 본다)
  assert.ok(!outp.blockers.some((b) => /FLOW|STALL/.test(b)), '멈춘 가지가 세션을 막았다 — 경고만 해야 한다: ' + outp.blockers.join(','));
});

test('★integrity fingerprint matches registry/academy-kit-compat.json — safety-relevant generator changes must bump compat_version', async () => {
  /** Codex 설계(2026-09-30): 생성기 변경을 영향으로 가른다. 검증기·해시 규칙·신선도·권한 판정이 바뀌면 이 테스트가 막는다 —
   *  compat_version 을 올리고 integrity_fingerprint 를 갱신하라(그러면 배포된 키트가 STALE 이 되어 다시 받는다). */
  const { kitIntegrityFingerprint } = await import('../src/academy/starter-kit.mjs');
  const compat = JSON.parse(await readFile(new URL('../registry/academy-kit-compat.json', import.meta.url), 'utf8'));
  assert.equal(kitIntegrityFingerprint(), compat.integrity_fingerprint, '키트의 안전 판정 코드가 바뀌었다 — registry/academy-kit-compat.json 의 compat_version 을 올리고 integrity_fingerprint 를 갱신하라');
  assert.ok(Number.isInteger(compat.compat_version) && compat.compat_version >= 2);
});

test('★advisory-only generator changes warn (UPDATE_AVAILABLE); blocking inputs still make the kit STALE; legacy kits keep blocking', () => {
  const base = { kitRevision: 'a'.repeat(40), coreHead: 'b'.repeat(40), inputs: ['docs/AI_WORKING_STANDARD.md', 'registry/academy-kit-compat.json'], advisoryInputs: ['src/academy/starter-kit.mjs', 'registry/development-continuity-policy.json'], catalogInputs: [] };
  const cmp = (files) => ({ ok: true, status: 'ahead', files });
  const adv = kitFreshness({ ...base, compare: cmp(['src/academy/starter-kit.mjs']) });
  assert.equal(adv.status, 'UPDATE_AVAILABLE');
  assert.deepEqual(adv.advisory_changed, ['src/academy/starter-kit.mjs']);
  assert.equal(kitFreshness({ ...base, compare: cmp(['registry/academy-kit-compat.json', 'src/academy/starter-kit.mjs']) }).status, 'STALE', '호환 버전이 오르면 막아야 한다');
  assert.equal(kitFreshness({ ...base, compare: cmp(['docs/AI_WORKING_STANDARD.md']) }).status, 'STALE');
  assert.equal(kitFreshness({ ...base, advisoryInputs: undefined, inputs: [...base.inputs, 'src/academy/starter-kit.mjs'], compare: cmp(['src/academy/starter-kit.mjs']) }).status, 'STALE', '옛 키트는 분류가 없으니 전부 차단(fail-closed)');
});

test('★kit splits blocking and advisory inputs and records compat_version', async () => {
  const compat = JSON.parse(await readFile(new URL('../registry/academy-kit-compat.json', import.meta.url), 'utf8'));
  const policy = JSON.parse(await readFile(new URL('../registry/development-continuity-policy.json', import.meta.url), 'utf8'));
  const root = await mkdtemp(join(tmpdir(), 'academy-kit-compat-')), out = join(root, '.ai-core');
  const { manifest } = await installAcademyStarterKit({ output: out, receipt, coreRevision: 'b'.repeat(40), readings: [{ path: 'docs/AI_WORKING_STANDARD.md', body: 'one' }], operatingKnowledge: { schema_version: '1.0' }, branchFlowPolicy: policy, compat });
  assert.equal(manifest.compat_version, compat.compat_version);
  assert.deepEqual(manifest.blocking_inputs, ['docs/AI_WORKING_STANDARD.md', 'registry/operating-knowledge.json', 'registry/academy-kit-compat.json']);
  for (const p of [...KIT_GENERATOR_INPUTS, 'registry/development-continuity-policy.json']) {
    assert.ok(manifest.advisory_inputs.includes(p), `${p} 가 권고 입력에 없다`);
    assert.ok(!manifest.blocking_inputs.includes(p), `${p} 가 차단 입력에 있다 — 기능만 붙어도 모든 키트가 막힌다`);
  }
  // ★통합(Codex): bootstrap 은 권한 판정을 kitAuthority 로만 한다 — 옛 인라인 판정이 남아 우회하지 못하게
  const { kitAuthority } = await import('../src/academy/starter-kit.mjs');
  const boot = await readFile(join(out, 'session-bootstrap.mjs'), 'utf8');
  assert.ok(boot.includes(kitAuthority.toString()), 'bootstrap 의 권한 판정이 지문에 든 kitAuthority 와 다르다');
  assert.ok(boot.includes('=kitAuthority({run,kit,generatedAuthority})'), 'bootstrap 이 kitAuthority 를 부르지 않는다');
  assert.ok(!boot.includes("const authorityPaths=['.ai-core/kit.json'"), '옛 인라인 권한 판정이 남아 있다 — 지문 밖에서 우회할 수 있다');
  const { kitFreshnessInputs, kitSafetyDecision } = await import('../src/academy/starter-kit.mjs');
  for (const f of [kitFreshnessInputs, kitSafetyDecision]) assert.ok(boot.includes(f.toString()), `bootstrap 의 ${f.name} 가 지문에 든 것과 다르다`);
  assert.ok(boot.includes('=kitFreshnessInputs(kit);') && boot.includes('=kitSafetyDecision({'), 'bootstrap 이 안전 배선 함수를 부르지 않는다');
  assert.ok(!boot.includes("else if(coreFreshness==='STALE')blockers.push"), '옛 인라인 차단 매핑이 남아 있다 — 지문 밖에서 바꿀 수 있다');
  assert.equal(spawnSync(process.execPath, ['--check', join(out, 'session-bootstrap.mjs')], { encoding: 'utf8' }).status, 0);
});

test('★safety wiring: input classes, legacy fallback, and blocker mapping (all fingerprinted)', async () => {
  const { kitInputClasses, kitFreshnessInputs, kitSafetyDecision } = await import('../src/academy/starter-kit.mjs');
  const c = kitInputClasses({ readingPaths: ['docs/A.md'], hasOperatingKnowledge: true, hasCompat: true, hasBranchFlowPolicy: true });
  assert.deepEqual(c.blocking, ['docs/A.md', 'registry/operating-knowledge.json', 'registry/academy-kit-compat.json']);
  for (const p of KIT_GENERATOR_INPUTS) assert.ok(c.advisory.includes(p) && !c.blocking.includes(p), `${p} 분류가 틀렸다`);
  assert.deepEqual(kitFreshnessInputs({ freshness_inputs: ['x'] }), { inputs: ['x'], advisoryInputs: undefined }, '옛 키트는 전부 차단 입력');
  const ok = { coreHeadOk: true, authorityStatus: 'MATCH', kitCheckOk: true, kitVerification: { status: 'PASS', revision: { status: 'MATCH' } } };
  assert.deepEqual(kitSafetyDecision({ ...ok, freshness: { status: 'CURRENT_CONTENT' } }), { blockers: [], warnings: [], kitReady: true });
  assert.deepEqual(kitSafetyDecision({ ...ok, freshness: { status: 'STALE' } }).blockers, ['AI_CORE_KIT_STALE']);
  const upd = kitSafetyDecision({ ...ok, freshness: { status: 'UPDATE_AVAILABLE', advisory_changed: ['src/academy/starter-kit.mjs'] } });
  assert.deepEqual(upd.blockers, []);
  assert.match(upd.warnings[0], /^AI_CORE_KIT_UPDATE_AVAILABLE/);
  assert.deepEqual(kitSafetyDecision({ ...ok, freshness: { status: 'UNKNOWN' } }).blockers, ['AI_CORE_KIT_FRESHNESS_UNKNOWN']);
  const noAuth = kitSafetyDecision({ ...ok, authorityStatus: 'MISMATCH', freshness: { status: 'CURRENT_CONTENT' } });
  assert.equal(noAuth.kitReady, false, '권한이 안 맞는데 검증 PASS 만으로 통과했다');
  assert.deepEqual(noAuth.blockers, ['STARTER_KIT_VERIFICATION_FAILED']);
});
