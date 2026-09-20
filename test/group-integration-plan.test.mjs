import test from 'node:test';
import assert from 'node:assert/strict';
import { compileGroupIntegrationPlan, aiCoreGroupIntegrationPlan } from '../src/engine/group-integration-plan.mjs';

const base=(overrides={})=>({
  asset_id:'sales',
  current_path:'C:/dev/sales',
  project_id:'freepass-sales',
  repository:'freepass-creator/freepass-sales',
  revision:'a'.repeat(40),
  role:'sales subsidiary',
  data_ssot:'Firestore',
  deploy_targets:['Firebase'],
  dirty_state:'CLEAN',
  classification:'KEEP_SEPARATE',
  reviewer_consensus:'CONSENSUS',
  rollback_ready:true,
  evidence_refs:['GIT:freepass-creator/freepass-sales@'+'a'.repeat(40)],
  required_approvals:[],
  approval_refs:[],
  source_project_ids:[],
  unknowns:[],
  ...overrides,
});

test('classification is explicit and never inferred',()=>{
  assert.throws(()=>compileGroupIntegrationPlan({assets:[base({classification:null})]}),/INTEGRATION_CLASSIFICATION_INVALID/);
});

test('keep-separate clean asset can reach reviewed-execution readiness but never authorization',()=>{
  const plan=compileGroupIntegrationPlan({assets:[base()]});
  assert.equal(plan.items[0].execution_readiness,'READY_FOR_REVIEWED_EXECUTION');
  assert.equal(plan.items[0].execution_authorized,false);
  assert.equal(plan.policy.auto_execution,false);
});

test('merge physical fails closed on dirty state and missing rollback',()=>{
  const plan=compileGroupIntegrationPlan({assets:[base({
    classification:'MERGE_PHYSICAL',
    dirty_state:'DIRTY',
    rollback_ready:false,
  })]});
  const item=plan.items[0];
  assert.equal(item.execution_readiness,'HOLD');
  assert.ok(item.blockers.includes('WORKTREE_DIRTY'));
  assert.ok(item.blockers.includes('ROLLBACK_PLAN_REQUIRED'));
});

test('shared extraction requires evidence from at least two projects',()=>{
  const plan=compileGroupIntegrationPlan({assets:[base({
    classification:'EXTRACT_SHARED',
    source_project_ids:['freepass-sales'],
  })]});
  assert.equal(plan.items[0].execution_readiness,'HOLD');
  assert.ok(plan.items[0].blockers.includes('MULTI_PROJECT_EVIDENCE_REQUIRED'));
});

test('retire requires explicit user decision and recovery plan',()=>{
  const plan=compileGroupIntegrationPlan({assets:[base({
    classification:'RETIRE',
    user_decision_ref:null,
    rollback_ready:false,
  })]});
  assert.ok(plan.items[0].blockers.includes('USER_RETIRE_DECISION_REQUIRED'));
  assert.ok(plan.items[0].blockers.includes('RETIRE_RECOVERY_PLAN_REQUIRED'));
});

test('adapter remains read-only and returns HOLD details inside the plan instead of executing',async()=>{
  const result=await aiCoreGroupIntegrationPlan({assets:[base({
    reviewer_consensus:'HOLD',
  })]});
  assert.equal(result.status,'SUCCEEDED');
  assert.equal(result.data.summary.hold,1);
  assert.equal(result.external_effect,false);
  assert.equal(result.data.items[0].execution_authorized,false);
});
