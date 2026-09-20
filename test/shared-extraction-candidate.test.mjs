import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSharedExtractionCandidate, aiCoreSharedExtractionCandidate } from '../src/engine/shared-extraction-candidate.mjs';

const impl=(project,overrides={})=>({
  project_id:project,
  repository:`freepass-creator/${project}`,
  revision:'a'.repeat(40),
  source_ref:'lib/format.js',
  source_blob_sha:'b'.repeat(40),
  export_name:'krw',
  semantic_contract:{
    input_domain:'number-like',
    output:'ko-KR integer + 원',
    rounding:'nearest-won',
    negative_policy:'preserve',
    invalid_policy:'zero',
    side_effect:'none',
  },
  behavior_cases:[
    {case_id:'zero',input:0,output:'0원'},
    {case_id:'positive-decimal',input:1234.6,output:'1,235원'},
  ],
  evidence_refs:[`GIT:freepass-creator/${project}@${'a'.repeat(40)}`],
  ...overrides,
});

const input=(implementations)=>({
  candidate_id:'shared.krw-display.v1',
  capability_key:'display.krw',
  target_package:'devcenter/capabilities/shared/krw-display',
  implementations,
});

test('requires implementations from at least two distinct projects',()=>{
  assert.throws(()=>compileSharedExtractionCandidate(input([
    impl('one'),
    impl('one',{source_ref:'other.js',export_name:'other'}),
  ])),/SHARED_TWO_PROJECTS_REQUIRED/);
});

test('equal contracts and behavior become review-ready but never extraction-authorized',()=>{
  const c=compileSharedExtractionCandidate(input([impl('one'),impl('two')]));
  assert.equal(c.assessment.status,'READY_FOR_EXTRACTION_REVIEW');
  assert.equal(c.assessment.extraction_allowed,false);
  assert.equal(c.assessment.package_promotion_allowed,false);
  assert.equal(c.assessment.source_authority_transfer,false);
});

test('semantic contract mismatch is an explicit HOLD blocker',()=>{
  const c=compileSharedExtractionCandidate(input([
    impl('one'),
    impl('two',{semantic_contract:{...impl('two').semantic_contract,negative_policy:'clamp-zero'}}),
  ]));
  assert.equal(c.assessment.status,'HOLD');
  assert.ok(c.assessment.blockers.includes('CONTRACT_MISMATCH:negative_policy'));
});

test('behavior mismatch is detected on the same input case',()=>{
  const c=compileSharedExtractionCandidate(input([
    impl('one'),
    impl('two',{behavior_cases:[
      {case_id:'zero',input:0,output:'0원'},
      {case_id:'positive-decimal',input:1234.6,output:'1,234원'},
    ]}),
  ]));
  assert.ok(c.assessment.blockers.includes('BEHAVIOR_MISMATCH:positive-decimal'));
});

test('missing source evidence blocks extraction review readiness',()=>{
  const c=compileSharedExtractionCandidate(input([
    impl('one'),
    impl('two',{evidence_refs:[]}),
  ]));
  assert.ok(c.assessment.blockers.includes('EVIDENCE_MISSING:two'));
  assert.equal(c.assessment.status,'HOLD');
});

test('adapter result stays HOLD for mismatched candidate and has no external effect',async()=>{
  const result=await aiCoreSharedExtractionCandidate(input([
    impl('one'),
    impl('two',{semantic_contract:{...impl('two').semantic_contract,negative_policy:'clamp-zero'}}),
  ]));
  assert.equal(result.status,'HOLD');
  assert.equal(result.external_effect,false);
  assert.ok(result.blockers.includes('CONTRACT_MISMATCH:negative_policy'));
});
