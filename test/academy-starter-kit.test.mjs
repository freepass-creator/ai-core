import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installAcademyStarterKit } from '../src/academy/starter-kit.mjs';

const receipt={status:'READY',observed_at:'2026-09-22T00:00:00Z',task:'기능 구현',track:'development',target:{repository:'o/r',revision:'a'.repeat(40)},precheck:{completion_verification:{test:'npm test'}}};
const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();

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

test('starter kit bootstrap trusts verifier PASS across kit-only advance and holds on project revision mismatch',async()=>{
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
  await installAcademyStarterKit({output:out,receipt:boundReceipt,coreRevision:'b'.repeat(40),readings:[{path:'docs/AI_WORKING_STANDARD.md',body:'one'}],operatingKnowledge:{schema_version:'1.0',confirmed_decisions:[],methods:[],platforms:[]}});
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

  const installedVerifier=await readFile(verifier,'utf8');
  await writeFile(verifier,`${installedVerifier}// authority mutation\n`);
  git(root,'add','.ai-core/verify-kit.mjs');
  git(root,'commit','-q','-m','mutate kit verifier');
  const verifierMutationRun=spawnSync(process.execPath,[bootstrapPath],{cwd:root,encoding:'utf8'});
  const verifierMutation=JSON.parse(verifierMutationRun.stdout);
  assert.equal(verifierMutation.status,'HOLD');
  assert.equal(verifierMutation.project.kit_authority.status,'MISMATCH');
  assert.equal(verifierMutation.project.kit_authority.anchor_commit,installed);
  assert.deepEqual(verifierMutation.project.kit_authority.changed,['verify-kit.mjs']);
  assert.equal(verifierMutation.project.kit_verification,null);
  assert.ok(verifierMutation.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'));
  assert.equal(verifierMutation.blockers.includes('STARTER_KIT_REVISION_MISMATCH'),false);

  git(root,'reset','--hard',installed);
  const manifestPath=join(out,'kit.json');
  const mutatedManifest=JSON.parse(await readFile(manifestPath,'utf8'));
  mutatedManifest.reuse_policy='mutated after install';
  await writeFile(manifestPath,`${JSON.stringify(mutatedManifest,null,2)}\n`);
  git(root,'add','.ai-core/kit.json');
  git(root,'commit','-q','-m','mutate kit manifest');
  const manifestMutationRun=spawnSync(process.execPath,[bootstrapPath],{cwd:root,encoding:'utf8'});
  const manifestMutation=JSON.parse(manifestMutationRun.stdout);
  assert.equal(manifestMutation.status,'HOLD');
  assert.equal(manifestMutation.project.kit_authority.status,'MISMATCH');
  assert.equal(manifestMutation.project.kit_authority.anchor_commit,installed);
  assert.deepEqual(manifestMutation.project.kit_authority.changed,['kit.json']);
  assert.equal(manifestMutation.project.kit_verification,null);
  assert.ok(manifestMutation.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'));
  assert.equal(manifestMutation.blockers.includes('STARTER_KIT_REVISION_MISMATCH'),false);

  git(root,'reset','--hard',installed);
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
  assert.equal(staleBootstrap.project.kit_verification.status,'FAIL');
  assert.equal(staleBootstrap.project.kit_verification.revision.status,'MISMATCH');
  assert.ok(staleBootstrap.blockers.includes('STARTER_KIT_REVISION_MISMATCH'));
  assert.equal(staleBootstrap.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'),false);
  assert.match(staleBootstrap.next_action,/exact project revision/);
});
