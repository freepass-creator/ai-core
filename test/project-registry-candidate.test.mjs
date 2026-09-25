import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectRegistryCandidate, aiCoreProjectRegistryCandidate } from '../src/engine/project-registry-candidate.mjs';

const capsule=(overrides={})=>({
  schema:'ai-core-project-capsule/v1',
  project_id:'sample-app',
  repository:'freepass-creator/sample-app',
  default_branch:'main',
  subject_revision:'a'.repeat(40),
  observed_at:'2026-09-20T00:00:00Z',
  classification:{kind:'NODE_APP',framework:'Next.js',package_manager:'npm'},
  commands:{install:'npm ci',test:'npm run test',build:'npm run build',start:'npm run dev',absent_reason:{}},
  delivery:{targets:['Vercel-candidate'],workflows:['.github/workflows/ci.yml']},
  instructions:['README.md'],
  data_evidence:[],
  readiness:{status:'READY_FOR_REGISTRY_REVIEW',blockers:[],review_required:true},
  evidence_refs:['GIT:freepass-creator/sample-app@'+'a'.repeat(40)],
  ...overrides,
});

const profile={
  name:'Sample App',
  organization:'SUBSIDIARY',
  mission:'A sample subsidiary application.',
  local_path:null,
  required_approvals:['production-deployment'],
  known_blockers:[],
};

test('candidate is HOLD/HOLD even when capsule requests active authority and execution',()=>{
  const result=buildProjectRegistryCandidate({capsule:capsule(),profile:{
    ...profile,
    requested_repository_lifecycle_status:'ACTIVE',
    requested_execution_readiness_status:'ACTIVE'
  }});
  assert.equal(result.candidate.repository_lifecycle_status,'HOLD');
  assert.equal(result.candidate.execution_readiness_status,'HOLD');
  assert.equal(result.review.activation_allowed,false);
  assert.equal(result.review.requested_repository_lifecycle_status,'ACTIVE');
  assert.equal(result.review.requested_execution_readiness_status,'ACTIVE');
  assert.ok(result.candidate.known_blockers.includes('REGISTRY_REVIEW_REQUIRED'));
});

test('capsule technical facts are reused while human-owned profile remains explicit',()=>{
  const result=buildProjectRegistryCandidate({capsule:capsule(),profile});
  assert.equal(result.candidate.head_revision,'a'.repeat(40));
  assert.deepEqual(result.candidate.commands,{install:'npm ci',test:'npm run test',build:'npm run build'});
  assert.deepEqual(result.candidate.deploy_targets,['Vercel-candidate']);
  assert.equal(result.candidate.mission,profile.mission);
  assert.equal(result.candidate.organization,'SUBSIDIARY');
});

test('profile cannot silently redirect capsule identity or repository',()=>{
  assert.throws(()=>buildProjectRegistryCandidate({capsule:capsule(),profile:{...profile,project_id:'other-app'}}),/PROJECT_ID_PROFILE_MISMATCH/);
  assert.throws(()=>buildProjectRegistryCandidate({capsule:capsule(),profile:{...profile,repository:'freepass-creator/other'}}),/PROJECT_REPOSITORY_PROFILE_MISMATCH/);
});

test('HOLD capsule remains a HOLD adapter result and preserves blockers',async()=>{
  const result=await aiCoreProjectRegistryCandidate({
    capsule:capsule({readiness:{status:'HOLD',blockers:['README_UNREAD'],review_required:true}}),
    profile,
  });
  assert.equal(result.status,'HOLD');
  assert.ok(result.data.candidate.known_blockers.includes('CAPSULE:README_UNREAD'));
  assert.deepEqual(result.blockers,['PROJECT_CAPSULE_NOT_READY']);
});

test('existing project becomes UPDATE_REVIEW and preserves both existing axes',()=>{
  const result=buildProjectRegistryCandidate({
    capsule:capsule(),
    profile,
    existingProject:{
      project_id:'sample-app',
      repository:'freepass-creator/sample-app',
      repository_lifecycle_status:'ACTIVE',
      execution_readiness_status:'HOLD',
      head_revision:'b'.repeat(40)
    },
  });
  assert.equal(result.change,'UPDATE_REVIEW');
  assert.equal(result.review.existing_repository_lifecycle_status,'ACTIVE');
  assert.equal(result.review.existing_execution_readiness_status,'HOLD');
  assert.equal(result.review.existing_revision,'b'.repeat(40));
  assert.equal(result.candidate.repository_lifecycle_status,'HOLD');
  assert.equal(result.candidate.execution_readiness_status,'HOLD');
});

test('existing project repository identity cannot be silently rebound',()=>{
  assert.throws(()=>buildProjectRegistryCandidate({
    capsule:capsule(),
    profile,
    existingProject:{
      project_id:'sample-app',
      repository:'freepass-creator/other-app',
      repository_lifecycle_status:'ACTIVE',
      execution_readiness_status:'HOLD',
      head_revision:'b'.repeat(40)
    },
  }),/EXISTING_PROJECT_REPOSITORY_MISMATCH/);
});
