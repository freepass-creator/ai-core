import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePlanSliceDigest,
  computePlanProjectionDigest,
  createRuntimeHead,
  evaluatePlanSliceFreshness,
  evaluateWorkReturn,
  parseWorkReturnJson,
  transitionRuntimeHead
} from '../src/cognitive-runtime.mjs';
import { orchestrate } from '../src/core.mjs';
import { canonicalDigest } from '../src/canonical-json.mjs';

const resolvedSources = [
  { system: 'project', kind: 'instructions', status: 'authoritative', location: 'freepass-creator/ai-core:AGENTS.md', revision_or_sha: 'project-sha' },
  { system: 'aiops', kind: 'control', status: 'authoritative', location: 'freepass-creator/aiops:docs/CONTROL_PLANE.md', revision_or_sha: 'control-sha' },
  { system: 'aiops', kind: 'knowledge', status: 'authoritative', location: 'freepass-creator/aiops:docs/aiknowhow/README.md', revision_or_sha: 'knowledge-sha' },
  { system: 'devcenter', kind: 'registry', status: 'authoritative', location: 'freepass-creator/devcenter:registry.json', revision_or_sha: 'registry-sha' },
  { system: 'devcenter', kind: 'inspection', status: 'authoritative', location: 'freepass-creator/devcenter:operations/inspection/POLICY.md', revision_or_sha: 'inspection-sha' }
];
const registry = {
  datasets: [{
    id: 'repo',
    scope: 'dev.repo.lifecycle',
    role: 'authoritative',
    source: { locator: 'repo/repo.md', revision_or_sha: 'capability-sha' }
  }]
};
const environment = {
  subject_revision: 'base-sha',
  resolved_sources: resolvedSources,
  devcenter_registry: registry
};

function output(overrides = {}, environmentOverrides = {}) {
  return orchestrate({
    task_id: 'RUNTIME-1',
    goal: 'API implementation을 안전하게 수정한다',
    desired_outcome: '검증 가능한 작은 패치',
    project: 'ai-core',
    external_effect: 'none',
    done_when: [{ id: 'REQ-1', text: '테스트가 통과한다' }],
    allowed_scope: ['path:src/**'],
    forbidden_scope: ['path:src/secrets/**'],
    proposed_actions: [{
      id: 'PATCH',
      description: '격리된 코드 패치를 만든다',
      target: 'ai-core',
      operation: 'write:path:src/cognitive-runtime.mjs',
      effect: 'local_artifact',
      reversible: true
    }],
    ...overrides
  }, { ...environment, ...environmentOverrides });
}

function validReturn(slice) {
  const reportedAt = new Date(Date.parse(slice.issued_at) + 1_000).toISOString();
  return {
    schema_version: 'work-return/0.6-candidate',
    return_id: 'return:opaque-1',
    reported_at: reportedAt,
    slice_id: slice.slice_id,
    slice_digest: slice.slice_digest,
    attempt_id: slice.attempt_id,
    task_id: slice.task_id,
    audience: slice.audience,
    target: {
      project: slice.target.project,
      repository_identity: slice.target.repository_identity,
      project_ref: slice.target.project_ref
    },
    basis: { ...slice.basis },
    action_results: [{
      action_id: 'PATCH',
      action_context_digest: slice.actions[0].action_context_digest,
      result: 'COMPLETED',
      executed_checks: 1,
      failures: 0,
      skips: 0,
      start_subject_revision: slice.basis.base_subject_revision,
      end_subject_revision: 'candidate-sha',
      changed_scopes: ['path:src/cognitive-runtime.mjs'],
      changed_artifact_refs: [{
        location: 'freepass-creator/ai-core:src/cognitive-runtime.mjs',
        revision_or_sha: 'candidate-sha'
      }],
      evidence_refs: [{
        location: 'ci:node-test',
        revision_or_sha: 'candidate-sha'
      }],
      residual_risk_codes: []
    }],
    requirement_results: [{
      requirement_id: 'REQ-1',
      requirement_fingerprint: slice.requirements[0].fingerprint,
      result: 'COMPLETED',
      executed_checks: 1,
      failures: 0,
      skips: 0,
      subject_revision: 'candidate-sha',
      evidence_refs: [{
        location: 'ci:node-test',
        revision_or_sha: 'candidate-sha'
      }]
    }]
  };
}

function evaluateReturn(slice, claim, options = {}) {
  return evaluateWorkReturn(slice, claim, {
    currentSnapshot: slice,
    ...options
  });
}

test('a complete Plan Slice is reviewable but never grants execution authority', () => {
  const result = output();
  const slice = result.work_packet.plan_slice;
  assert.equal(result.status, 'READY');
  assert.equal(slice.handoff_status, 'READY_FOR_EXECUTOR_REVIEW');
  assert.equal(slice.freshness, 'COMPILED_UNVERIFIED');
  assert.equal(slice.authorization, 'NOT_GRANTED');
  assert.equal(slice.trust_boundary.issued_slice_store, 'NOT_IMPLEMENTED');
  assert.equal(slice.trust_boundary.authenticity, 'UNAUTHENTICATED');
  assert.equal(computePlanSliceDigest(slice), slice.slice_digest);
});

test('unresolved intent preserves only an independent safe action in PREPARE_ONLY', () => {
  const slice = output({
    intent_hypotheses: [{
      id: 'INTENT-CHOICE',
      statement: '속도를 품질보다 우선한다',
      changes_decision: true
    }],
    proposed_actions: [
      {
        id: 'DRAFT',
        description: '검토용 초안을 만든다',
        target: 'ai-core',
        operation: 'write:path:src/draft.md',
        effect: 'local_artifact',
        reversible: true
      },
      {
        id: 'DEPLOY',
        description: '운영에 배포한다',
        target: 'ai-core-production',
        operation: 'deploy:production',
        effect: 'production',
        reversible: true,
        approval_required: true,
        depends_on: ['DRAFT']
      }
    ]
  }).work_packet.plan_slice;
  assert.equal(slice.handoff_status, 'PREPARE_ONLY');
  assert.deepEqual(slice.gates.preparation.allowed_action_ids, ['DRAFT']);
  assert.equal(slice.actions.find(action => action.id === 'DEPLOY').phase, 'EXECUTION_REVIEW');
  assert.equal(slice.authorization, 'NOT_GRANTED');
});

test('constraints never become allowed scope and action handoff fails closed without explicit scope', () => {
  const result = output({
    constraints: ['배포 금지'],
    allowed_scope: [],
    forbidden_scope: []
  });
  assert.deepEqual(result.task.allowed_scope, []);
  assert.deepEqual(result.work_packet.scope.allowed, []);
  assert.deepEqual(result.work_packet.scope.constraints, ['배포 금지']);
  assert.ok(result.holds.includes('SCOPE_UNRESOLVED'));
  assert.equal(result.work_packet.plan_slice.scope.constraints_are_allowed_scope, false);
  assert.equal(result.work_packet.plan_slice.handoff_status, 'BLOCKED');
});

test('all critical basis families make the old slice stale and block handoff', () => {
  const slice = output().work_packet.plan_slice;
  const changedSource = resolvedSources.map(item => (
    item.kind === 'control' ? { ...item, revision_or_sha: 'control-sha-2' } : item
  ));
  const changedRegistry = structuredClone(registry);
  changedRegistry.datasets[0].source.revision_or_sha = 'capability-sha-2';
  const cases = [
    {
      fields: ['task_contract_digest', 'work_packet_basis_digest'],
      current: output({ goal: '다른 API 목표를 안전하게 수정한다' }).work_packet.plan_slice
    },
    {
      fields: ['requirement_set_digest'],
      current: output({ done_when: [{ id: 'REQ-1', text: '다른 검사가 통과한다' }] })
        .work_packet.plan_slice
    },
    {
      fields: ['base_subject_revision'],
      current: output({}, { subject_revision: 'base-sha-2' }).work_packet.plan_slice
    },
    {
      fields: ['source_revision_set_digest'],
      current: output({}, { resolved_sources: changedSource }).work_packet.plan_slice
    },
    {
      fields: ['capability_revision_set_digest'],
      current: output({}, { devcenter_registry: changedRegistry }).work_packet.plan_slice
    },
    {
      fields: ['decision_context_digest'],
      current: output({}, { revoked_memory_ids: ['MEM-ABSENT'] }).work_packet.plan_slice
    },
    {
      fields: ['action_graph_digest'],
      current: output({
        proposed_actions: [{
          id: 'PATCH',
          description: '다른 격리 패치를 만든다',
          target: 'ai-core',
          operation: 'write:path:src/cognitive-runtime.mjs',
          effect: 'local_artifact',
          reversible: true
        }]
      }).work_packet.plan_slice
    },
    {
      fields: ['gate_contract_digest', 'blocker_set_digest'],
      current: output({
        intent_hypotheses: [{
          id: 'INTENT-1',
          statement: '속도를 우선한다',
          changes_decision: true
        }]
      }).work_packet.plan_slice
    },
    {
      fields: ['stewardship_contract_digest'],
      current: output({ related_commitment_ids: ['C-1'] }).work_packet.plan_slice
    }
  ];
  const policyChanged = structuredClone(slice);
  policyChanged.basis.policy_revision = 'future-policy';
  policyChanged.slice_digest = computePlanSliceDigest(policyChanged);
  cases.push({ fields: ['policy_revision'], current: policyChanged });
  const covered = new Set();
  for (const { fields, current } of cases) {
    const now = new Date(Math.max(
      Date.parse(slice.issued_at),
      Date.parse(current.issued_at)
    )).toISOString();
    const evaluation = evaluatePlanSliceFreshness(slice, current, { now });
    assert.equal(evaluation.freshness, 'STALE', fields.join(','));
    assert.equal(evaluation.handoff_status, 'BLOCKED', fields.join(','));
    for (const field of fields) {
      assert.ok(evaluation.changes.includes(field), field);
      covered.add(field);
    }
    assert.equal(evaluation.authorization, 'NOT_GRANTED');
  }
  assert.deepEqual(covered, new Set([
    'task_contract_digest', 'requirement_set_digest', 'base_subject_revision',
    'source_revision_set_digest', 'capability_revision_set_digest',
    'policy_revision', 'decision_context_digest', 'action_graph_digest',
    'gate_contract_digest', 'blocker_set_digest', 'stewardship_contract_digest',
    'work_packet_basis_digest'
  ]));

  const contractChanged = structuredClone(slice);
  contractChanged.basis.plan_contract_revision = 'future-contract';
  contractChanged.slice_digest = computePlanSliceDigest(contractChanged);
  const invalidContract = evaluatePlanSliceFreshness(slice, contractChanged, {
    now: slice.issued_at
  });
  assert.equal(invalidContract.freshness, 'INVALID');
  assert.ok(invalidContract.issues.includes('CURRENT_SLICE_BASIS_REVISION_INVALID'));
});

test('slice content tampering is INVALID even before freshness comparison', () => {
  const slice = structuredClone(output().work_packet.plan_slice);
  slice.objective.goal = 'attacker-selected goal';
  const evaluation = evaluatePlanSliceFreshness(slice, slice, { now: slice.issued_at });
  assert.equal(evaluation.freshness, 'INVALID');
  assert.equal(evaluation.handoff_status, 'BLOCKED');
  assert.ok(evaluation.issues.includes('SLICE_DIGEST_MISMATCH'));
});

test('a stale tombstone prevents an old slice from reviving after values revert', () => {
  const oldSlice = output().work_packet.plan_slice;
  const head = createRuntimeHead(oldSlice);
  const driftedSlice = output({}, {
    subject_revision: 'drifted-sha'
  }).work_packet.plan_slice;
  const transition = transitionRuntimeHead(head, {
    activeSlice: oldSlice,
    currentSnapshot: driftedSlice,
    replacementSlice: driftedSlice,
    supersedeReason: `ghp_${'c'.repeat(32)}`,
    now: driftedSlice.issued_at
  });
  assert.equal(transition.transition, 'SUPERSEDED_WITH_NEW_CANDIDATE');
  assert.ok(transition.head.stale_slice_ids.includes(oldSlice.slice_id));
  assert.equal(JSON.stringify(transition.head).includes(`ghp_${'c'.repeat(32)}`), false);

  const revertedSnapshot = structuredClone(oldSlice);
  const evaluation = evaluatePlanSliceFreshness(oldSlice, revertedSnapshot, {
    knownStaleSliceIds: transition.head.stale_slice_ids,
    now: oldSlice.issued_at
  });
  assert.equal(evaluation.freshness, 'STALE');
  assert.ok(evaluation.changes.includes('permanent_stale_tombstone'));
});

test('a semantically unchanged reissuance requires and digests an explicit reason', () => {
  const active = output().work_packet.plan_slice;
  const replacement = output().work_packet.plan_slice;
  const head = createRuntimeHead(active, { now: active.issued_at });
  const now = new Date(Math.max(
    Date.parse(active.issued_at),
    Date.parse(replacement.issued_at)
  )).toISOString();
  assert.throws(() => transitionRuntimeHead(head, {
    activeSlice: active,
    currentSnapshot: replacement,
    replacementSlice: replacement,
    now
  }), /explicit supersede reason/);

  const reason = 'operator requested a clean reissuance';
  const transitioned = transitionRuntimeHead(head, {
    activeSlice: active,
    currentSnapshot: replacement,
    replacementSlice: replacement,
    supersedeReason: reason,
    now
  });
  assert.equal(transitioned.transition, 'SUPERSEDED_WITH_NEW_CANDIDATE');
  assert.deepEqual(transitioned.head.transition_record.reason_codes, ['EXPLICIT_SUPERSEDE']);
  assert.equal(transitioned.head.transition_record.reason_digest, canonicalDigest(reason));
  assert.equal(JSON.stringify(transitioned.head).includes(reason), false);
});

test('a caller cannot rewrite an immutable Runtime Head without invalidating its state ID', () => {
  const slice = output().work_packet.plan_slice;
  const head = createRuntimeHead(slice);
  const tampered = { ...head, generation: 99 };
  assert.throws(() => transitionRuntimeHead(tampered, {
    activeSlice: slice,
    currentSnapshot: slice,
    now: slice.issued_at
  }), /runtime head is invalid/);
});

test('decision context binds applied and revoked memory without copying summaries into the slice', () => {
  const memoryClaim = {
    memory_id: 'MEM-1',
    rule_key: 'review-boundary',
    summary: 'A private but sanitized operating preference',
    scope: 'LOCAL',
    state: 'ACTIVE',
    project: 'ai-core',
    kind: 'principle',
    authority: 'user_directive',
    source_ref: { location: 'memory:opaque', observed_at: '2026-09-13T10:00:00Z' },
    sanitized: true
  };
  const applied = output({}, { memory_claims: [memoryClaim] }).work_packet.plan_slice;
  const revoked = output({}, {
    memory_claims: [memoryClaim],
    revoked_memory_ids: ['MEM-1']
  }).work_packet.plan_slice;
  assert.notEqual(applied.basis.decision_context_digest, revoked.basis.decision_context_digest);
  assert.deepEqual(applied.decision_context_fingerprint.applicable_memory_ids, ['MEM-1']);
  assert.equal(JSON.stringify(applied).includes(memoryClaim.summary), false);
  assert.equal(applied.decision_context_fingerprint.memory_summaries_included, false);

  const noRevocation = output().work_packet.plan_slice;
  const absentMemoryRevoked = output({}, {
    revoked_memory_ids: ['MEM-NOT-IN-CURRENT-CLAIMS']
  }).work_packet.plan_slice;
  assert.notEqual(
    noRevocation.basis.decision_context_digest,
    absentMemoryRevoked.basis.decision_context_digest
  );
});

test('a structurally complete Work Return remains unauthenticated and unaccepted', () => {
  const slice = output().work_packet.plan_slice;
  const claim = validReturn(slice);
  const evaluation = evaluateReturn(slice, claim, { now: claim.reported_at });
  assert.equal(evaluation.evaluation, 'STRUCTURALLY_MATCHED');
  assert.equal(evaluation.candidate_disposition, 'REVIEW_CANDIDATE');
  assert.equal(evaluation.validation_scope, 'STRUCTURAL_ONLY');
  assert.equal(evaluation.acceptance, 'HOLD_TRUSTED_ADAPTER_REQUIRED');
  assert.equal(evaluation.trust, 'UNAUTHENTICATED');
  assert.equal(evaluation.proof_accepted, false);
  assert.equal(evaluation.task_completed, false);
  assert.equal(evaluation.outcome_observed, false);
  assert.equal(evaluation.execution_authorized, false);
  assert.equal(evaluation.authorization, 'NOT_GRANTED');
});

test('partial but well-bound evidence remains only a partial review candidate', () => {
  const slice = output().work_packet.plan_slice;
  const claim = validReturn(slice);
  claim.action_results[0].result = 'PARTIAL';
  claim.requirement_results[0].result = 'PARTIAL';
  const evaluation = evaluateReturn(slice, claim, { now: claim.reported_at });
  assert.equal(evaluation.evaluation, 'STRUCTURALLY_MATCHED');
  assert.equal(evaluation.candidate_disposition, 'INCOMPLETE_EVIDENCE');
  assert.equal(evaluation.acceptance, 'HOLD_TRUSTED_ADAPTER_REQUIRED');
  assert.equal(evaluation.task_completed, false);
});

test('evaluating the same Work Return twice is deterministic and does not claim consumption', () => {
  const slice = output().work_packet.plan_slice;
  const claim = validReturn(slice);
  const first = evaluateReturn(slice, claim, { now: claim.reported_at });
  const second = evaluateReturn(slice, claim, { now: claim.reported_at });
  assert.deepEqual(first, second);
  assert.equal(first.replay_checked, false);
  assert.equal(Object.hasOwn(first, 'consumed'), false);
});

test('even a forged self-consistent slice and return cannot cross the trust barrier', () => {
  const slice = structuredClone(output().work_packet.plan_slice);
  slice.objective.goal = 'forged goal';
  slice.objective.goal_digest = canonicalDigest('forged goal');
  slice.basis.plan_projection_digest = computePlanProjectionDigest(slice);
  slice.slice_digest = computePlanSliceDigest(slice);
  const claim = validReturn(slice);
  claim.slice_digest = slice.slice_digest;
  const evaluation = evaluateReturn(slice, claim, { now: claim.reported_at });
  assert.equal(evaluation.evaluation, 'STRUCTURALLY_MATCHED');
  assert.equal(evaluation.acceptance, 'HOLD_TRUSTED_ADAPTER_REQUIRED');
  assert.equal(evaluation.issued_record_found, false);
  assert.equal(evaluation.execution_authorized, false);
});

test('basis replay, out-of-plan action, forbidden scope and start revision drift are rejected', () => {
  const slice = output().work_packet.plan_slice;
  const mutations = [
    claim => { claim.basis.policy_revision = 'stale-policy'; },
    claim => { claim.action_results[0].action_id = 'DEPLOY'; },
    claim => { claim.action_results[0].changed_scopes = ['path:src/secrets/key.txt']; },
    claim => { claim.action_results[0].start_subject_revision = 'wrong-base'; }
  ];
  for (const mutate of mutations) {
    const claim = validReturn(slice);
    mutate(claim);
    const evaluation = evaluateReturn(slice, claim, { now: claim.reported_at });
    assert.equal(evaluation.evaluation, 'REJECTED');
    assert.equal(evaluation.execution_authorized, false);
    assert.equal(evaluation.acceptance, 'HOLD_TRUSTED_ADAPTER_REQUIRED');
  }
});

test('zero-run, skipped, failed, evidence-free and self-authorizing returns are rejected', () => {
  const slice = output().work_packet.plan_slice;
  const mutations = [
    claim => { claim.action_results[0].executed_checks = 0; },
    claim => { claim.action_results[0].skips = 1; },
    claim => { claim.action_results[0].failures = 1; },
    claim => { claim.requirement_results[0].evidence_refs = []; },
    claim => { claim.authorized = true; }
  ];
  for (const mutate of mutations) {
    const claim = validReturn(slice);
    mutate(claim);
    const evaluation = evaluateReturn(slice, claim, { now: claim.reported_at });
    assert.equal(evaluation.evaluation, 'REJECTED');
    assert.equal(evaluation.task_completed, false);
  }
});

test('raw memory, transcripts and execution logs are rejected without reflecting values', () => {
  const slice = output().work_packet.plan_slice;
  const claim = validReturn(slice);
  claim.action_results[0].evidence_refs[0].stdout = 'private-secret-value';
  const evaluation = evaluateReturn(slice, claim, { now: claim.reported_at });
  assert.equal(evaluation.evaluation, 'REJECTED');
  assert.ok(evaluation.issues.includes('RETURN_FORBIDDEN_OR_RAW_FIELD'));
  assert.equal(JSON.stringify(evaluation).includes('private-secret-value'), false);

  for (const canary of [`sk_${'z'.repeat(32)}`, `password:${'q'.repeat(24)}`]) {
    const secretClaim = validReturn(slice);
    secretClaim.action_results[0].evidence_refs[0].location = `ci:${canary}`;
    const secretEvaluation = evaluateReturn(slice, secretClaim, {
      now: secretClaim.reported_at
    });
    assert.equal(secretEvaluation.evaluation, 'REJECTED');
    assert.ok(secretEvaluation.issues.includes('RETURN_FORBIDDEN_OR_RAW_FIELD'));
    assert.equal(JSON.stringify(secretEvaluation).includes(canary), false);
  }
});

test('future, expired, observed-at-only and oversized returns fail closed', () => {
  const slice = output().work_packet.plan_slice;
  const cases = [
    claim => {
      claim.reported_at = new Date(Date.parse(slice.issued_at) + 5_000).toISOString();
      return new Date(Date.parse(slice.issued_at) + 1_000).toISOString();
    },
    claim => {
      claim.reported_at = slice.expires_at;
      return slice.expires_at;
    },
    claim => {
      claim.action_results[0].evidence_refs = [{
        location: 'ci:node-test',
        observed_at: slice.issued_at
      }];
      return claim.reported_at;
    },
    claim => {
      claim.action_results[0].residual_risk_codes = ['x'.repeat(300_000)];
      return claim.reported_at;
    }
  ];
  for (const mutate of cases) {
    const claim = validReturn(slice);
    const now = mutate(claim);
    const evaluation = evaluateReturn(slice, claim, { now });
    assert.equal(evaluation.evaluation, 'REJECTED');
    assert.equal(evaluation.execution_authorized, false);
  }
});

test('a recomputed malformed slice is still invalid', () => {
  const slice = structuredClone(output().work_packet.plan_slice);
  slice.gates.execution.authorized = true;
  slice.actions[0].depends_on = ['PATCH'];
  slice.untrusted_override = true;
  slice.slice_digest = computePlanSliceDigest(slice);
  const evaluation = evaluatePlanSliceFreshness(slice, slice, { now: slice.issued_at });
  assert.equal(evaluation.freshness, 'INVALID');
  assert.ok(evaluation.issues.includes('SLICE_FIELDS_INVALID'));
  assert.ok(evaluation.issues.includes('SLICE_GATE_STATE_INVALID'));
  assert.ok(evaluation.issues.includes('SLICE_ACTION_GRAPH_INVALID'));
  assert.equal(evaluation.authorization, 'NOT_GRANTED');
});

test('Plan Slice IDs and TTL retain compiler boundary invariants after rehashing', () => {
  const mutations = [
    slice => { slice.slice_id = 'slice:'; },
    slice => { slice.attempt_id = 'attempt:'; },
    slice => {
      slice.expires_at = new Date(Date.parse(slice.issued_at) + 365 * 24 * 60 * 60 * 1000)
        .toISOString();
    }
  ];
  for (const mutate of mutations) {
    const slice = structuredClone(output().work_packet.plan_slice);
    mutate(slice);
    slice.basis.plan_projection_digest = computePlanProjectionDigest(slice);
    slice.slice_digest = computePlanSliceDigest(slice);
    const evaluation = evaluatePlanSliceFreshness(slice, slice, { now: slice.issued_at });
    assert.equal(evaluation.freshness, 'INVALID');
  }

  const valid = output().work_packet.plan_slice;
  const invalidTombstones = evaluatePlanSliceFreshness(valid, valid, {
    knownStaleSliceIds: null,
    now: valid.issued_at
  });
  assert.equal(invalidTombstones.freshness, 'INVALID');
  assert.deepEqual(invalidTombstones.issues, ['KNOWN_STALE_SLICE_IDS_INVALID']);
});

test('strict JSON parsing rejects duplicate keys before Work Return evaluation', () => {
  assert.throws(
    () => parseWorkReturnJson('{"task_id":"first","task_id":"second"}'),
    error => error.code === 'JSON_DUPLICATE_OBJECT_KEY'
  );
  assert.deepEqual(parseWorkReturnJson('{"task_id":"one","nested":{"value":1}}'), {
    task_id: 'one',
    nested: { value: 1 }
  });
});

test('consequential operation semantics cannot be disguised as a local artifact', () => {
  const result = output({
    proposed_actions: [{
      id: 'DEPLOY',
      description: '운영 배포를 수행한다',
      target: 'production',
      operation: 'deploy:production',
      effect: 'local_artifact',
      reversible: true
    }]
  });
  assert.equal(result.status, 'HOLD');
  assert.ok(result.holds.includes('ACTION_SEMANTICS_CONFLICT'));
  assert.deepEqual(result.human_orchestration.actions.prepare_now, []);
  assert.equal(result.work_packet.plan_slice.actions[0].phase, 'EXECUTION_REVIEW');
  assert.equal(result.work_packet.plan_slice.handoff_status, 'BLOCKED');
});

test('safe preparation requires a concrete in-scope file operation', () => {
  const scopeViolations = [
    'write:path:src/**',
    'write:path:src/../../outside.txt',
    'write:path:src/secrets/key.txt',
    'read:path:/etc/shadow'
  ];
  for (const operation of scopeViolations) {
    const result = output({
      proposed_actions: [{
        id: 'PATCH',
        description: '범위 검증 대상 작업',
        target: 'ai-core',
        operation,
        effect: 'local_artifact',
        reversible: true
      }]
    });
    assert.equal(result.status, 'HOLD', operation);
    assert.ok(result.holds.includes('ACTION_SCOPE_CONFLICT'), operation);
    assert.deepEqual(result.human_orchestration.actions.prepare_now, [], operation);
    assert.equal(result.work_packet.plan_slice.actions[0].phase, 'EXECUTION_REVIEW');
  }

  for (const operation of [
    '운영데이터삭제', 'rm -rf', 'git push', 'kubectl apply', 'SQL TRUNCATE',
    'test:local:curl-evil'
  ]) {
    const result = output({
      proposed_actions: [{
        id: 'PATCH',
        description: '등록되지 않은 작업',
        target: 'ai-core',
        operation,
        effect: 'local_artifact',
        reversible: true
      }]
    });
    assert.equal(result.status, 'HOLD', operation);
    assert.ok(result.holds.includes('ACTION_SEMANTICS_CONFLICT'), operation);
    assert.deepEqual(result.human_orchestration.actions.prepare_now, [], operation);
  }

  for (const operation of [
    'write:path:src/post-deploy-note.md',
    'write:path:src/payment-form.ts',
    'read:path:src/send-button.ts'
  ]) {
    const result = output({
      proposed_actions: [{
        id: 'PATCH',
        description: '허용된 파일 작업',
        target: 'ai-core',
        operation,
        effect: operation.startsWith('read:') ? 'none' : 'local_artifact',
        reversible: true
      }]
    });
    assert.equal(result.status, 'READY', operation);
    assert.deepEqual(
      result.human_orchestration.actions.prepare_now.map(action => action.id),
      ['PATCH'],
      operation
    );
  }
});

test('a no-action information response requires no executor handoff', () => {
  const slice = output({
    desired_outcome: null,
    proposed_actions: [],
    allowed_scope: [],
    forbidden_scope: []
  }).work_packet.plan_slice;
  assert.equal(slice.scope.status, 'NOT_REQUIRED');
  assert.equal(slice.handoff_status, 'NOT_REQUIRED');
  assert.equal(slice.decision_gaps.some(gap => gap.type === 'ACTION_GRAPH_EMPTY'), false);

  const scopedInput = output({
    desired_outcome: null,
    proposed_actions: [],
    allowed_scope: ['path:src/**'],
    forbidden_scope: ['path:src/secrets/**']
  }).work_packet.plan_slice;
  assert.equal(scopedInput.scope.status, 'NOT_REQUIRED');
  assert.deepEqual(scopedInput.scope.allowed, []);
  assert.deepEqual(scopedInput.scope.forbidden, []);
  assert.equal(scopedInput.handoff_status, 'NOT_REQUIRED');
});

test('Runtime Head cannot cross task identity or accept a self-hashed invalid lifecycle', () => {
  const slice = output().work_packet.plan_slice;
  const head = createRuntimeHead(slice);
  const other = orchestrate({
    task_id: 'OTHER-TASK',
    goal: '다른 작업을 수정한다',
    desired_outcome: '다른 패치',
    project: 'ai-core',
    external_effect: 'none',
    done_when: ['다른 테스트가 통과한다'],
    allowed_scope: ['path:src/**'],
    forbidden_scope: [],
    proposed_actions: [{
      id: 'OTHER',
      description: '다른 패치를 만든다',
      target: 'ai-core',
      operation: 'write:path:src/other.mjs',
      effect: 'local_artifact',
      reversible: true
    }]
  }, environment).work_packet.plan_slice;
  assert.throws(() => transitionRuntimeHead(head, {
    activeSlice: slice,
    currentSnapshot: slice,
    replacementSlice: other,
    supersedeReason: 'caller request',
    now: slice.issued_at
  }), /same runtime/);

  const malformed = { ...head, lifecycle: 'THIS_IS_NOT_A_STATE' };
  const { state_id: _oldState, ...payload } = malformed;
  malformed.state_id = `state:${canonicalDigest(payload).slice(7)}`;
  assert.throws(() => transitionRuntimeHead(malformed, {
    activeSlice: slice,
    currentSnapshot: slice,
    now: slice.issued_at
  }), /runtime head is invalid/);
  assert.throws(() => createRuntimeHead(slice, {
    generation: 2,
    previousStateId: 'state:fake'
  }), /does not accept lifecycle overrides/);
});

test('a future-issued or expired current snapshot cannot become the runtime head', () => {
  const active = output().work_packet.plan_slice;
  const head = createRuntimeHead(active);
  const now = active.issued_at;
  const future = structuredClone(active);
  future.slice_id = 'slice:future-candidate';
  future.attempt_id = 'attempt:future-candidate';
  future.issued_at = new Date(Date.parse(now) + 60_000).toISOString();
  future.expires_at = new Date(Date.parse(now) + 120_000).toISOString();
  future.basis.plan_projection_digest = computePlanProjectionDigest(future);
  future.slice_digest = computePlanSliceDigest(future);
  const futureEvaluation = evaluatePlanSliceFreshness(active, future, { now });
  assert.equal(futureEvaluation.freshness, 'INVALID');
  assert.ok(futureEvaluation.issues.includes('CURRENT_EVALUATION_BEFORE_SLICE_ISSUED'));
  assert.throws(() => transitionRuntimeHead(head, {
    activeSlice: active,
    currentSnapshot: future,
    replacementSlice: future,
    supersedeReason: 'future candidate must not win',
    now
  }), /currently valid snapshot/);
  assert.throws(() => createRuntimeHead(future, { now }), /currently valid Plan Slice/);

  const expired = structuredClone(active);
  expired.slice_id = 'slice:expired-candidate';
  expired.attempt_id = 'attempt:expired-candidate';
  expired.issued_at = new Date(Date.parse(now) - 120_000).toISOString();
  expired.expires_at = new Date(Date.parse(now) - 60_000).toISOString();
  expired.basis.plan_projection_digest = computePlanProjectionDigest(expired);
  expired.slice_digest = computePlanSliceDigest(expired);
  const expiredEvaluation = evaluatePlanSliceFreshness(active, expired, { now });
  assert.equal(expiredEvaluation.freshness, 'INVALID');
  assert.ok(expiredEvaluation.issues.includes('CURRENT_SLICE_EXPIRED_AT_EVALUATION_TIME'));
  assert.throws(() => createRuntimeHead(expired, { now }), /currently valid Plan Slice/);
});

test('Runtime Head rejects chronological rollback and can resume after invalidation', () => {
  const active = output().work_packet.plan_slice;
  const head = createRuntimeHead(active, { now: active.issued_at });
  assert.equal(head.latest_slice_issued_at, active.issued_at);

  const older = output({}, { subject_revision: 'older-state-sha' }).work_packet.plan_slice;
  older.slice_id = 'slice:older-candidate';
  older.attempt_id = 'attempt:older-candidate';
  older.issued_at = new Date(Date.parse(active.issued_at) - 60_000).toISOString();
  older.expires_at = new Date(Date.parse(active.issued_at) + 60_000).toISOString();
  older.basis.plan_projection_digest = computePlanProjectionDigest(older);
  older.slice_digest = computePlanSliceDigest(older);
  assert.throws(() => transitionRuntimeHead(head, {
    activeSlice: active,
    currentSnapshot: older,
    replacementSlice: older,
    now: active.issued_at
  }), /predates the runtime high-water mark/);

  const current = output({}, { subject_revision: 'new-state-sha' }).work_packet.plan_slice;
  const transitionTime = new Date(Math.max(
    Date.parse(active.issued_at),
    Date.parse(current.issued_at)
  )).toISOString();
  const invalidated = transitionRuntimeHead(head, {
    activeSlice: active,
    currentSnapshot: current,
    now: transitionTime
  });
  assert.equal(invalidated.transition, 'INVALIDATED');
  assert.equal(invalidated.head.lifecycle, 'REPLAN_REQUIRED');
  assert.equal(invalidated.head.latest_slice_issued_at, current.issued_at);

  const waiting = transitionRuntimeHead(invalidated.head, {
    currentSnapshot: current,
    now: transitionTime
  });
  assert.equal(waiting.transition, 'REPLAN_STILL_REQUIRED');
  assert.equal(waiting.head.state_id, invalidated.head.state_id);

  const resumed = transitionRuntimeHead(invalidated.head, {
    currentSnapshot: current,
    replacementSlice: current,
    now: transitionTime
  });
  assert.equal(resumed.transition, 'REPLAN_ACTIVATED_WITH_NEW_CANDIDATE');
  assert.equal(resumed.head.lifecycle, 'ACTIVE_CANDIDATE');
  assert.equal(resumed.head.generation, 3);
  assert.equal(resumed.head.previous_state_id, invalidated.head.state_id);
  assert.ok(resumed.head.stale_slice_ids.includes(active.slice_id));
  assert.equal(resumed.head.authorization, 'NOT_GRANTED');
});

test('an active slice expires into a replan state even without a newer snapshot', () => {
  const active = output().work_packet.plan_slice;
  const head = createRuntimeHead(active, { now: active.issued_at });
  const expired = transitionRuntimeHead(head, {
    activeSlice: active,
    currentSnapshot: active,
    now: active.expires_at
  });
  assert.equal(expired.transition, 'INVALIDATED');
  assert.equal(expired.head.lifecycle, 'REPLAN_REQUIRED');
  assert.ok(expired.head.stale_slice_ids.includes(active.slice_id));
  assert.ok(expired.head.transition_record.reason_codes.includes(
    'CURRENT_SLICE_EXPIRED_AT_EVALUATION_TIME'
  ));
  assert.equal(expired.head.authorization, 'NOT_GRANTED');

  const differentExpired = structuredClone(active);
  differentExpired.slice_id = 'slice:different-expired';
  differentExpired.attempt_id = 'attempt:different-expired';
  differentExpired.basis.plan_projection_digest = computePlanProjectionDigest(differentExpired);
  differentExpired.slice_digest = computePlanSliceDigest(differentExpired);
  assert.throws(() => transitionRuntimeHead(head, {
    activeSlice: active,
    currentSnapshot: differentExpired,
    now: active.expires_at
  }), /expired snapshot may only invalidate its matching active slice/);
  assert.throws(() => transitionRuntimeHead(head, {
    activeSlice: active,
    currentSnapshot: active,
    replacementSlice: differentExpired,
    now: active.expires_at
  }), /expired snapshot may only invalidate its matching active slice/);
});

test('self-consistent removal of blocking gaps is structurally invalid', () => {
  const slice = structuredClone(output({ allowed_scope: [] }).work_packet.plan_slice);
  slice.decision_gaps = [];
  slice.handoff_status = 'READY_FOR_EXECUTOR_REVIEW';
  slice.basis.plan_projection_digest = computePlanProjectionDigest(slice);
  slice.slice_digest = computePlanSliceDigest(slice);
  const result = evaluatePlanSliceFreshness(slice, slice, { now: slice.issued_at });
  assert.equal(result.freshness, 'INVALID');
  assert.ok(result.issues.some(issue => (
    issue === 'SLICE_BLOCKER_GAP_MISSING'
    || issue === 'SLICE_SCOPE_GAP_MISMATCH'
    || issue === 'SLICE_HANDOFF_STATUS_CONTRADICTION'
  )));
});

test('a recomputed gate cannot omit one of the preparation actions', () => {
  const slice = structuredClone(output({
    proposed_actions: [{
      id: 'A',
      description: '첫 파일을 수정한다',
      target: 'ai-core',
      operation: 'write:path:src/a.mjs',
      effect: 'local_artifact',
      reversible: true
    }, {
      id: 'B',
      description: '둘째 파일을 수정한다',
      target: 'ai-core',
      operation: 'write:path:src/b.mjs',
      effect: 'local_artifact',
      reversible: true
    }]
  }).work_packet.plan_slice);
  slice.gates.preparation.allowed_action_ids = ['A'];
  slice.basis.gate_contract_digest = canonicalDigest(slice.gates);
  slice.basis.plan_projection_digest = computePlanProjectionDigest(slice);
  slice.slice_digest = computePlanSliceDigest(slice);
  const evaluation = evaluatePlanSliceFreshness(slice, slice, { now: slice.issued_at });
  assert.equal(evaluation.freshness, 'INVALID');
  assert.ok(evaluation.issues.includes('SLICE_GATE_STATE_INVALID'));
});

test('material Plan Slice projections cannot match an unchanged current snapshot', () => {
  const current = output().work_packet.plan_slice;
  const mutations = [
    slice => {
      slice.objective.goal = '변조된 목표';
      slice.objective.goal_digest = canonicalDigest('변조된 목표');
    },
    slice => { slice.decision_context_fingerprint.selected_decision_ids = ['FORGED']; },
    slice => { slice.stewardship_projection.foresight.smallest_reversible_next_step = 'FORGED'; },
    slice => { slice.slice_id = 'slice:forged-identity'; }
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(current);
    mutate(candidate);
    candidate.basis.plan_projection_digest = computePlanProjectionDigest(candidate);
    candidate.slice_digest = computePlanSliceDigest(candidate);
    const evaluation = evaluatePlanSliceFreshness(candidate, current, {
      now: current.issued_at
    });
    assert.equal(evaluation.freshness, 'STALE');
    assert.ok(evaluation.changes.includes('plan_projection_digest'));
    assert.equal(evaluation.handoff_status, 'BLOCKED');
  }
});

test('required nested provenance and invariant fields cannot be removed and rehashed', () => {
  const mutations = [
    slice => {
      delete slice.source_revision_set[0].system;
      slice.basis.source_revision_set_digest = canonicalDigest(slice.source_revision_set);
    },
    slice => {
      delete slice.capability_revision_set[0].id;
      slice.basis.capability_revision_set_digest = canonicalDigest(slice.capability_revision_set);
    },
    slice => { slice.invariant_kernel = {}; },
    slice => { delete slice.stewardship_projection.portfolio.status; },
    slice => { slice.work_return_contract.required_binding_fields = []; }
  ];
  for (const mutate of mutations) {
    const slice = structuredClone(output().work_packet.plan_slice);
    mutate(slice);
    slice.basis.plan_projection_digest = computePlanProjectionDigest(slice);
    slice.slice_digest = computePlanSliceDigest(slice);
    const evaluation = evaluatePlanSliceFreshness(slice, slice, { now: slice.issued_at });
    assert.equal(evaluation.freshness, 'INVALID');
  }
});

test('path traversal, wildcard results and cross-target artifacts are rejected', () => {
  const slice = output().work_packet.plan_slice;
  const cases = [
    claim => { claim.action_results[0].changed_scopes = ['path:src/../outside.txt']; },
    claim => { claim.action_results[0].changed_scopes = ['path:src/**']; },
    claim => {
      claim.action_results[0].changed_artifact_refs[0].location =
        'freepass-creator/other-repo:src/cognitive-runtime.mjs';
    },
    claim => {
      claim.action_results[0].changed_artifact_refs[0].location =
        'attacker/ai-core:src/cognitive-runtime.mjs';
    },
    claim => {
      claim.action_results[0].changed_artifact_refs[0].location =
        'freepass-creator/ai-core:.github/workflows/deploy.yml';
    }
  ];
  for (const mutate of cases) {
    const claim = validReturn(slice);
    mutate(claim);
    const evaluation = evaluateReturn(slice, claim, { now: claim.reported_at });
    assert.equal(evaluation.evaluation, 'REJECTED');
  }
});

test('Work Return changes are bound to the exact action operation path', () => {
  const slice = output().work_packet.plan_slice;
  const wrongFile = validReturn(slice);
  wrongFile.action_results[0].changed_scopes = ['path:src/other.mjs'];
  wrongFile.action_results[0].changed_artifact_refs[0].location =
    'freepass-creator/ai-core:src/other.mjs';
  const rejected = evaluateReturn(slice, wrongFile, { now: wrongFile.reported_at });
  assert.equal(rejected.evaluation, 'REJECTED');
  assert.ok(rejected.issues.includes('ACTION_SCOPE_NOT_BOUND_TO_OPERATION'));
  assert.ok(rejected.issues.includes('ACTION_ARTIFACT_SCOPE_OR_TARGET_MISMATCH'));

  const readSlice = output({
    proposed_actions: [{
      id: 'PATCH',
      description: '파일을 읽는다',
      target: 'ai-core',
      operation: 'read:path:src/cognitive-runtime.mjs',
      effect: 'none',
      reversible: true
    }]
  }).work_packet.plan_slice;
  const falseReadChange = validReturn(readSlice);
  const readRejected = evaluateReturn(readSlice, falseReadChange, {
    now: falseReadChange.reported_at
  });
  assert.equal(readRejected.evaluation, 'REJECTED');
  assert.ok(readRejected.issues.includes('READ_ONLY_ACTION_CHANGE_CLAIM'));

  falseReadChange.action_results[0].changed_scopes = [];
  falseReadChange.action_results[0].changed_artifact_refs = [];
  const revisionOnlyRejected = evaluateReturn(readSlice, falseReadChange, {
    now: falseReadChange.reported_at
  });
  assert.equal(revisionOnlyRejected.evaluation, 'REJECTED');
  assert.ok(revisionOnlyRejected.issues.includes('READ_ONLY_BATCH_REVISION_CHANGED'));
});

test('a read-then-write preparation DAG shares one final batch revision', () => {
  const slice = output({
    proposed_actions: [{
      id: 'READ',
      description: '입력 파일을 읽는다',
      target: 'ai-core',
      operation: 'read:path:src/input.mjs',
      effect: 'none',
      reversible: true
    }, {
      id: 'WRITE',
      description: '출력 파일을 쓴다',
      target: 'ai-core',
      operation: 'write:path:src/output.mjs',
      effect: 'local_artifact',
      reversible: true,
      depends_on: ['READ']
    }]
  }).work_packet.plan_slice;
  const claim = validReturn(slice);
  const template = claim.action_results[0];
  const readAction = slice.actions.find(action => action.id === 'READ');
  const writeAction = slice.actions.find(action => action.id === 'WRITE');
  claim.action_results = [{
    ...template,
    action_id: 'READ',
    action_context_digest: readAction.action_context_digest,
    changed_scopes: [],
    changed_artifact_refs: []
  }, {
    ...template,
    action_id: 'WRITE',
    action_context_digest: writeAction.action_context_digest,
    changed_scopes: ['path:src/output.mjs'],
    changed_artifact_refs: [{
      location: 'freepass-creator/ai-core:src/output.mjs',
      revision_or_sha: 'candidate-sha'
    }]
  }];
  const evaluation = evaluateReturn(slice, claim, { now: claim.reported_at });
  assert.equal(evaluation.evaluation, 'STRUCTURALLY_MATCHED');
  assert.equal(evaluation.candidate_disposition, 'REVIEW_CANDIDATE');
});

test('Work Return needs exact action coverage and a completed dependency chain', () => {
  const slice = output().work_packet.plan_slice;
  const missing = validReturn(slice);
  missing.action_results = [];
  missing.requirement_results[0].subject_revision = slice.basis.base_subject_revision;
  missing.requirement_results[0].evidence_refs[0].revision_or_sha =
    slice.basis.base_subject_revision;
  const incomplete = evaluateReturn(slice, missing, { now: missing.reported_at });
  assert.equal(incomplete.evaluation, 'STRUCTURALLY_MATCHED');
  assert.equal(incomplete.candidate_disposition, 'INCOMPLETE_EVIDENCE');

  const gatedSlice = output({
    intent_hypotheses: [{
      id: 'INTENT-BLOCK',
      statement: '운영 반영을 우선한다',
      changes_decision: true
    }],
    proposed_actions: [{
      id: 'DRAFT',
      description: '초안을 만든다',
      target: 'ai-core',
      operation: 'write:path:src/draft.md',
      effect: 'local_artifact',
      reversible: true
    }, {
      id: 'DEPLOY',
      description: '운영에 배포한다',
      target: 'production',
      operation: 'deploy:production',
      effect: 'production',
      reversible: true,
      approval_required: true,
      depends_on: ['DRAFT']
    }]
  }).work_packet.plan_slice;
  const unauthorized = validReturn(gatedSlice);
  const deploy = gatedSlice.actions.find(action => action.id === 'DEPLOY');
  unauthorized.action_results[0].action_id = 'DEPLOY';
  unauthorized.action_results[0].action_context_digest = deploy.action_context_digest;
  const rejected = evaluateReturn(gatedSlice, unauthorized, {
    now: unauthorized.reported_at
  });
  assert.equal(rejected.evaluation, 'REJECTED');
  assert.ok(rejected.issues.includes('UNAUTHORIZED_EXECUTION_ACTION_CLAIM'));
});

test('revision and time evidence are bound to the one returned revision', () => {
  const slice = output().work_packet.plan_slice;
  const cases = [
    claim => {
      claim.reported_at = new Date(Date.parse(slice.issued_at) - 1).toISOString();
      return slice.issued_at;
    },
    claim => {
      claim.action_results[0].evidence_refs[0].revision_or_sha = 'other-sha';
      return claim.reported_at;
    },
    claim => {
      claim.requirement_results[0].evidence_refs[0].revision_or_sha = 'other-sha';
      return claim.reported_at;
    },
    claim => {
      claim.action_results[0].changed_artifact_refs = [];
      claim.action_results[0].changed_scopes = [];
      return claim.reported_at;
    }
  ];
  for (const mutate of cases) {
    const claim = validReturn(slice);
    const now = mutate(claim);
    const evaluation = evaluateReturn(slice, claim, { now });
    assert.equal(evaluation.evaluation, 'REJECTED');
  }
});

test('missing current snapshot and malformed slices fail closed without throwing', () => {
  const slice = output().work_packet.plan_slice;
  const claim = validReturn(slice);
  const missingSnapshot = evaluateWorkReturn(slice, claim, { now: claim.reported_at });
  assert.equal(missingSnapshot.evaluation, 'REJECTED');
  assert.ok(missingSnapshot.issues.includes('CURRENT_SNAPSHOT_MISSING'));
  for (const malformed of [null, {}, 42]) {
    assert.doesNotThrow(() => evaluateWorkReturn(malformed, claim, {
      now: claim.reported_at,
      currentSnapshot: slice
    }));
    assert.equal(evaluateWorkReturn(malformed, claim, {
      now: claim.reported_at,
      currentSnapshot: slice
    }).evaluation, 'REJECTED');
  }
});

test('sensitive human text is redacted and blocks external handoff', () => {
  const canary = `ghp_${'a'.repeat(32)}`;
  const result = output({ goal: `패치 ${canary}를 적용한다` });
  const slice = result.work_packet.plan_slice;
  assert.equal(JSON.stringify(slice).includes(canary), false);
  assert.equal(slice.disclosure_review.status, 'REDACTED_BLOCKED');
  assert.equal(slice.handoff_status, 'BLOCKED');
  assert.ok(result.holds.includes('DISCLOSURE_REVIEW_REQUIRED'));
  const integrity = evaluatePlanSliceFreshness(slice, slice, { now: slice.issued_at });
  assert.equal(integrity.freshness, 'MATCHED_TO_CALLER_SNAPSHOT');

  const effectResult = output({
    proposed_actions: [{
      id: 'PATCH',
      description: '민감 효과 필드 검사',
      target: 'ai-core',
      operation: 'write:path:src/cognitive-runtime.mjs',
      effect: `password=${'z'.repeat(24)}`,
      reversible: true
    }]
  });
  assert.equal(JSON.stringify(effectResult.work_packet.plan_slice).includes('password='), false);
  assert.equal(effectResult.work_packet.plan_slice.disclosure_review.status, 'REDACTED_BLOCKED');
});

test('a redacted requirement cannot be rehashed into a disclosure-clear handoff', () => {
  const canary = `ghp_${'b'.repeat(32)}`;
  const slice = structuredClone(output({
    done_when: [{ id: 'REQ-1', text: `검사 ${canary}가 통과한다` }]
  }).work_packet.plan_slice);
  assert.match(slice.requirements[0].text, /^\[REDACTED:/);
  slice.disclosure_review.status = 'STRUCTURAL_SCAN_CLEAR';
  slice.disclosure_review.redacted_field_paths = [];
  slice.decision_gaps = slice.decision_gaps.filter(gap => (
    gap.type !== 'DISCLOSURE_REVIEW_REQUIRED'
  ));
  slice.gates.preparation = {
    status: 'ALLOWED',
    allowed_action_ids: ['PATCH'],
    blockers: []
  };
  slice.gates.execution.blockers = [];
  slice.gates.execution.status = 'REVIEW_READY';
  slice.handoff_status = 'READY_FOR_EXECUTOR_REVIEW';
  slice.basis.gate_contract_digest = canonicalDigest(slice.gates);
  slice.basis.blocker_set_digest = canonicalDigest([]);
  slice.basis.plan_projection_digest = computePlanProjectionDigest(slice);
  slice.slice_digest = computePlanSliceDigest(slice);
  const evaluation = evaluatePlanSliceFreshness(slice, slice, { now: slice.issued_at });
  assert.equal(evaluation.freshness, 'INVALID');
  assert.ok(evaluation.issues.includes('SLICE_DISCLOSURE_REVIEW_INVALID'));
});
