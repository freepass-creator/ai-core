import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCheckerManifest,summarizeQaResult,evaluateHealth,evaluateJobStatus } from '../src/qa/qa-policy.mjs';

test('required checker with proven negative control is ready within manifest',()=>{
  const out=evaluateCheckerManifest({
    schema_version:'qa-checker-manifest/v1',
    checkers:[{
      checker_id:'contract.provider',
      classification:'REQUIRED',
      command:'npm run check:provider',
      contract_ids:['provider/v1'],
      proof_level:'SYNTHETIC',
      negative_control:{required:true,status:'PROVEN',evidence_ref:'tests/known-bad/provider'},
      reason:'protect provider contract'
    }]
  });
  assert.equal(out.status,'READY_WITHIN_MANIFEST');
});

test('required checker cannot look green while required negative control is pending',()=>{
  const out=evaluateCheckerManifest({
    schema_version:'qa-checker-manifest/v1',
    checkers:[{
      checker_id:'security.rules',
      classification:'REQUIRED',
      command:'npm run check:rules',
      contract_ids:['security/rules/v1'],
      proof_level:'EMULATOR',
      negative_control:{required:true,status:'PENDING',evidence_ref:null},
      reason:'deny-path gate'
    }]
  });
  assert.equal(out.status,'HOLD');
  assert.equal(out.issues[0].code,'QA_NEGATIVE_CONTROL_NOT_PROVEN');
});

test('SKIP and UNKNOWN do not count as QA pass',()=>{
  const out=summarizeQaResult({
    schema_version:'qa-result/v1',
    subject_revision:'abc',
    environment:'CI',
    suite:'contracts',
    proof_level:'SYNTHETIC',
    target:null,
    started_at:'2026-09-20T00:00:00Z',
    ended_at:'2026-09-20T00:01:00Z',
    checks:[
      {checker_id:'a',status:'PASS',detail:'ok',evidence_refs:[]},
      {checker_id:'b',status:'SKIP',detail:'secret unavailable',evidence_refs:[]}
    ],
    evidence_refs:[],
    limitations:['production not observed']
  });
  assert.equal(out.status,'HOLD');
  assert.equal(out.production_proven,false);
});

test('production proof requires observed target revision to equal subject revision',()=>{
  assert.throws(()=>summarizeQaResult({
    schema_version:'qa-result/v1',
    subject_revision:'expected',
    environment:'PRODUCTION',
    suite:'release',
    proof_level:'PRODUCTION',
    target:{target_id:'https://example.invalid',observed_revision:'old'},
    started_at:'2026-09-20T00:00:00Z',
    ended_at:'2026-09-20T00:01:00Z',
    checks:[{checker_id:'version',status:'PASS',detail:'reachable',evidence_refs:[]}],
    evidence_refs:[],
    limitations:[]
  }),/QA_PRODUCTION_REVISION_MISMATCH/);
});

test('freshness becomes degraded when source observation is older than threshold',()=>{
  const out=evaluateHealth({
    schema_version:'observability-health/v1',
    service_id:'erp',
    environment:'production',
    checked_at:'2026-09-20T02:00:00Z',
    subject_revision:'abc',
    status:'OK',
    checks:[{
      name:'catalog',
      kind:'FRESHNESS',
      status:'OK',
      observed_at:'2026-09-20T00:00:00Z',
      stale_after_seconds:3600,
      source_revision:'source-1',
      detail:'last source snapshot',
      evidence_refs:[]
    }]
  },{now:Date.parse('2026-09-20T02:00:00Z')});
  assert.equal(out.status,'DEGRADED');
  assert.equal(out.issues[0].code,'OBSERVABILITY_SOURCE_STALE');
});

test('job cannot claim success without terminal evidence and run revision',()=>{
  const out=evaluateJobStatus({
    schema_version:'observability-job-status/v1',
    job_id:'penalty-nightly',
    environment:'windows-task-scheduler',
    subject_revision:'abc',
    schedule_state:'ENABLED',
    last_started_at:'2026-09-20T00:00:00Z',
    last_completed_at:'2026-09-20T00:02:00Z',
    last_success_at:'2026-09-20T00:02:00Z',
    next_due_at:'2026-09-21T00:00:00Z',
    last_result:'SUCCEEDED',
    heartbeat_at:'2026-09-20T00:02:00Z',
    lease_owner:null,
    run_revision:null,
    checkpoint_ref:null,
    terminal_evidence_ref:null
  });
  assert.equal(out.status,'HOLD');
  assert.ok(out.issues.includes('JOB_SUCCESS_WITHOUT_TERMINAL_EVIDENCE'));
  assert.ok(out.issues.includes('JOB_SUCCESS_WITHOUT_RUN_REVISION'));
});
