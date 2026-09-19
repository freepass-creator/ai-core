import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectCapsule } from '../src/engine/project-capsule.mjs';

const base={
  project_id:'freepass-admin',
  repository:'freepass-creator/freepass-admin',
  default_branch:'main',
  subject_revision:'a'.repeat(40),
  observed_at:'2026-09-19T03:40:00Z',
  tree_paths:['README.md','AGENTS.md','package.json','package-lock.json','src/index.ts','tsconfig.json'],
  package_json:{scripts:{test:'node --test',build:'tsc',dev:'vite'},devDependencies:{vite:'latest'}},
};

test('Node 프로젝트를 revision-bound capsule로 만든다',()=>{
  const c=buildProjectCapsule(base);
  assert.equal(c.schema,'ai-core-project-capsule/v1');
  assert.equal(c.classification.kind,'NODE_APP');
  assert.equal(c.classification.framework,'Vite');
  assert.equal(c.commands.install,'npm ci');
  assert.equal(c.commands.test,'npm run test');
  assert.equal(c.commands.build,'npm run build');
  assert.equal(c.readiness.status,'READY_FOR_REGISTRY_REVIEW');
  assert.equal(c.readiness.review_required,true);
  assert.ok(c.evidence_refs.includes(`GIT:${base.repository}@${base.subject_revision}`));
});

test('정적 홈페이지는 별도 build가 없어도 이유를 남기고 review 후보가 된다',()=>{
  const c=buildProjectCapsule({
    ...base,project_id:'freepass-homepage',repository:'freepass-creator/freepasshomepage',
    tree_paths:['README.md','index.html','css/app.css','js/app.js'],package_json:null,
  });
  assert.equal(c.classification.kind,'STATIC_WEB');
  assert.equal(c.commands.install,null);
  assert.equal(c.commands.build,null);
  assert.match(c.commands.absent_reason.build,/정적/);
  assert.equal(c.readiness.status,'READY_FOR_REGISTRY_REVIEW');
});

test('README와 실행 진입점이 없는 알 수 없는 저장소는 HOLD다',()=>{
  const c=buildProjectCapsule({...base,tree_paths:['random.bin'],package_json:null});
  assert.equal(c.readiness.status,'HOLD');
  assert.ok(c.readiness.blockers.includes('README_MISSING'));
  assert.ok(c.readiness.blockers.includes('PROJECT_KIND_UNKNOWN'));
});

test('배포/데이터는 존재 증거만 기록하고 SSOT라고 추정하지 않는다',()=>{
  const c=buildProjectCapsule({
    ...base,
    tree_paths:[...base.tree_paths,'vercel.json','firebase.json','.env.example','.github/workflows/ci.yml','lib/firestore.ts'],
    package_json:{...base.package_json,dependencies:{firebase:'1.0.0',next:'1.0.0'}},
  });
  assert.ok(c.delivery.targets.includes('Vercel-candidate'));
  assert.ok(c.delivery.targets.includes('Firebase-candidate'));
  assert.ok(c.data_evidence.includes('firebase-present'));
  assert.ok(c.data_evidence.includes('environment-contract-present'));
  assert.equal(JSON.stringify(c).includes('SSOT 확정'),false);
});
