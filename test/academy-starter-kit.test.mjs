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

test('starter kit verifier and bootstrap fail closed after the project HEAD moves past its pinned revision',async()=>{
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
  assert.deepEqual(JSON.parse(current.stdout).revision,{expected:pinned,actual:pinned,status:'MATCH'});
  await writeFile(join(root,'tracked.txt'),'v2\n');
  git(root,'add','tracked.txt');
  git(root,'commit','-q','-m','advance');
  const advanced=git(root,'rev-parse','HEAD');
  const stale=spawnSync(process.execPath,[verifier],{cwd:root,encoding:'utf8'});
  assert.equal(stale.status,1);
  const result=JSON.parse(stale.stdout);
  assert.equal(result.status,'FAIL');
  assert.deepEqual(result.revision,{expected:pinned,actual:advanced,status:'MISMATCH'});

  const bootstrapRun=spawnSync(process.execPath,[join(out,'session-bootstrap.mjs')],{cwd:root,encoding:'utf8'});
  assert.equal(bootstrapRun.status,2,bootstrapRun.stderr||bootstrapRun.stdout);
  const bootstrap=JSON.parse(bootstrapRun.stdout);
  assert.equal(bootstrap.status,'HOLD');
  assert.equal(bootstrap.project.kit_verification.revision.status,'MISMATCH');
  assert.ok(bootstrap.blockers.includes('STARTER_KIT_REVISION_MISMATCH'));
  assert.match(bootstrap.next_action,/exact project revision/);
});
