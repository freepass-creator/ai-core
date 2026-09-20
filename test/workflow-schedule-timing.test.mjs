import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assessScheduleTiming } from '../src/workflow/schedule-timing.mjs';
import { validateScheduleTimingPolicies } from '../scripts/validate-workflow-schedule-timing-policies.mjs';

const registry=JSON.parse(await readFile(new URL('../registry/workflow-schedule-timing-policies.json',import.meta.url),'utf8'));

test('current registry is PROPOSED with no invented company thresholds',async()=>{
  const result=await validateScheduleTimingPolicies(registry);
  assert.equal(result.status,'VALID',JSON.stringify(result.errors));
  const policy=registry.policies[0];
  assert.equal(policy.status,'PROPOSED');
  assert.equal(policy.evidence_level,'FAILURE_RUNTIME_EVIDENCE');
  assert.equal(policy.late_after_ms,null);
  assert.equal(policy.missed_after_ms,null);
  assert.equal(policy.observation_contract.status,'PENDING');
});

test('observed dispatch is on-time or late based on the supplied policy threshold',()=>{
  const onTime=assessScheduleTiming({
    expected_at:'2026-09-20T09:00:00+09:00',dispatch_at:'2026-09-20T09:04:00+09:00',assessed_at:'2026-09-20T09:04:30+09:00',
    late_after_ms:5*60*1000,missed_after_ms:30*60*1000
  });
  assert.equal(onTime.classification,'ON_TIME');
  const late=assessScheduleTiming({
    expected_at:'2026-09-20T09:00:00+09:00',dispatch_at:'2026-09-20T09:07:00+09:00',assessed_at:'2026-09-20T09:07:30+09:00',
    late_after_ms:5*60*1000,missed_after_ms:30*60*1000
  });
  assert.equal(late.classification,'LATE');
});

test('absence of dispatch remains UNKNOWN until the explicit miss threshold',()=>{
  const pending=assessScheduleTiming({
    expected_at:'2026-09-20T09:00:00+09:00',dispatch_at:null,assessed_at:'2026-09-20T09:20:00+09:00',
    late_after_ms:5*60*1000,missed_after_ms:30*60*1000
  });
  assert.equal(pending.classification,'UNKNOWN');
  const missed=assessScheduleTiming({
    expected_at:'2026-09-20T09:00:00+09:00',dispatch_at:null,assessed_at:'2026-09-20T09:30:00+09:00',
    late_after_ms:5*60*1000,missed_after_ms:30*60*1000
  });
  assert.equal(missed.classification,'MISSED');
});

test('policy thresholds cannot be silently inverted',()=>{
  assert.throws(()=>assessScheduleTiming({
    expected_at:'2026-09-20T09:00:00+09:00',dispatch_at:null,assessed_at:'2026-09-20T09:10:00+09:00',
    late_after_ms:30*60*1000,missed_after_ms:5*60*1000
  }),/MISSED_THRESHOLD_BEFORE_LATE_THRESHOLD/);
});
