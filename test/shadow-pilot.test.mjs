import test from 'node:test';
import assert from 'node:assert/strict';
import { compareOutcomes } from '../src/shadow-pilot.mjs';

const base={id:'base',metrics:{rework_count:2,repeated_context_count:3,context_items_loaded:20,work_execution_count:3,elapsed_seconds:100,first_pass_success:false}};

test('promotes only when observed costs improve without regression',()=>{
  const cand={id:'cand',evidence_complete:true,safety_regression:false,quality_regression:false,metrics:{rework_count:1,repeated_context_count:2,context_items_loaded:15,work_execution_count:2,elapsed_seconds:80,first_pass_success:true}};
  assert.equal(compareOutcomes({baseline:base,candidate:cand}).decision,'PROMOTION_CANDIDATE');
});

test('quality regression forces revert candidate',()=>{
  const cand={id:'cand',evidence_complete:true,quality_regression:true,metrics:{rework_count:0,repeated_context_count:0,context_items_loaded:1,work_execution_count:1,elapsed_seconds:10,first_pass_success:true}};
  assert.equal(compareOutcomes({baseline:base,candidate:cand}).decision,'REVERT_CANDIDATE');
});

test('incomplete evidence cannot promote',()=>{
  const cand={id:'cand',evidence_complete:false,metrics:{rework_count:1,repeated_context_count:2,context_items_loaded:15,work_execution_count:2,elapsed_seconds:80,first_pass_success:true}};
  assert.equal(compareOutcomes({baseline:base,candidate:cand}).decision,'HOLD');
});

test('mixed cost regressions hold instead of cherry-picking',()=>{
  const cand={id:'cand',evidence_complete:true,metrics:{rework_count:1,repeated_context_count:4,context_items_loaded:15,work_execution_count:2,elapsed_seconds:80,first_pass_success:true}};
  assert.equal(compareOutcomes({baseline:base,candidate:cand}).decision,'HOLD');
});
