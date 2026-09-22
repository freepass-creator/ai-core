import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installAcademyStarterKit } from '../src/academy/starter-kit.mjs';

const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const baseReceipt={
  status:'READY',
  observed_at:'2026-09-22T00:00:00Z',
  task:'기능 구현',
  track:'development',
  target:{repository:'o/r',revision:'0'.repeat(40)},
  precheck:{completion_verification:{test:'npm test'}},
};
const knowledge={schema_version:'1.0',confirmed_decisions:[],methods:[],platforms:[]};

test('starter kit bootstrap-only drift cannot promote itself to a new authority epoch',async()=>{
  const root=await mkdtemp(join(tmpdir(),'academy-kit-bootstrap-authority-'));
  git(root,'init','-q');
  git(root,'config','user.email','ai-core-test@example.invalid');
  git(root,'config','user.name','AI Core Test');
  await writeFile(join(root,'tracked.txt'),'v1\n');
  git(root,'add','tracked.txt');
  git(root,'commit','-q','-m','baseline');
  const pinned=git(root,'rev-parse','HEAD');
  const receipt={...baseReceipt,target:{...baseReceipt.target,revision:pinned}};
  const out=join(root,'.ai-core');

  await installAcademyStarterKit({
    output:out,
    receipt,
    coreRevision:'b'.repeat(40),
    readings:[{path:'docs/AI_WORKING_STANDARD.md',body:'one'}],
    operatingKnowledge:knowledge,
  });
  git(root,'add','.ai-core');
  git(root,'commit','-q','-m','install academy kit');

  const refreshRoot=await mkdtemp(join(tmpdir(),'academy-kit-bootstrap-refresh-'));
  const refreshOut=join(refreshRoot,'.ai-core');
  await installAcademyStarterKit({
    output:refreshOut,
    receipt,
    coreRevision:'c'.repeat(40),
    readings:[{path:'docs/AI_WORKING_STANDARD.md',body:'one'}],
    operatingKnowledge:knowledge,
  });
  for(const name of ['kit.json','session-bootstrap.mjs','verify-kit.mjs']){
    await writeFile(join(out,name),await readFile(join(refreshOut,name),'utf8'));
  }
  git(root,'add','.ai-core/kit.json','.ai-core/session-bootstrap.mjs','.ai-core/verify-kit.mjs');
  git(root,'commit','-q','-m','refresh academy kit');
  const refreshed=git(root,'rev-parse','HEAD');
  const bootstrapPath=join(out,'session-bootstrap.mjs');

  const refreshedRun=spawnSync(process.execPath,[bootstrapPath],{cwd:root,encoding:'utf8'});
  const refreshedResult=JSON.parse(refreshedRun.stdout);
  assert.equal(refreshedResult.project.kit_authority.status,'MATCH');
  assert.equal(refreshedResult.project.kit_authority.anchor_commit,refreshed);
  assert.deepEqual(refreshedResult.project.kit_authority.changed,[]);
  assert.equal(refreshedResult.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'),false);

  const bootstrap=await readFile(bootstrapPath,'utf8');
  await writeFile(bootstrapPath,`${bootstrap}// bootstrap-only authority mutation\n`);
  git(root,'add','.ai-core/session-bootstrap.mjs');
  git(root,'commit','-q','-m','mutate bootstrap only');
  const mutatedHead=git(root,'rev-parse','HEAD');
  assert.notEqual(mutatedHead,refreshed);

  const mutatedRun=spawnSync(process.execPath,[bootstrapPath],{cwd:root,encoding:'utf8'});
  assert.equal(mutatedRun.status,2,mutatedRun.stderr||mutatedRun.stdout);
  const mutated=JSON.parse(mutatedRun.stdout);
  assert.equal(mutated.status,'HOLD');
  assert.equal(mutated.project.kit_authority.status,'MISMATCH');
  assert.equal(mutated.project.kit_authority.anchor_commit,refreshed);
  assert.deepEqual(mutated.project.kit_authority.changed,['session-bootstrap.mjs']);
  assert.equal(mutated.project.kit_verification,null);
  assert.ok(mutated.blockers.includes('STARTER_KIT_VERIFICATION_FAILED'));
  assert.equal(mutated.blockers.includes('STARTER_KIT_REVISION_MISMATCH'),false);
});
