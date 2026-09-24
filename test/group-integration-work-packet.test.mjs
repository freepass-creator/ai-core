import test from 'node:test';
import assert from 'node:assert/strict';
import { compileIntegrationWorkPackets, aiCoreIntegrationWorkPackets } from '../src/engine/group-integration-work-packet.mjs';

const ready=(overrides={})=>({
  asset_id:'sales',
  project_id:'freepass-sales',
  repository:'freepass-creator/freepass-sales',
  revision:'a'.repeat(40),
  current_path:'C:/dev/sales',
  classification:'KEEP_SEPARATE',
  reviewer_consensus:'CONSENSUS',
  rollback_ready:true,
  evidence_refs:['GIT:freepass-creator/freepass-sales@'+'a'.repeat(40)],
  required_approvals:[],
  approval_refs:[],
  unknowns:[],
  execution_readiness:'READY_FOR_REVIEWED_EXECUTION',
  blockers:[],
  planned_steps:['PIN_SOURCE_REVISION','PRESERVE_ORIGINAL','REGISTER_POINTERS_ONLY','PRESERVE_PROJECT_AUTHORITY'],
  ...overrides,
});

const plan=(items)=>({
  schema:'ai-core-group-integration-plan/v1',
  plan_id:'AI-CORE-MERGE-P0',
  summary:{total:items.length,ready_for_reviewed_execution:items.filter(x=>x.execution_readiness==='READY_FOR_REVIEWED_EXECUTION').length,hold:items.filter(x=>x.execution_readiness==='HOLD').length,by_classification:{}},
  items,
});

test('only READY_FOR_REVIEWED_EXECUTION items become packets',()=>{
  const set=compileIntegrationWorkPackets(plan([
    ready(),
    ready({asset_id:'hold',execution_readiness:'HOLD',blockers:['DIRTY_STATE_UNKNOWN']}),
  ]));
  assert.equal(set.packet_count,1);
  assert.equal(set.skipped_hold_count,1);
  assert.equal(set.packets[0].asset_id,'sales');
});

test('READY item must bind to a known classification action',async()=>{
  const forgedPlan=plan([ready({classification:'MYSTERY'})]);
  assert.throws(
    ()=>compileIntegrationWorkPackets(forgedPlan),
    /WORK_PACKET_CLASSIFICATION_INVALID/,
  );
  const result=await aiCoreIntegrationWorkPackets({plan:forgedPlan});
  assert.equal(result.status,'HOLD');
  assert.deepEqual(result.blockers,['WORK_PACKET_CLASSIFICATION_INVALID']);
});

test('every packet requires fresh authority and never self-authorizes',()=>{
  const set=compileIntegrationWorkPackets(plan([ready()]));
  const packet=set.packets[0];
  assert.equal(packet.authority.required,true);
  assert.equal(packet.authority.status,'PENDING');
  assert.equal(packet.authority.execution_authorized,false);
  assert.equal(set.execution_authorized,false);
});

test('physical merge packet requires parity and rollback verification',()=>{
  const packet=compileIntegrationWorkPackets(plan([ready({
    classification:'MERGE_PHYSICAL',
    planned_steps:['PIN_SOURCE_REVISION','PRESERVE_ORIGINAL','PREPARE_TARGET_LOCATION','REPLAY_OR_MOVE_CONTENT','VERIFY_EQUIVALENCE'],
  })])).packets[0];
  assert.equal(packet.action_kind,'CROSS_REPO_WRITE');
  assert.equal(packet.rollback.required,true);
  assert.ok(packet.verification.checks.includes('IMPORT_CONTENT_POLICY_CHECK'));
  assert.ok(packet.verification.checks.includes('CANONICAL_AUTHORITY_COLLISION_CHECK'));
  assert.ok(packet.verification.checks.includes('SOURCE_RUNTIME_DEPENDENCY_CHECK'));
  assert.ok(packet.verification.checks.includes('TARGET_PARITY_CHECK'));
  assert.ok(packet.verification.checks.includes('ROLLBACK_PATH_VERIFIED'));
  assert.ok(packet.forbidden_actions.includes('COPY_SECRETS_OR_CREDENTIALS'));
  assert.ok(packet.forbidden_actions.includes('COPY_OPERATIONAL_DATA_OR_LOGS'));
  assert.ok(packet.forbidden_actions.includes('COPY_COMPETING_CANONICAL_AUTHORITY'));
  assert.ok(packet.forbidden_actions.includes('COPY_DEPLOYMENT_BOUNDARY_CONFIG'));
});

test('shared extraction uses the same content and authority collision gates as physical merge',()=>{
  const packet=compileIntegrationWorkPackets(plan([ready({
    classification:'EXTRACT_SHARED',
    planned_steps:['PIN_SOURCE_REVISION','PRESERVE_ORIGINAL','IDENTIFY_SHARED_CONTRACT','EXTRACT_WITH_VERSIONED_BOUNDARY'],
  })])).packets[0];
  assert.ok(packet.verification.checks.includes('IMPORT_CONTENT_POLICY_CHECK'));
  assert.ok(packet.verification.checks.includes('CANONICAL_AUTHORITY_COLLISION_CHECK'));
  assert.ok(packet.verification.checks.includes('SOURCE_RUNTIME_DEPENDENCY_CHECK'));
});

test('keep-separate packet forbids merging git history',()=>{
  const packet=compileIntegrationWorkPackets(plan([ready()])).packets[0];
  assert.ok(packet.forbidden_actions.includes('MERGE_GIT_HISTORY'));
  assert.equal(packet.rollback.required,false);
});

test('retire packet requires recovery verification and does not forbid source retirement',()=>{
  const packet=compileIntegrationWorkPackets(plan([ready({
    classification:'RETIRE',
    planned_steps:['PIN_SOURCE_REVISION','PRESERVE_ORIGINAL','FREEZE_NEW_DEPENDENCIES','VERIFY_REPLACEMENT_OR_NON_USE','RETIRE_AFTER_EXPLICIT_APPROVAL'],
  })])).packets[0];
  assert.equal(packet.action_kind,'RETIRE_RESOURCE');
  assert.ok(packet.verification.checks.includes('RECOVERY_PATH_VERIFIED'));
  assert.equal(packet.forbidden_actions.includes('DELETE_OR_RETIRE_SOURCE'),false);
});

test('adapter is read-only and returns no packets for all-HOLD plan',async()=>{
  const result=await aiCoreIntegrationWorkPackets({plan:plan([
    ready({execution_readiness:'HOLD',blockers:['REVIEW_CONSENSUS_REQUIRED']}),
  ])});
  assert.equal(result.status,'SUCCEEDED');
  assert.equal(result.data.packet_count,0);
  assert.equal(result.external_effect,false);
});
