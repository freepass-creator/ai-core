import test from 'node:test';
import assert from 'node:assert/strict';
import {
  candidateDigestFor,
  compileEvolutionPlan,
  createImprovementCandidate,
  derivePreflightSignals,
  evaluateTransferGate,
  reviewLensesFor,
  routeImprovementSignal
} from '../src/evolution-kernel.mjs';

function taskFixture(overrides = {}) {
  return {
    task_id: 'TASK-1',
    goal: 'Improve a verified workflow',
    desired_outcome: null,
    project: null,
    project_ref: 'main',
    domain: 'development',
    applicable_domains: ['development'],
    risk: 'B',
    authority_required: false,
    external_effect: 'none',
    constraints: [],
    done_when: ['The candidate passes bound transfer checks'],
    ...overrides
  };
}

function evaluateTransfer(candidate, evidence = {}, options = {}) {
  return evaluateTransferGate(candidate, evidence, {
    task: taskFixture(),
    ...options
  });
}

function checkReceipt(candidate, revision = 'abc123', overrides = {}) {
  return {
    id: 'regression',
    result: 'PASS',
    revision,
    candidate_id: candidate.candidate_id,
    candidate_digest: candidate.candidate_digest,
    task_context_digest: candidate.task_context_digest,
    transfer_context_digest: candidate.transfer_context_digest,
    executed_checks: 1,
    failures: 0,
    skips: 0,
    execution_ref: { location: 'runs/regression', revision_or_sha: 'run-sha' },
    evidence_refs: [{ location: 'evidence/regression', revision_or_sha: 'evidence-sha' }],
    ...overrides
  };
}

function approvalReceipt(candidate, authority, reviewer, revision = 'abc123', overrides = {}) {
  return {
    reviewer,
    authority,
    decision: 'APPROVE',
    revision,
    candidate_id: candidate.candidate_id,
    candidate_digest: candidate.candidate_digest,
    task_context_digest: candidate.task_context_digest,
    transfer_context_digest: candidate.transfer_context_digest,
    evidence_ref: {
      location: `reviews/${authority}`,
      revision_or_sha: 'review-sha'
    },
    ...overrides
  };
}

function rollbackPlanReceipt(candidate, revision = 'abc123') {
  return {
    summary: 'Revert the candidate revision',
    revision,
    candidate_id: candidate.candidate_id,
    candidate_digest: candidate.candidate_digest,
    task_context_digest: candidate.task_context_digest,
    transfer_context_digest: candidate.transfer_context_digest,
    evidence_ref: { location: 'rollback/plan', revision_or_sha: 'rollback-sha' }
  };
}

function reproductionReceipt(candidate, revision = 'abc123') {
  return {
    result: 'REPRODUCED',
    candidate_revision: revision,
    reproduced_against_revision: 'base-before-candidate',
    candidate_id: candidate.candidate_id,
    candidate_digest: candidate.candidate_digest,
    task_context_digest: candidate.task_context_digest,
    transfer_context_digest: candidate.transfer_context_digest,
    executed_checks: 1,
    failures: 0,
    skips: 0,
    evidence_ref: { location: 'reproduction/result', revision_or_sha: 'reproduction-sha' }
  };
}

test('routes operational, development and core gaps to their owning systems', () => {
  assert.equal(routeImprovementSignal({ kind: 'operational_failure' }), 'aiops');
  assert.equal(routeImprovementSignal({ kind: 'capability_gap' }), 'devcenter');
  assert.equal(routeImprovementSignal({ kind: 'routing_gap' }), 'ai-core');
  assert.equal(routeImprovementSignal({
    kind: 'conversation_lesson',
    domains: ['legal']
  }), 'aiops');
  assert.equal(routeImprovementSignal({
    kind: 'conversation_lesson',
    domains: ['development']
  }), 'devcenter');
});

test('development work receives proactive lenses the user did not have to enumerate', () => {
  const lenses = reviewLensesFor({ domain: 'development' });
  assert.ok(lenses.includes('security_privacy_and_authority'));
  assert.ok(lenses.includes('deployment_migration_rollback_and_compatibility'));
  assert.ok(lenses.includes('observability_and_real_outcome'));
});

test('legal work receives current-authority and responsible-review lenses', () => {
  const lenses = reviewLensesFor({ domain: 'legal' });
  assert.ok(lenses.includes('current_official_law_and_case_authority'));
  assert.ok(lenses.includes('responsible_human_final_review'));
});

test('mixed-domain work receives every applicable review lens', () => {
  const lenses = reviewLensesFor({
    domain: 'legal',
    applicable_domains: ['legal', 'development']
  });
  assert.ok(lenses.includes('current_official_law_and_case_authority'));
  assert.ok(lenses.includes('security_privacy_and_authority'));
  assert.equal(new Set(lenses).size, lenses.length);
});

test('an empty overlay cannot erase primary-domain review lenses', () => {
  const lenses = reviewLensesFor({ domain: 'legal', applicable_domains: [] });
  assert.ok(lenses.includes('responsible_human_final_review'));
});

test('an improvement signal creates a candidate but never auto-adopts it', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'CAP-1',
    kind: 'capability_gap',
    summary: 'Reusable validator is missing'
  }, { task: taskFixture() });
  assert.equal(candidate.target_system, 'devcenter');
  assert.equal(candidate.task_id, 'TASK-1');
  assert.equal(candidate.signal_id, 'CAP-1');
  assert.match(candidate.task_context_digest, /^sha256:[a-f0-9]{64}$/);
  assert.match(candidate.candidate_id, /^candidate:[a-f0-9]{24}$/);
  assert.equal(candidate.status, 'CANDIDATE');
  assert.equal(candidate.auto_adopted, false);
  assert.equal(candidate.execution_authorized, false);
  assert.throws(() => createImprovementCandidate({
    signal_id: 'NO-TASK',
    kind: 'capability_gap',
    summary: 'Missing task context'
  }), /task.*task_id/);
});

test('transfer gate holds without reproducible evidence and independent review', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'CAP-1',
    kind: 'capability_gap',
    summary: 'Reusable validator is missing',
    change_class: 'C'
  }, { task: taskFixture() });
  const gate = evaluateTransfer(candidate, {});
  assert.equal(gate.status, 'HOLD');
  assert.ok(gate.missing.includes('candidate_revision'));
  assert.ok(gate.missing.includes('independent_review'));
  assert.ok(gate.missing.includes('claude_design'));
});

test('transfer gate becomes ready only for the same reviewed revision', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'OPS-1',
    kind: 'workflow_friction',
    summary: 'Repeated manual handoff',
    change_class: 'B',
    created_by: 'AI_CORE'
  }, { task: taskFixture() });
  const evidence = {
    candidate_revision: 'abc123',
    reproduction_receipt: reproductionReceipt(candidate),
    checks: [checkReceipt(candidate)],
    independent_review: approvalReceipt(
      candidate,
      'independent_reviewer',
      'CLAUDE'
    ),
    rollback_plan: rollbackPlanReceipt(candidate),
    target_acceptance: approvalReceipt(candidate, 'aiops', 'AIOPS')
  };
  assert.equal(evaluateTransfer(candidate, evidence).status, 'TRANSFER_READY');

  const stale = {
    ...evidence,
    independent_review: approvalReceipt(
      candidate,
      'independent_reviewer',
      'CLAUDE',
      'old'
    )
  };
  assert.equal(evaluateTransfer(candidate, stale).status, 'HOLD');
});

test('a complete transfer bundle cannot be replayed after task meaning changes', () => {
  const oldTask = taskFixture();
  const newTask = taskFixture({
    goal: 'Replace the verified workflow with a different one',
    constraints: ['Different operational boundary'],
    done_when: ['A different outcome is verified']
  });
  const signal = {
    signal_id: 'TASK-BOUND-SIGNAL',
    kind: 'workflow_friction',
    summary: 'Improve the current workflow',
    change_class: 'B'
  };
  const oldCandidate = createImprovementCandidate(signal, { task: oldTask });
  const newCandidate = createImprovementCandidate(signal, { task: newTask });
  const evidence = {
    candidate_revision: 'abc123',
    reproduction_receipt: reproductionReceipt(oldCandidate),
    checks: [checkReceipt(oldCandidate)],
    independent_review: approvalReceipt(
      oldCandidate,
      'independent_reviewer',
      'CLAUDE'
    ),
    rollback_plan: rollbackPlanReceipt(oldCandidate),
    target_acceptance: approvalReceipt(oldCandidate, 'aiops', 'AIOPS')
  };

  assert.equal(
    evaluateTransferGate(oldCandidate, evidence, { task: oldTask }).status,
    'TRANSFER_READY'
  );
  const replayed = evaluateTransferGate(oldCandidate, evidence, { task: newTask });
  assert.equal(replayed.status, 'HOLD');
  assert.ok(replayed.missing.includes('task_context_binding'));
  assert.notEqual(newCandidate.task_context_digest, oldCandidate.task_context_digest);
  assert.notEqual(newCandidate.candidate_id, oldCandidate.candidate_id);
});

test('a transfer bundle becomes stale when project, source, capability or policy changes', () => {
  const sourceV1 = {
    system: 'aiops',
    kind: 'control',
    location: 'freepass-creator/aiops/docs/CONTROL_PLANE.md',
    revision_or_sha: 'source-v1'
  };
  const capabilityV1 = {
    id: 'validator',
    scope: 'dev.verify',
    source: {
      locator: 'freepass-creator/devcenter/validator',
      revision_or_sha: 'capability-v1'
    }
  };
  const current = {
    task: taskFixture(),
    subjectRevision: 'project-v1',
    sourcePointers: [sourceV1],
    capabilityRefs: [capabilityV1],
    policyRevision: 'policy-v1'
  };
  const candidate = createImprovementCandidate({
    signal_id: 'REVISION-CONTEXT',
    kind: 'workflow_friction',
    summary: 'Keep transfer evidence current',
    change_class: 'B'
  }, current);
  const evidence = {
    candidate_revision: 'abc123',
    reproduction_receipt: reproductionReceipt(candidate),
    checks: [checkReceipt(candidate)],
    independent_review: approvalReceipt(
      candidate,
      'independent_reviewer',
      'CLAUDE'
    ),
    rollback_plan: rollbackPlanReceipt(candidate),
    target_acceptance: approvalReceipt(candidate, 'aiops', 'AIOPS')
  };

  assert.equal(evaluateTransferGate(candidate, evidence, current).status, 'TRANSFER_READY');

  const staleCases = [{
    options: { ...current, subjectRevision: 'project-v2' },
    missing: 'subject_revision_binding'
  }, {
    options: {
      ...current,
      sourcePointers: [{ ...sourceV1, revision_or_sha: 'source-v2' }]
    },
    missing: 'source_revision_set_binding'
  }, {
    options: {
      ...current,
      capabilityRefs: [{
        ...capabilityV1,
        source: { ...capabilityV1.source, revision_or_sha: 'capability-v2' }
      }]
    },
    missing: 'capability_revision_set_binding'
  }, {
    options: { ...current, policyRevision: 'policy-v2' },
    missing: 'policy_revision_binding'
  }];

  for (const staleCase of staleCases) {
    const gate = evaluateTransferGate(candidate, evidence, staleCase.options);
    assert.equal(gate.status, 'HOLD');
    assert.ok(gate.missing.includes(staleCase.missing));
    assert.ok(gate.missing.includes('transfer_context_binding'));
  }
});

test('a project candidate cannot transfer without a pinned subject revision', () => {
  const projectTask = taskFixture({ project: 'ai-core' });
  const signal = {
    signal_id: 'PROJECT-REVISION-REQUIRED',
    kind: 'capability_gap',
    summary: 'Bind the project candidate to code revision',
    change_class: 'B'
  };
  const candidate = createImprovementCandidate(signal, { task: projectTask });
  const evidence = {
    candidate_revision: 'abc123',
    reproduction_receipt: reproductionReceipt(candidate),
    checks: [checkReceipt(candidate)],
    independent_review: approvalReceipt(
      candidate,
      'independent_reviewer',
      'CLAUDE'
    ),
    rollback_plan: rollbackPlanReceipt(candidate),
    target_acceptance: approvalReceipt(candidate, 'devcenter', 'DEVCENTER')
  };
  const gate = evaluateTransferGate(candidate, evidence, {
    task: projectTask,
    subjectRevision: null
  });
  assert.equal(gate.status, 'HOLD');
  assert.ok(gate.missing.includes('subject_revision_binding'));

  const pinned = createImprovementCandidate(signal, {
    task: projectTask,
    subjectRevision: 'project-sha'
  });
  const pinnedEvidence = {
    candidate_revision: 'abc123',
    reproduction_receipt: reproductionReceipt(pinned),
    checks: [checkReceipt(pinned)],
    independent_review: approvalReceipt(
      pinned,
      'independent_reviewer',
      'CLAUDE'
    ),
    rollback_plan: rollbackPlanReceipt(pinned),
    target_acceptance: approvalReceipt(pinned, 'devcenter', 'DEVCENTER')
  };
  assert.equal(evaluateTransferGate(pinned, pinnedEvidence, {
    task: projectTask,
    subjectRevision: 'project-sha'
  }).status, 'TRANSFER_READY');
});

test('every transfer receipt is bound to task and revision context digests', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'RECEIPT-TASK-BINDING',
    kind: 'workflow_friction',
    summary: 'Bind every receipt to task meaning',
    change_class: 'B'
  }, { task: taskFixture() });
  const evidence = {
    candidate_revision: 'abc123',
    reproduction_receipt: reproductionReceipt(candidate),
    checks: [checkReceipt(candidate)],
    independent_review: approvalReceipt(
      candidate,
      'independent_reviewer',
      'CLAUDE'
    ),
    rollback_plan: rollbackPlanReceipt(candidate),
    target_acceptance: approvalReceipt(candidate, 'aiops', 'AIOPS')
  };
  const wrongDigest = `sha256:${'0'.repeat(64)}`;
  const mutations = [{
    field: 'reproduction_receipt',
    missing: 'problem_reproduction_receipt',
    value: { ...evidence.reproduction_receipt, task_context_digest: wrongDigest }
  }, {
    field: 'checks',
    missing: 'checks_passed',
    value: [{ ...evidence.checks[0], task_context_digest: wrongDigest }]
  }, {
    field: 'independent_review',
    missing: 'independent_review',
    value: { ...evidence.independent_review, task_context_digest: wrongDigest }
  }, {
    field: 'rollback_plan',
    missing: 'rollback_plan',
    value: { ...evidence.rollback_plan, task_context_digest: wrongDigest }
  }, {
    field: 'target_acceptance',
    missing: 'target_acceptance',
    value: { ...evidence.target_acceptance, task_context_digest: wrongDigest }
  }];

  for (const mutation of mutations) {
    const gate = evaluateTransfer(candidate, {
      ...evidence,
      [mutation.field]: mutation.value
    });
    assert.equal(gate.status, 'HOLD');
    assert.ok(gate.missing.includes(mutation.missing));
  }

  for (const mutation of mutations) {
    const original = mutation.field === 'checks'
      ? evidence.checks[0]
      : evidence[mutation.field];
    const value = {
      ...original,
      transfer_context_digest: wrongDigest
    };
    const gate = evaluateTransfer(candidate, {
      ...evidence,
      [mutation.field]: mutation.field === 'checks' ? [value] : value
    });
    assert.equal(gate.status, 'HOLD');
    assert.ok(gate.missing.includes(mutation.missing));
  }
});

test('class approval receipts are also bound to the transfer context digest', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'CLASS-APPROVAL-BINDING',
    kind: 'governance_gap',
    summary: 'Require a bound design approval',
    change_class: 'C'
  }, { task: taskFixture() });
  const evidence = {
    candidate_revision: 'abc123',
    reproduction_receipt: reproductionReceipt(candidate),
    checks: [checkReceipt(candidate)],
    independent_review: approvalReceipt(
      candidate,
      'independent_reviewer',
      'CLAUDE-REVIEWER'
    ),
    rollback_plan: rollbackPlanReceipt(candidate),
    target_acceptance: approvalReceipt(candidate, 'ai-core', 'AI-CORE-OWNER'),
    approvals: {
      claude_design: approvalReceipt(candidate, 'claude_design', 'CLAUDE-DESIGN')
    }
  };

  assert.equal(evaluateTransfer(candidate, evidence).status, 'TRANSFER_READY');
  const wrongDigest = `sha256:${'0'.repeat(64)}`;
  const unbound = evaluateTransfer(candidate, {
    ...evidence,
    approvals: {
      claude_design: {
        ...evidence.approvals.claude_design,
        transfer_context_digest: wrongDigest
      }
    }
  });
  assert.equal(unbound.status, 'HOLD');
  assert.ok(unbound.missing.includes('claude_design'));
});

test('transfer gate rejects stale or evidence-free check claims', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'OPS-STALE',
    kind: 'workflow_friction',
    summary: 'Repeated manual handoff',
    change_class: 'B',
    created_by: 'AI_CORE'
  }, { task: taskFixture() });
  const evidence = {
    candidate_revision: 'new',
    reproduction_receipt: reproductionReceipt(candidate, 'new'),
    checks: [checkReceipt(candidate, 'old')],
    independent_review: approvalReceipt(
      candidate,
      'independent_reviewer',
      'CLAUDE',
      'new'
    ),
    rollback_plan: rollbackPlanReceipt(candidate, 'new'),
    target_acceptance: approvalReceipt(candidate, 'aiops', 'AIOPS', 'new')
  };
  const stale = evaluateTransfer(candidate, evidence);
  assert.equal(stale.status, 'HOLD');
  assert.ok(stale.missing.includes('checks_passed'));

  const unsupported = evaluateTransfer(candidate, {
    ...evidence,
    checks: [{ id: 'regression', result: 'PASS', revision: 'new' }]
  });
  assert.equal(unsupported.status, 'HOLD');
  assert.ok(unsupported.missing.includes('checks_passed'));
});

test('transfer gate rejects a candidate mutated after its digest was issued', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'OPS-MUTATED',
    kind: 'workflow_friction',
    summary: 'Improve a handoff',
    change_class: 'B'
  }, { task: taskFixture() });
  const originalDigest = candidate.candidate_digest;
  candidate.summary = 'Bypass approval controls';
  const evidence = {
    candidate_revision: 'abc123',
    reproduction_receipt: reproductionReceipt(candidate),
    checks: [checkReceipt({ ...candidate, candidate_digest: originalDigest })],
    independent_review: approvalReceipt(
      { ...candidate, candidate_digest: originalDigest },
      'independent_reviewer',
      'CLAUDE'
    ),
    rollback_plan: rollbackPlanReceipt({ ...candidate, candidate_digest: originalDigest }),
    target_acceptance: approvalReceipt(
      { ...candidate, candidate_digest: originalDigest },
      'aiops',
      'AIOPS'
    )
  };
  const gate = evaluateTransfer(candidate, evidence);
  assert.equal(gate.status, 'HOLD');
  assert.ok(gate.missing.includes('candidate_integrity'));
  assert.ok(gate.missing.includes('checks_passed'));
});

test('unsupported change classes cannot be minted as candidates', () => {
  assert.throws(() => createImprovementCandidate({
    signal_id: 'BAD-CLASS',
    kind: 'workflow_friction',
    summary: 'Bad class',
    change_class: 'D '
  }, { task: taskFixture() }), /unsupported change_class/);
});

test('transfer gate validates candidate state invariants even with a recomputed digest', () => {
  const original = createImprovementCandidate({
    signal_id: 'INVALID-STATE',
    kind: 'workflow_friction',
    summary: 'Improve handoff',
    change_class: 'B'
  }, { task: taskFixture() });
  const candidate = {
    ...original,
    status: 'ADOPTED',
    target_system: 'attacker-system',
    auto_adopted: true,
    execution_authorized: true
  };
  candidate.candidate_digest = candidateDigestFor(candidate);
  const evidence = {
    candidate_revision: 'abc123',
    reproduction_receipt: reproductionReceipt(candidate),
    checks: [checkReceipt(candidate)],
    independent_review: approvalReceipt(
      candidate,
      'independent_reviewer',
      'CLAUDE'
    ),
    rollback_plan: rollbackPlanReceipt(candidate),
    target_acceptance: approvalReceipt(candidate, 'attacker-system', 'TARGET')
  };
  const gate = evaluateTransfer(candidate, evidence);
  assert.equal(gate.status, 'HOLD');
  assert.ok(gate.missing.includes('invalid_candidate_contract'));
});

test('transfer gate cannot redirect a candidate away from its owning system', () => {
  const original = createImprovementCandidate({
    signal_id: 'WRONG-OWNER',
    kind: 'capability_gap',
    summary: 'Capability is missing',
    change_class: 'B'
  }, { task: taskFixture() });
  const candidate = { ...original, target_system: 'aiops' };
  candidate.candidate_digest = candidateDigestFor(candidate);
  const evidence = {
    candidate_revision: 'abc123',
    reproduction_receipt: reproductionReceipt(candidate),
    checks: [checkReceipt(candidate)],
    independent_review: approvalReceipt(
      candidate,
      'independent_reviewer',
      'CLAUDE'
    ),
    rollback_plan: rollbackPlanReceipt(candidate),
    target_acceptance: approvalReceipt(candidate, 'aiops', 'AIOPS')
  };
  const gate = evaluateTransfer(candidate, evidence);
  assert.equal(gate.status, 'HOLD');
  assert.ok(gate.missing.includes('invalid_candidate_contract'));
});

test('conversation lesson routing basis is retained inside the candidate digest', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'LEGAL-LESSON',
    kind: 'conversation_lesson',
    domains: ['legal'],
    summary: 'Use current official authority',
    change_class: 'B'
  }, { task: taskFixture() });
  assert.equal(candidate.target_system, 'aiops');
  assert.deepEqual(candidate.routing_domains, ['legal']);
  const redirected = { ...candidate, routing_domains: ['development'] };
  redirected.candidate_digest = candidateDigestFor(redirected);
  assert.ok(evaluateTransfer(redirected).missing.includes('invalid_candidate_contract'));
  assert.throws(() => createImprovementCandidate({
    signal_id: 'MIXED-UNKNOWN-LESSON',
    kind: 'conversation_lesson',
    domains: ['legal', 'unsupported-domain'],
    summary: 'Unsupported routing input',
    change_class: 'B'
  }, { task: taskFixture() }), /unsupported domain/);
});

test('candidate evidence retains revision and observation time together', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'conversation-evidence-tuple',
    kind: 'conversation_lesson',
    summary: 'Keep the full evidence tuple',
    scope: 'development',
    domains: ['development'],
    created_by: 'AI_CORE_CONVERSATION_LEARNING',
    evidence_refs: [{
      location: 'conversation:opaque#message-1',
      revision_or_sha: 'message-sha',
      observed_at: '2026-09-13T10:00:00Z'
    }]
  }, { task: taskFixture() });

  assert.deepEqual(candidate.evidence_refs[0], {
    location: 'conversation:opaque#message-1',
    revision_or_sha: 'message-sha',
    observed_at: '2026-09-13T10:00:00Z'
  });
});

test('independent reviewer identity is canonical and cannot equal the creator', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'SAME-REVIEWER',
    kind: 'workflow_friction',
    summary: 'Improve handoff',
    change_class: 'B',
    created_by: 'AI_CORE '
  }, { task: taskFixture() });
  const evidence = {
    candidate_revision: 'abc123',
    reproduction_receipt: reproductionReceipt(candidate),
    checks: [checkReceipt(candidate)],
    independent_review: approvalReceipt(
      candidate,
      'independent_reviewer',
      'AI_CORE'
    ),
    rollback_plan: rollbackPlanReceipt(candidate),
    target_acceptance: approvalReceipt(candidate, 'aiops', 'AIOPS')
  };
  const gate = evaluateTransfer(candidate, evidence);
  assert.equal(candidate.created_by, 'ai_core');
  assert.equal(gate.status, 'HOLD');
  assert.ok(gate.missing.includes('independent_reviewer_required'));
  assert.throws(() => createImprovementCandidate({
    signal_id: 'BAD-CREATOR',
    kind: 'workflow_friction',
    summary: 'Bad creator',
    created_by: {}
  }, { task: taskFixture() }), /created_by must be a non-empty principal ID/);
});

test('rollback and review evidence must be revision-bound and not future-dated', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'FUTURE-EVIDENCE',
    kind: 'workflow_friction',
    summary: 'Improve handoff',
    change_class: 'B'
  }, { task: taskFixture() });
  const evidence = {
    candidate_revision: 'abc123',
    reproduction_receipt: reproductionReceipt(candidate),
    checks: [checkReceipt(candidate)],
    independent_review: approvalReceipt(
      candidate,
      'independent_reviewer',
      'CLAUDE',
      'abc123',
      { evidence_ref: { location: 'reviews/future', observed_at: '2999-01-01T00:00:00Z' } }
    ),
    rollback_plan: true,
    target_acceptance: approvalReceipt(candidate, 'aiops', 'AIOPS')
  };
  const gate = evaluateTransfer(candidate, evidence, {
    currentTime: '2026-09-13T00:00:00Z'
  });
  assert.equal(gate.status, 'HOLD');
  assert.ok(gate.missing.includes('independent_review'));
  assert.ok(gate.missing.includes('rollback_plan'));
});

test('a bare reproduction claim or another candidate receipt cannot pass transfer', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'REPRODUCTION-BINDING',
    kind: 'workflow_friction',
    summary: 'Improve handoff',
    change_class: 'B'
  }, { task: taskFixture() });
  const other = createImprovementCandidate({
    signal_id: 'OTHER-CANDIDATE',
    kind: 'workflow_friction',
    summary: 'Other handoff',
    change_class: 'B'
  }, { task: taskFixture() });
  const gate = evaluateTransfer(candidate, {
    problem_reproduced: true,
    candidate_revision: 'abc123',
    reproduction_receipt: reproductionReceipt(other),
    checks: [checkReceipt(candidate)],
    independent_review: approvalReceipt(
      candidate,
      'independent_reviewer',
      'CLAUDE'
    ),
    rollback_plan: rollbackPlanReceipt(candidate),
    target_acceptance: approvalReceipt(candidate, 'aiops', 'AIOPS')
  });
  assert.equal(gate.status, 'HOLD');
  assert.ok(gate.missing.includes('problem_reproduction_receipt'));
});

test('invalid observations are rejected without crashing the evolution plan', () => {
  const plan = compileEvolutionPlan({
    task: taskFixture(),
    observations: [
      { signal_id: 'OK', kind: 'routing_gap', summary: 'Route was wrong' },
      { signal_id: 'BAD', kind: 'unknown', summary: 'Unknown signal' }
    ]
  });
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.rejected.length, 1);
  assert.equal(plan.status, 'HOLD_INVALID_INPUT');
  assert.match(plan.rejected[0].signal_id, /^rejected:sha256:/);
  assert.equal(JSON.stringify(plan.rejected).includes('BAD'), false);
  assert.equal(plan.auto_adopted, false);
});

test('malformed and non-array observations hold instead of throwing', () => {
  for (const observations of [[null, undefined], null, { signal_id: 'NOT-AN-ARRAY' }]) {
    const plan = compileEvolutionPlan({
      task: taskFixture(),
      observations
    });
    assert.equal(plan.status, 'HOLD_INVALID_INPUT');
    assert.equal(plan.candidates.length, 0);
    assert.ok(plan.rejected.length > 0);
    assert.equal(plan.execution_authorized, false);
  }
});

test('equivalent signals deduplicate only after validation', () => {
  const first = {
    signal_id: 'DUPLICATE-SIGNAL',
    kind: 'routing_gap',
    summary: 'Route was wrong',
    severity: 'hold'
  };
  const sameWithDifferentKeyOrder = {
    severity: 'hold',
    summary: 'Route was wrong',
    kind: 'routing_gap',
    signal_id: 'DUPLICATE-SIGNAL'
  };
  const plan = compileEvolutionPlan({
    task: taskFixture(),
    observations: [first, sameWithDifferentKeyOrder]
  });
  assert.equal(plan.status, 'CANDIDATES_CREATED');
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.rejected.length, 0);
});

test('same signal ID with conflicting payload is rejected and creates no candidate', () => {
  const secretSignalId = 'PRIVATE-CONFLICTING-SIGNAL';
  const plan = compileEvolutionPlan({
    task: taskFixture(),
    observations: [{
      signal_id: secretSignalId,
      kind: 'routing_gap',
      summary: 'First meaning'
    }, {
      signal_id: secretSignalId,
      kind: 'capability_gap',
      summary: 'Conflicting meaning'
    }]
  });
  assert.equal(plan.status, 'HOLD_INVALID_INPUT');
  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.rejected.length, 1);
  assert.match(plan.rejected[0].signal_id, /^rejected:sha256:/);
  assert.equal(JSON.stringify(plan.rejected).includes(secretSignalId), false);
});

test('an invalid duplicate cannot hide behind an earlier valid signal', () => {
  const plan = compileEvolutionPlan({
    task: taskFixture(),
    observations: [{
      signal_id: 'SHARED-ID',
      kind: 'routing_gap',
      summary: 'Valid meaning'
    }, {
      signal_id: 'SHARED-ID',
      kind: 'unknown',
      summary: 'Invalid meaning'
    }]
  });
  assert.equal(plan.status, 'HOLD_INVALID_INPUT');
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.rejected.length, 1);
});

test('missing current legal authority becomes an AIOPS knowledge candidate', () => {
  const signals = derivePreflightSignals({
    task: { task_id: 'LEGAL-1', domain: 'legal' },
    sourceBindings: [{
      system: 'domain',
      kind: 'current_authority',
      required: true,
      status: 'HOLD'
    }]
  });
  const candidate = createImprovementCandidate(signals[0], {
    task: taskFixture({
      task_id: 'LEGAL-1',
      goal: 'Verify current legal authority',
      project: null,
      domain: 'legal',
      applicable_domains: ['legal'],
      risk: 'C'
    })
  });
  assert.equal(candidate.target_system, 'aiops');
});
