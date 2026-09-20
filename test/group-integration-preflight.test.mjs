import test from 'node:test';
import assert from 'node:assert/strict';
import { sealIntegrationPreflight, buildIntegrationExecutionReceipt } from '../src/engine/group-integration-preflight.mjs';

const packet=(overrides={})=>({
  schema:'ai-core-integration-work-packet/v1',
  packet_id:'INT-WP-001-sales',
  plan_id:'AI-CORE-MERGE-P0',
  asset_id:'sales',
  project_id:'freepass-sales',
  repository:'freepass-creator/freepass-sales',
  expected_revision:'a'.repeat(40),
  classification:'KEEP_SEPARATE',
  action_kind:'METADATA_ONLY',
  current_path:'C:/dev/sales',
  planned_steps:['PIN_SOURCE_REVISION'],
  preconditions:{dirty_state:'CLEAN',reviewer_consensus:['CONSENSUS'],evidence_refs:['GIT:x'],required_approvals:[],approval_refs:[],unknowns_must_be_empty:true},
  authority:{required:true,status:'PENDING',execution_authorized:false,scope:['repository:freepass-creator/freepass-sales']},
  revalidation:{immediately_before_execution:true,required_checks:['SOURCE_REVISION_UNCHANGED','DIRTY_STATE_RECHECK','PLAN_ITEM_STILL_READY','PROJECT_AUTHORITY_UNCHANGED']},
  verification:{required:true,checks:['SOURCE_REVISION_UNCHANGED','DIRTY_STATE_RECHECK','PLAN_ITEM_STILL_READY','PROJECT_AUTHORITY_UNCHANGED'],evidence_must_bind_revision:true},
  rollback:{required:false,ready:true},
  forbidden_actions:['MERGE_GIT_HISTORY'],
  completion:{auto_complete:false,requires_verification_evidence:true,requires_work_ledger_result:true},
  ...overrides,
});

const observation=(overrides={})=>({
  repository:'freepass-creator/freepass-sales',
  revision:'a'.repeat(40),
  dirty_state:'CLEAN',
  observed_at:'2026-09-20T09:40:00Z',
  checks:[{name:'PROJECT_AUTHORITY_UNCHANGED',status:'PASS'}],
  ...overrides,
});

const execution=(overrides={})=>({
  status:'SUCCEEDED',
  attempt_id:'attempt-1',
  actor:'human-reviewed-worker',
  executor:'integration-runner',
  correlation_id:'corr-1',
  started_at:'2026-09-20T09:41:00Z',
  ended_at:'2026-09-20T09:42:00Z',
  performed:true,
  authorization_ref:'work-ledger:event-123',
  verification_results:[
    {name:'SOURCE_REVISION_UNCHANGED',status:'PASS',evidence_ref:'check:revision'},
    {name:'DIRTY_STATE_RECHECK',status:'PASS',evidence_ref:'check:dirty'},
    {name:'PLAN_ITEM_STILL_READY',status:'PASS',evidence_ref:'check:plan'},
    {name:'PROJECT_AUTHORITY_UNCHANGED',status:'PASS',evidence_ref:'check:authority'},
  ],
  evidence_refs:['commit:result'],
  output_refs:['artifact:result'],
  output_digest:'sha256:'+'b'.repeat(64),
  deterministic:true,
  executor_version:'integration-runner/v1',
  environment_revision:'env-1',
  command_ref:'packet-step-set/v1',
  ...overrides,
});

test('preflight seals exact revision and clean state without granting authority',()=>{
  const sealed=sealIntegrationPreflight({packet:packet(),observation:observation()});
  assert.equal(sealed.status,'SEALED');
  assert.match(sealed.seal_digest,/^sha256:[0-9a-f]{64}$/);
  assert.equal(sealed.execution_authorized,false);
  assert.match(sealed.note,/not a mutex/i);
});

test('preflight fails closed on revision drift or dirty worktree',()=>{
  assert.throws(()=>sealIntegrationPreflight({packet:packet(),observation:observation({revision:'c'.repeat(40)})}),/REVISION_STALE/);
  assert.throws(()=>sealIntegrationPreflight({packet:packet(),observation:observation({dirty_state:'DIRTY'})}),/WORKTREE_NOT_CLEAN/);
});

test('preflight requires classification-specific checks already demanded by packet',()=>{
  const p=packet({
    classification:'MERGE_PHYSICAL',
    revalidation:{immediately_before_execution:true,required_checks:['SOURCE_REVISION_UNCHANGED','DIRTY_STATE_RECHECK','PLAN_ITEM_STILL_READY','TARGET_PARITY_CHECK','ROLLBACK_PATH_VERIFIED']},
  });
  assert.throws(()=>sealIntegrationPreflight({packet:p,observation:observation({checks:[]})}),/TARGET_PARITY_CHECK/);
});

test('successful execution receipt reuses core-receipt/v1 and binds authority plus verification evidence',()=>{
  const p=packet();
  const sealed=sealIntegrationPreflight({packet:p,observation:observation()});
  const receipt=buildIntegrationExecutionReceipt({packet:p,preflight:sealed,execution:execution()});
  assert.equal(receipt.schema_version,'core-receipt/v1');
  assert.equal(receipt.source_revision,'a'.repeat(40));
  assert.equal(receipt.status,'SUCCEEDED');
  assert.ok(receipt.evidence_refs.includes('AUTHORITY:work-ledger:event-123'));
  assert.equal(receipt.metrics.performed,true);
});

test('performed execution cannot produce receipt without authority reference',()=>{
  const p=packet();
  const sealed=sealIntegrationPreflight({packet:p,observation:observation()});
  assert.throws(()=>buildIntegrationExecutionReceipt({packet:p,preflight:sealed,execution:execution({authorization_ref:null})}),/AUTHORITY_REF_REQUIRED/);
});

test('success cannot be claimed with missing or failed required verification',()=>{
  const p=packet();
  const sealed=sealIntegrationPreflight({packet:p,observation:observation()});
  assert.throws(()=>buildIntegrationExecutionReceipt({
    packet:p,preflight:sealed,execution:execution({verification_results:[{name:'SOURCE_REVISION_UNCHANGED',status:'PASS',evidence_ref:'check:revision'}]}),
  }),/VERIFICATION_MISSING/);
  assert.throws(()=>buildIntegrationExecutionReceipt({
    packet:p,preflight:sealed,execution:execution({verification_results:[
      {name:'SOURCE_REVISION_UNCHANGED',status:'PASS',evidence_ref:'check:revision'},
      {name:'DIRTY_STATE_RECHECK',status:'FAIL',evidence_ref:'check:dirty'},
      {name:'PLAN_ITEM_STILL_READY',status:'PASS',evidence_ref:'check:plan'},
      {name:'PROJECT_AUTHORITY_UNCHANGED',status:'PASS',evidence_ref:'check:authority'},
    ]}),
  }),/VERIFICATION_FAILED/);
});

test('receipt identifiers and reason codes must remain core-receipt compatible',()=>{
  const p=packet();
  const sealed=sealIntegrationPreflight({packet:p,observation:observation()});
  assert.throws(()=>buildIntegrationExecutionReceipt({packet:p,preflight:sealed,execution:execution({attempt_id:'bad/id'})}),/ATTEMPT_ID_INVALID/);
  assert.throws(()=>buildIntegrationExecutionReceipt({packet:p,preflight:sealed,execution:execution({correlation_id:'bad id'})}),/CORRELATION_INVALID/);
  assert.throws(()=>buildIntegrationExecutionReceipt({packet:p,preflight:sealed,execution:execution({reason_code:'lowercase'})}),/REASON_CODE_INVALID/);
});
