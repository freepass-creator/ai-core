import test from 'node:test';
import assert from 'node:assert/strict';
import { parseACompletionEvidenceRef, validateACompletionEvidence, verifyACompletionEvidenceRemote } from '../scripts/a-session-evidence-contract.mjs';

const claim={
  repository:'freepass-creator/freepass-sales',
  subject_revision:'2ec46bb2e88b10a31915b68ec77b2eecbdac57bd',
  scope:'repo-rescan',
  evidence_contract:'v2'
};

test('parses revision-bound subject and commit refs',()=>{
  assert.deepEqual(parseACompletionEvidenceRef('subject:freepass-creator/freepass-sales@2ec46bb2e88b10a31915b68ec77b2eecbdac57bd'),{
    valid:true,kind:'subject',repository:'freepass-creator/freepass-sales',sha:'2ec46bb2e88b10a31915b68ec77b2eecbdac57bd',
    canonical:'subject:freepass-creator/freepass-sales@2ec46bb2e88b10a31915b68ec77b2eecbdac57bd'
  });
  assert.equal(parseACompletionEvidenceRef('commit:abc').valid,false);
});

test('parses CI proof with repo run and exact head sha',()=>{
  const ref='ci:freepass-creator/freepass-sales#35480676884@2ec46bb2e88b10a31915b68ec77b2eecbdac57bd';
  const parsed=parseACompletionEvidenceRef(ref);
  assert.equal(parsed.valid,true);
  assert.equal(parsed.kind,'ci');
  assert.equal(parsed.run_id,35480676884);
});

test('guarded v2 completion requires exact subject ref and verifiable proof',()=>{
  const good=[
    'subject:freepass-creator/freepass-sales@2ec46bb2e88b10a31915b68ec77b2eecbdac57bd',
    'commit:freepass-creator/ai-core@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  ];
  assert.equal(validateACompletionEvidence(claim,good,{requiresHeadGuard:true}).status,'VALID');
  const missingSubject=validateACompletionEvidence(claim,[good[1]],{requiresHeadGuard:true});
  assert.ok(missingSubject.errors.includes('SUBJECT_EVIDENCE_REQUIRED'));
  const noProof=validateACompletionEvidence(claim,[good[0]],{requiresHeadGuard:true});
  assert.ok(noProof.errors.includes('VERIFIABLE_PROOF_REQUIRED'));
});

test('coordination v2 completion needs proof but no subject ref',()=>{
  const coordination={...claim,scope:'coordination:docs'};
  const refs=['commit:freepass-creator/ai-core@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'];
  assert.equal(validateACompletionEvidence(coordination,refs,{requiresHeadGuard:false}).status,'VALID');
});

test('remote verifier rejects missing commit and non-successful CI',async()=>{
  const refs=[
    parseACompletionEvidenceRef('commit:freepass-creator/ai-core@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    parseACompletionEvidenceRef('ci:freepass-creator/freepass-sales#123@2ec46bb2e88b10a31915b68ec77b2eecbdac57bd')
  ];
  const result=await verifyACompletionEvidenceRemote(refs,{
    commitExists:async()=>false,
    workflowRun:async()=>({head_sha:'2ec46bb2e88b10a31915b68ec77b2eecbdac57bd',conclusion:'failure'})
  });
  assert.equal(result.status,'INVALID');
  assert.ok(result.failures.some(x=>x.code==='COMMIT_NOT_FOUND'));
  assert.ok(result.failures.some(x=>x.code==='CI_NOT_SUCCESSFUL'));
});

test('remote verifier accepts existing commit and successful exact-head CI',async()=>{
  const refs=[
    parseACompletionEvidenceRef('commit:freepass-creator/ai-core@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    parseACompletionEvidenceRef('ci:freepass-creator/freepass-sales#123@2ec46bb2e88b10a31915b68ec77b2eecbdac57bd')
  ];
  const result=await verifyACompletionEvidenceRemote(refs,{
    commitExists:async()=>true,
    workflowRun:async()=>({head_sha:'2ec46bb2e88b10a31915b68ec77b2eecbdac57bd',conclusion:'success'})
  });
  assert.equal(result.status,'VALID');
});
