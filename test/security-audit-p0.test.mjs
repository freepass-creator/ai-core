import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateApprovalBundle } from '../src/security/approval-policy.mjs';

const registry=JSON.parse(await readFile(new URL('../registry/security-action-policies.candidate.json',import.meta.url),'utf8'));
const policy=id=>registry.policies.find(x=>x.policy_id===id);
const D=x=>'sha256:'+x.repeat(64);

function base(overrides={}) {
  return {
    schema_version:'security-approval-bundle/v1',
    approval_id:'appr-1',
    policy_id:'security.reversible-external',
    risk_class:'REVERSIBLE_EXTERNAL_MUTATION',
    subject:{
      subject_revision:'git:abc',
      plan_digest:D('a'),
      target_digest:D('b'),
      artifact_digest:D('c'),
      command_digest:D('d'),
      target_count:2,
    },
    requester_id:'user:owner',
    executor_id:'ai:codex',
    reviews:[{
      reviewer_id:'ai:claude',
      decision:'APPROVE',
      reason:'checked target and artifact',
      reviewed_at:'2026-09-20T00:00:00Z',
      expires_at:'2026-09-21T00:00:00Z',
    }],
    owner_approval:{
      approver_id:'user:owner',
      approved_at:'2026-09-20T00:01:00Z',
      expires_at:'2026-09-20T00:16:00Z',
    },
    emergency_approval:null,
    ...overrides,
  };
}

const now=Date.parse('2026-09-20T00:05:00Z');

test('exact-subject standard approval passes with independent review and owner approval',()=>{
  const bundle=base();
  const result=evaluateApprovalBundle({
    bundle,
    policy:policy(bundle.policy_id),
    expectedSubject:{plan_digest:D('a'),target_digest:D('b'),subject_revision:'git:abc',target_count:2},
    now,
  });
  assert.equal(result.allowed,true);
  assert.equal(result.path,'STANDARD');
});

test('changed plan digest invalidates an old approval bundle',()=>{
  const bundle=base();
  assert.throws(()=>evaluateApprovalBundle({
    bundle,policy:policy(bundle.policy_id),expectedSubject:{plan_digest:D('f')},now,
  }),/SECURITY_APPROVAL_PLAN_DIGEST_MISMATCH/);
});

test('executor self-review does not satisfy separation of duties',()=>{
  const bundle=base({reviews:[{
    reviewer_id:'ai:codex',decision:'APPROVE',reason:'self',reviewed_at:'2026-09-20T00:00:00Z',expires_at:'2026-09-21T00:00:00Z',
  }]});
  const result=evaluateApprovalBundle({bundle,policy:policy(bundle.policy_id),now});
  assert.equal(result.allowed,false);
  assert.equal(result.reason,'SECURITY_INDEPENDENT_REVIEW_REQUIRED');
});

test('any live BLOCK review vetoes standard execution',()=>{
  const bundle=base({reviews:[
    ...base().reviews,
    {reviewer_id:'ai:gemini',decision:'BLOCK',reason:'target mismatch',reviewed_at:'2026-09-20T00:00:00Z',expires_at:'2026-09-21T00:00:00Z'},
  ]});
  const result=evaluateApprovalBundle({bundle,policy:policy(bundle.policy_id),now});
  assert.equal(result.allowed,false);
  assert.equal(result.reason,'SECURITY_REVIEW_BLOCKED');
});

test('reversible external action supports short command-bound emergency path',()=>{
  const bundle=base({
    reviews:[],
    owner_approval:null,
    emergency_approval:{
      approver_id:'user:owner',
      reason:'time-sensitive reversible add',
      approved_at:'2026-09-20T00:00:00Z',
      expires_at:'2026-09-20T00:10:00Z',
    },
  });
  const result=evaluateApprovalBundle({bundle,policy:policy(bundle.policy_id),now});
  assert.equal(result.allowed,true);
  assert.equal(result.path,'EMERGENCY');
});

test('privileged mutation cannot be opened by emergency approval',()=>{
  const bundle=base({
    policy_id:'security.privileged-mutation',
    risk_class:'PRIVILEGED_MUTATION',
    reviews:[],
    owner_approval:null,
    emergency_approval:{
      approver_id:'user:owner',reason:'emergency',approved_at:'2026-09-20T00:00:00Z',expires_at:'2026-09-20T00:06:00Z',
    },
  });
  const result=evaluateApprovalBundle({bundle,policy:policy(bundle.policy_id),now});
  assert.equal(result.allowed,false);
  assert.equal(result.reason,'SECURITY_EMERGENCY_OVERRIDE_FORBIDDEN');
});
