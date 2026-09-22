import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installAcademyStarterKit } from '../src/academy/starter-kit.mjs';

const receipt={status:'READY',observed_at:'2026-09-22T00:00:00Z',task:'기능 구현',track:'development',target:{repository:'o/r',revision:'a'.repeat(40)},precheck:{completion_verification:{test:'npm test'}}};
const knowledge={schema_version:'1.0',confirmed_decisions:[],methods:[],platforms:[]};

const run=(cwd,cmd,args=[])=>spawnSync(cmd,args,{cwd,encoding:'utf8'});
const git=(cwd,args=[])=>{
  const result=run(cwd,'git',args);
  assert.equal(result.status,0,result.stderr||result.stdout);
  return result.stdout.trim();
};

test('starter kit carries pinned standards, verification and result template',async()=>{
  const root=await mkdtemp(join(tmpdir(),'academy-kit-'));
  const result=await installAcademyStarterKit({output:join(root,'.ai-core'),receipt,coreRevision:'b'.repeat(40),readings:[{path:'docs/AI_WORKING_STANDARD.md',body:'constitution'}],operatingKnowledge:knowledge,catalog:[{name:'projects.json',source:'registry/projects.json',data:{projects:[{project_id:'one'}]}}]});
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
  assert.equal(bootstrap.project.kit_verification.revision.status,'UNAVAILABLE');
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

test('bootstrap reuses verifier and holds when project HEAD moves past the pinned kit revision',async()=>{
  const root=await mkdtemp(join(tmpdir(),'academy-kit-git-'));
  git(root,['init','-q']);
  git(root,['config','user.email','ai-core-test@example.com']);
  git(root,['config','user.name','AI Core Test']);
  await writeFile(join(root,'README.md'),'one\n');
  git(root,['add','README.md']);
  git(root,['commit','-qm','initial']);
  const baseline=git(root,['rev-parse','HEAD']);
  const pinnedReceipt={...receipt,target:{...receipt.target,revision:baseline}};
  await installAcademyStarterKit({output:join(root,'.ai-core'),receipt:pinnedReceipt,coreRevision:'b'.repeat(40),readings:[{path:'docs/AI_WORKING_STANDARD.md',body:'constitution'}],operatingKnowledge:knowledge});

  const before=spawnSync(process.execPath,[join(root,'.ai-core','verify-kit.mjs')],{encoding:'utf8'});
  assert.equal(before.status,0,before.stderr||before.stdout);
  assert.equal(JSON.parse(before.stdout).revision.status,'MATCH');

  await writeFile(join(root,'README.md'),'two\n');
  git(root,['add','README.md']);
  git(root,['commit','-qm','advance']);

  const after=spawnSync(process.execPath,[join(root,'.ai-core','verify-kit.mjs')],{encoding:'utf8'});
  assert.equal(after.status,1,after.stderr||after.stdout);
  const verification=JSON.parse(after.stdout);
  assert.equal(verification.status,'FAIL');
  assert.equal(verification.revision.expected,baseline);
  assert.equal(verification.revision.status,'MISMATCH');

  const bootstrapRun=spawnSync(process.execPath,[join(root,'.ai-core','session-bootstrap.mjs')],{encoding:'utf8'});
  assert.equal(bootstrapRun.status,2,bootstrapRun.stderr||bootstrapRun.stdout);
  const bootstrap=JSON.parse(bootstrapRun.stdout);
  assert.equal(bootstrap.project.kit_verification.revision.status,'MISMATCH');
  assert.ok(bootstrap.blockers.includes('STARTER_KIT_REVISION_MISMATCH'));
  assert.match(bootstrap.next_action,/exact project revision/);
});
