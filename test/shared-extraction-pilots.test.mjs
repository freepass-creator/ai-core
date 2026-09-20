import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileSharedExtractionCandidate } from '../src/engine/shared-extraction-candidate.mjs';

async function load(path){
  return JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
}

test('real ERP4 vs Welrix KRW pilot remains HOLD for semantic and negative-value behavior differences',async()=>{
  const input=await load('docs/audits/shared-extraction-krw-pilot-2026-09-20.json');
  const result=compileSharedExtractionCandidate(input);
  assert.equal(result.assessment.status,'HOLD');
  assert.deepEqual(result.assessment.blockers,[
    'BEHAVIOR_MISMATCH:negative-one',
    'CONTRACT_MISMATCH:input_domain',
    'CONTRACT_MISMATCH:invalid_policy',
    'CONTRACT_MISMATCH:negative_policy',
  ]);
  assert.equal(result.assessment.extraction_allowed,false);
});

test('real ERP4 vs AIOps colL pilot reaches extraction review with no authority transfer',async()=>{
  const input=await load('docs/audits/shared-extraction-sheet-column-pilot-2026-09-20.json');
  const expected=await load('docs/audits/shared-extraction-sheet-column-pilot-2026-09-20.result.json');
  const result=compileSharedExtractionCandidate(input);
  assert.equal(result.assessment.status,'READY_FOR_EXTRACTION_REVIEW');
  assert.deepEqual(result.assessment.blockers,[]);
  assert.equal(result.assessment.semantic_contract_equal,true);
  assert.equal(result.assessment.behavior_equal,true);
  assert.equal(result.assessment.evidence_complete,true);
  assert.equal(result.assessment.extraction_allowed,false);
  assert.equal(result.assessment.package_promotion_allowed,false);
  assert.equal(result.assessment.source_authority_transfer,false);
  assert.deepEqual(result,expected);
});
