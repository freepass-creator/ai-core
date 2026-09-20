import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRecoveryPolicies } from '../scripts/validate-workflow-recovery-policies.mjs';

const registry = JSON.parse(readFileSync(new URL('../registry/workflow-recovery-policies.json', import.meta.url), 'utf8'));

test('ERP4 recovery-slot no-replay pilot is valid and remains project-verified', () => {
  const result = validateRecoveryPolicies(registry);
  assert.equal(result.status, 'VALID', JSON.stringify(result.errors));

  const policy = registry.policies.find(item => item.policy_id === 'workflow.recovery-slot-no-replay');
  assert.ok(policy);
  assert.equal(policy.adoption_status, 'PILOT');
  assert.equal(policy.evidence_level, 'PROJECT_VERIFIED');
  assert.deepEqual(policy.source_projects, ['freepasserp4']);
  assert.equal(policy.identity.shared_across_paths, true);
  assert.equal(policy.success_reconciliation.before_fallback, true);
  assert.equal(policy.success_reconciliation.success_suppresses_fallback, true);
  assert.equal(policy.recovery_eligibility.no_success_evidence, true);
  assert.equal(policy.recovery_eligibility.no_successful_prior_recovery, true);
  assert.equal(policy.cursor.monotonic, true);
  assert.equal(policy.cursor.replay_forbidden_after_success, true);
  assert.equal(policy.ambiguous_outcome_action, 'HOLD');
  assert.equal(policy.contract_dependency.identity_owner, 'C');
  assert.equal(policy.contract_dependency.identity_contract_status, 'BOUND');
  assert.equal(policy.contract_dependency.identity_contract_ref, 'core.execution-identity.v1');
  assert.deepEqual(policy.identity.dimensions, ['operation_kind','logical_slot','subject_scope','semantic_input_digest']);
});

test('fallback recovery must reconcile native success and recovery history', () => {
  const broken = structuredClone(registry);
  const policy = broken.policies[0];
  policy.success_reconciliation.evidence_sources = ['DOWNSTREAM_TERMINAL_EVIDENCE', 'EXTERNAL_AUTHORITY'];
  const result = validateRecoveryPolicies(broken);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(item => item.code === 'RECOVERY_NATIVE_SUCCESS_RECONCILIATION_REQUIRED'));
  assert.ok(result.errors.some(item => item.code === 'RECOVERY_HISTORY_RECONCILIATION_REQUIRED'));
});

test('common adoption cannot bypass second-project evidence or C identity binding', () => {
  const broken = structuredClone(registry);
  const policy = broken.policies[0];
  policy.adoption_status = 'COMMON_ADOPTED';
  policy.contract_dependency.identity_contract_status = 'PENDING';
  delete policy.contract_dependency.identity_contract_ref;
  const result = validateRecoveryPolicies(broken);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(item => item.code === 'RECOVERY_COMMON_ADOPTION_EVIDENCE_REQUIRED'));
  assert.ok(result.errors.some(item => item.code === 'RECOVERY_COMMON_ADOPTION_IDENTITY_CONTRACT_REQUIRED'));
});

test('schema forbids replay-after-success and retry-on-ambiguous-outcome semantics', () => {
  const broken = structuredClone(registry);
  const policy = broken.policies[0];
  policy.cursor.replay_forbidden_after_success = false;
  policy.ambiguous_outcome_action = 'RETRY';
  const result = validateRecoveryPolicies(broken);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(item => item.code === 'RECOVERY_POLICY_SCHEMA_INVALID'));
});


test('bound identity contract rejects dimension drift and wrong contract ref', () => {
  const broken = structuredClone(registry);
  const policy = broken.policies[0];
  policy.identity.dimensions = ['operation', 'logical_slot', 'subject_scope'];
  policy.contract_dependency.identity_contract_ref = 'core.fake-identity.v1';
  const result = validateRecoveryPolicies(broken);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(item => item.code === 'RECOVERY_IDENTITY_DIMENSIONS_DRIFT'));
  assert.ok(result.errors.some(item => item.code === 'RECOVERY_IDENTITY_CONTRACT_REF_INVALID'));
});
