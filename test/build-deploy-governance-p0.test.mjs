import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateReleaseProof,evaluateProjectObservation,evaluateException,
  evaluateRepositoryLifecycle,assertDeprecationTransition
} from '../src/governance/governance-policy.mjs';

function release(overrides={}){
  return {
    schema_version:'governance-release-proof/v1',
    project_id:'erp',
    environment:'PRODUCTION',
    expected_revision:'abc',
    build_status:'PASS',
    deployment:{status:'READY',deployment_id:'dpl-1',deployment_url:'https://deploy.example'},
    production_observation:{reachable:true,target_urls:['https://prod.example'],observed_revision:'abc'},
    runtime_smoke:{status:'PASS',evidence_refs:['smoke:1']},
    rollback:{available:true,plan_ref:'docs/rollback.md',previous_revision:'prev'},
    result:'VERIFIED',
    observed_at:'2026-09-20T00:00:00Z',
    limitations:[],
    ...overrides
  };
}

test('release is VERIFIED only when production revision and rollback evidence are present',()=>{
  const out=evaluateReleaseProof(release());
  assert.equal(out.result,'VERIFIED');
  assert.equal(out.consistent,true);
});

test('deployment READY with stale production revision is HOLD, not verified',()=>{
  const proof=release({
    production_observation:{reachable:true,target_urls:['https://prod.example'],observed_revision:'old'},
    result:'HOLD'
  });
  const out=evaluateReleaseProof(proof);
  assert.equal(out.result,'HOLD');
  assert.ok(out.failures.includes('PRODUCTION_REVISION_MISMATCH'));
});

test('release without rollback readiness cannot be verified',()=>{
  const proof=release({
    rollback:{available:false,plan_ref:null,previous_revision:null},
    result:'HOLD'
  });
  const out=evaluateReleaseProof(proof);
  assert.equal(out.result,'HOLD');
  assert.ok(out.failures.includes('ROLLBACK_NOT_READY'));
});

test('UNKNOWN repository observation is not interpreted as no activity',()=>{
  const out=evaluateProjectObservation({
    schema_version:'governance-project-observation/v1',
    project_id:'x',repository:'owner/x',default_branch:'main',
    status:'UNKNOWN',observed_at:'2026-09-20T00:00:00Z',
    head_revision:null,covered_from:null,source:'GITHUB',failure_reason:'API_UNAVAILABLE'
  });
  assert.equal(out.status,'UNKNOWN');
  assert.equal(out.fresh,false);
});

test('old observation becomes STALE',()=>{
  const out=evaluateProjectObservation({
    schema_version:'governance-project-observation/v1',
    project_id:'x',repository:'owner/x',default_branch:'main',
    status:'OBSERVED',observed_at:'2026-09-18T00:00:00Z',
    head_revision:'a'.repeat(40),covered_from:'2026-09-18T00:00:00Z',source:'GITHUB',failure_reason:null
  },{maxAgeSeconds:3600,now:Date.parse('2026-09-20T00:00:00Z')});
  assert.equal(out.status,'STALE');
});

test('expired governance exception stops being active automatically',()=>{
  const out=evaluateException({
    schema_version:'governance-exception/v1',
    exception_id:'ex-1',standard_rule:'branch.protection',project_id:'p',scope:'main',
    reason:'migration',risk:'MEDIUM',approved_by:'owner',
    created_at:'2026-09-19T00:00:00Z',expires_at:'2026-09-19T12:00:00Z',
    replacement_plan:'enable after CI stabilization',status:'ACTIVE'
  },{now:Date.parse('2026-09-20T00:00:00Z')});
  assert.equal(out.active,false);
  assert.equal(out.status,'EXPIRED');
});

test('REFERENCE repository requires declared reference purpose',()=>{
  const out=evaluateRepositoryLifecycle({
    schema_version:'governance-repository-lifecycle/v1',
    repository:'owner/legacy',status:'REFERENCE',authority:'owner/new',
    reference_purpose:null,retirement_gates:[],observed_at:'2026-09-20T00:00:00Z',evidence_refs:[]
  });
  assert.equal(out.status,'HOLD');
  assert.ok(out.issues.includes('REFERENCE_PURPOSE_REQUIRED'));
});

test('deprecation cannot skip lifecycle stages or move backward',()=>{
  assert.equal(assertDeprecationTransition('ACTIVE','DEPRECATED'),true);
  assert.throws(()=>assertDeprecationTransition('ACTIVE','RETIRED'),/GOVERNANCE_DEPRECATION_SKIP_FORBIDDEN/);
  assert.throws(()=>assertDeprecationTransition('RETIRED','READ_ONLY'),/GOVERNANCE_DEPRECATION_REVERSE_FORBIDDEN/);
});
