import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROOF_POLICY_REVISION,
  buildRequirementSet,
  compileProofContract,
  evaluateTruthStates,
  proofObligationsFor
} from '../src/domain-quality.mjs';

const task = {
  task_id: 'TASK-QUALITY-1',
  project: 'example',
  domain: 'development',
  done_when: [
    { id: 'REQ-UI', text: 'approved UI is reproduced', mode: 'required' },
    { id: 'REQ-TEST', text: 'tests pass', mode: 'required' }
  ]
};

function receiptsFor(contract, overrides = {}) {
  return contract.obligations.map((item, index) => ({
    receipt_id: `R-${index + 1}`,
    obligation_id: item.id,
    task_id: contract.task_id,
    project: contract.project,
    subject_revision: contract.subject_revision,
    requirement_set_digest: contract.requirement_set.digest,
    source_revision_set_digest: contract.source_revision_set.digest,
    capability_revision_set_digest: contract.capability_revision_set.digest,
    policy_revision: PROOF_POLICY_REVISION,
    result: 'PASS',
    executed_checks: 1,
    failures: 0,
    skips: 0,
    verifier: 'INDEPENDENT_VERIFIER',
    verified_at: '2020-01-01T00:00:00Z',
    artifact_ref: { location: 'artifact/result', revision_or_sha: contract.subject_revision },
    execution_ref: { location: `runs/${item.id}`, revision_or_sha: 'run-sha' },
    evidence_refs: [{ location: `evidence/${item.id}.json`, revision_or_sha: 'evidence-sha' }],
    ...(item.id === 'CORE-REQ-TRACEABILITY'
      ? {
          requirement_receipts: contract.requirement_set.requirements.map(req => ({
            requirement_id: req.id,
            requirement_fingerprint: req.fingerprint,
            mode: req.mode,
            result: req.mode === 'automated'
              ? 'PASS'
              : req.mode === 'manual'
                ? 'CONFIRMED'
                : 'EVIDENCED',
            executed_checks: 1,
            ...(req.mode === 'automated' ? { failures: 0, skips: 0 } : {}),
            verifier: 'INDEPENDENT_VERIFIER',
            verified_at: '2020-01-01T00:00:00Z',
            evidence_refs: [{ location: `requirements/${req.id}`, revision_or_sha: 'req-sha' }]
          }))
        }
      : {}),
    ...overrides[item.id]
  }));
}

test('domain profiles add proof obligations beyond generic review lenses', () => {
  const development = proofObligationsFor({ domain: 'development' }).map(item => item.id);
  const legal = proofObligationsFor({ domain: 'legal' }).map(item => item.id);
  const business = proofObligationsFor({ domain: 'business' }).map(item => item.id);
  assert.ok(development.includes('DEV-UI-PREVIEW'));
  assert.ok(development.includes('DEV-REGRESSION'));
  assert.ok(legal.includes('LEGAL-CURRENT-AUTHORITY'));
  assert.ok(legal.includes('LEGAL-HUMAN-REVIEW'));
  assert.ok(business.includes('BIZ-STATE-LAYERS'));
});

test('mixed domains combine obligations without dropping either domain', () => {
  const obligations = proofObligationsFor({
    domain: 'legal',
    applicable_domains: ['legal', 'development']
  });
  const ids = obligations.map(item => item.id);
  assert.ok(ids.includes('LEGAL-HUMAN-REVIEW'));
  assert.ok(ids.includes('DEV-REGRESSION'));
  assert.equal(new Set(ids).size, ids.length);
});

test('an empty overlay cannot erase primary-domain proof obligations', () => {
  const ids = proofObligationsFor({
    domain: 'legal',
    applicable_domains: []
  }).map(item => item.id);
  assert.ok(ids.includes('LEGAL-HUMAN-REVIEW'));
});

test('requirement digest is stable but changes when completion criteria change', () => {
  const first = buildRequirementSet(task);
  const same = buildRequirementSet({ ...task, done_when: [...task.done_when] });
  const changed = buildRequirementSet({ ...task, done_when: ['different'] });
  assert.equal(first.digest, same.digest);
  assert.notEqual(first.digest, changed.digest);
  assert.equal(first.status, 'DEFINED');
});

test('proof receipts cannot be replayed after task meaning changes', () => {
  const original = {
    ...task,
    task_id: 'TASK-REPLAY',
    goal: '상품 검색 API 기능 개발',
    constraints: ['상품 읽기만 허용'],
    external_effect: 'none'
  };
  const changed = {
    ...original,
    goal: '관리자 권한 삭제 기능 개발',
    constraints: ['권한 삭제 허용']
  };
  const originalContract = compileProofContract(original, {
    subjectRevision: 'same-subject-sha'
  });
  const replay = compileProofContract(changed, {
    subjectRevision: 'same-subject-sha',
    receipts: receiptsFor(originalContract),
    evaluationRequested: true
  });
  assert.notEqual(
    originalContract.requirement_set.digest,
    replay.requirement_set.digest
  );
  assert.equal(replay.gate.status, 'HOLD');
  assert.ok(replay.gate.evaluated_receipts.every(item => (
    item.issues.includes('STALE_REQUIREMENT_SET')
  )));
});

test('proof receipts are bound to source and capability revision sets', () => {
  const sourceA = [{
    system: 'project',
    kind: 'instructions',
    location: 'project:AGENTS.md',
    revision_or_sha: 'source-a'
  }];
  const sourceB = [{ ...sourceA[0], revision_or_sha: 'source-b' }];
  const capabilityA = [{
    id: 'repo',
    scope: 'dev.repo.lifecycle',
    source: { locator: 'registry/repo', revision_or_sha: 'cap-a' }
  }];
  const capabilityB = [{
    ...capabilityA[0],
    source: { ...capabilityA[0].source, revision_or_sha: 'cap-b' }
  }];
  const original = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    sourceRevisionSet: sourceA,
    capabilityRevisionSet: capabilityA
  });
  const replay = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    sourceRevisionSet: sourceB,
    capabilityRevisionSet: capabilityB,
    receipts: receiptsFor(original),
    evaluationRequested: true
  });
  assert.equal(replay.gate.status, 'HOLD');
  assert.ok(replay.gate.evaluated_receipts.every(item => (
    item.issues.includes('STALE_SOURCE_REVISION_SET')
    && item.issues.includes('STALE_CAPABILITY_REVISION_SET')
  )));
});

test('proof gate passes only with complete same-revision receipts', () => {
  const preflight = compileProofContract(task, { subjectRevision: 'subject-sha' });
  const result = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    receipts: receiptsFor(preflight),
    evaluationRequested: true
  });
  assert.equal(result.gate.status, 'PASS');
  assert.equal(result.gate.bound_to.subject_revision, 'subject-sha');
});

test('proof gate rejects missing, skipped, zero-run and stale receipts', () => {
  const preflight = compileProofContract(task, { subjectRevision: 'subject-sha' });
  const receipts = receiptsFor(preflight, {
    'DEV-REGRESSION': { result: 'SKIPPED', executed_checks: 0 },
    'DEV-SECURITY': { subject_revision: 'old-sha' }
  }).filter(item => item.obligation_id !== 'CORE-RECOVERY');
  const result = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    receipts,
    evaluationRequested: true
  });
  assert.equal(result.gate.status, 'HOLD');
  assert.ok(result.gate.issues.includes('UNCOVERED_OBLIGATION'));
  assert.ok(result.gate.issues.includes('INVALID_OR_STALE_RECEIPT'));
});

test('proof receipts require verifier, timestamp, artifact and execution evidence', () => {
  const preflight = compileProofContract(task, { subjectRevision: 'subject-sha' });
  const receipts = receiptsFor(preflight, {
    'DEV-SECURITY': {
      verifier: '',
      verified_at: null,
      artifact_ref: null,
      execution_ref: null
    }
  });
  const result = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    receipts,
    evaluationRequested: true
  });
  const security = result.gate.evaluated_receipts.find(item => item.obligation_id === 'DEV-SECURITY');
  assert.equal(result.gate.status, 'HOLD');
  assert.ok(security.issues.includes('VERIFIER_MISSING_OR_INVALID'));
  assert.ok(security.issues.includes('ARTIFACT_REF_MISSING_OR_INVALID'));
  assert.ok(security.issues.includes('EXECUTION_REF_MISSING_OR_INVALID'));
});

test('PASS requires explicit zero failure and skip counts at both receipt levels', () => {
  const preflight = compileProofContract(task, { subjectRevision: 'subject-sha' });
  const receipts = receiptsFor(preflight);
  const securityReceipt = receipts.find(item => item.obligation_id === 'DEV-SECURITY');
  delete securityReceipt.failures;
  delete securityReceipt.skips;
  const traceability = receipts.find(item => item.obligation_id === 'CORE-REQ-TRACEABILITY');
  delete traceability.requirement_receipts[0].failures;
  delete traceability.requirement_receipts[0].skips;

  const result = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    receipts,
    evaluationRequested: true
  });
  const security = result.gate.evaluated_receipts.find(item => (
    item.obligation_id === 'DEV-SECURITY'
  ));
  const trace = result.gate.evaluated_receipts.find(item => (
    item.obligation_id === 'CORE-REQ-TRACEABILITY'
  ));
  assert.equal(result.gate.status, 'HOLD');
  assert.ok(security.issues.includes('FAILURE_COUNT_MISSING_OR_INVALID'));
  assert.ok(security.issues.includes('SKIP_COUNT_MISSING_OR_INVALID'));
  assert.ok(trace.issues.includes('REQUIREMENT_FAILURE_COUNT_MISSING_OR_INVALID'));
  assert.ok(trace.issues.includes('REQUIREMENT_SKIP_COUNT_MISSING_OR_INVALID'));
});

test('an optional automated receipt cannot claim PASS without execution counts', () => {
  const optionalTask = {
    ...task,
    task_id: 'TASK-QUALITY-OPTIONAL',
    done_when: [
      ...task.done_when,
      {
        id: 'REQ-OPTIONAL',
        text: 'optional compatibility check passes when reported',
        mode: 'automated',
        required: false
      }
    ]
  };
  const preflight = compileProofContract(optionalTask, { subjectRevision: 'subject-sha' });
  const receipts = receiptsFor(preflight);
  const traceability = receipts.find(item => item.obligation_id === 'CORE-REQ-TRACEABILITY');
  const optionalReceipt = traceability.requirement_receipts.find(item => (
    item.requirement_id === 'REQ-OPTIONAL'
  ));
  delete optionalReceipt.executed_checks;
  delete optionalReceipt.failures;
  delete optionalReceipt.skips;

  const result = compileProofContract(optionalTask, {
    subjectRevision: 'subject-sha',
    receipts,
    evaluationRequested: true
  });
  const trace = result.gate.evaluated_receipts.find(item => (
    item.obligation_id === 'CORE-REQ-TRACEABILITY'
  ));
  assert.equal(result.gate.status, 'HOLD');
  assert.ok(trace.issues.includes('REQUIREMENT_ZERO_OR_UNKNOWN_EXECUTION'));
  assert.ok(trace.issues.includes('REQUIREMENT_FAILURE_COUNT_MISSING_OR_INVALID'));
  assert.ok(trace.issues.includes('REQUIREMENT_SKIP_COUNT_MISSING_OR_INVALID'));
});

test('requirement traceability rejects uncovered completion criteria', () => {
  const preflight = compileProofContract(task, { subjectRevision: 'subject-sha' });
  const [firstRequirement] = preflight.requirement_set.requirements;
  const receipts = receiptsFor(preflight, {
    'CORE-REQ-TRACEABILITY': {
      requirement_receipts: [{
        requirement_id: firstRequirement.id,
        requirement_fingerprint: firstRequirement.fingerprint,
        mode: firstRequirement.mode,
        result: 'PASS',
        executed_checks: 1,
        failures: 0,
        skips: 0,
        verifier: 'INDEPENDENT_VERIFIER',
        verified_at: '2020-01-01T00:00:00Z',
        evidence_refs: [{ location: 'requirements/REQ-UI', revision_or_sha: 'req-sha' }]
      }]
    }
  });
  const result = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    receipts,
    evaluationRequested: true
  });
  const trace = result.gate.evaluated_receipts.find(item => (
    item.obligation_id === 'CORE-REQ-TRACEABILITY'
  ));
  assert.equal(result.gate.status, 'HOLD');
  assert.ok(trace.issues.includes('UNCOVERED_REQUIREMENT'));
});

test('manual and external criteria remain PARTIAL until confirmed by evidence', () => {
  const mixedTask = {
    ...task,
    task_id: 'TASK-MIXED',
    done_when: [
      { id: 'REQ-MANUAL', text: 'responsible reviewer confirms', mode: 'manual' },
      { id: 'REQ-EXTERNAL', text: 'recipient confirms delivery', mode: 'external' }
    ]
  };
  const preflight = compileProofContract(mixedTask, { subjectRevision: 'subject-sha' });
  const pendingBindings = preflight.requirement_set.requirements.map(req => ({
    requirement_id: req.id,
    requirement_fingerprint: req.fingerprint,
    mode: req.mode,
    result: 'UNKNOWN',
    executed_checks: 1,
    verifier: 'INDEPENDENT_VERIFIER',
    verified_at: '2020-01-01T00:00:00Z',
    evidence_refs: [{ location: `requirements/${req.id}`, revision_or_sha: 'req-sha' }]
  }));
  const receipts = receiptsFor(preflight, {
    'CORE-REQ-TRACEABILITY': { requirement_receipts: pendingBindings }
  });
  const result = compileProofContract(mixedTask, {
    subjectRevision: 'subject-sha',
    receipts,
    evaluationRequested: true
  });
  assert.equal(result.gate.status, 'PARTIAL');
  assert.ok(result.gate.partial_reasons.includes('MANUAL_CONFIRMATION_PENDING:REQ-MANUAL'));
  assert.ok(result.gate.partial_reasons.includes('EXTERNAL_EVIDENCE_PENDING:REQ-EXTERNAL'));
});

test('missing manual and external bindings are PARTIAL rather than fabricated PASS', () => {
  const mixedTask = {
    ...task,
    task_id: 'TASK-PENDING',
    done_when: [
      { id: 'REQ-MANUAL', text: 'reviewer confirms', mode: 'manual' },
      { id: 'REQ-EXTERNAL', text: 'external outcome arrives', mode: 'external' }
    ]
  };
  const preflight = compileProofContract(mixedTask, { subjectRevision: 'subject-sha' });
  const receipts = receiptsFor(preflight, {
    'CORE-REQ-TRACEABILITY': { requirement_receipts: [] }
  });
  const result = compileProofContract(mixedTask, {
    subjectRevision: 'subject-sha',
    receipts,
    evaluationRequested: true
  });
  assert.equal(result.gate.status, 'PARTIAL');
});

test('proof gate rejects future-dated receipt and requirement evidence', () => {
  const preflight = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    currentTime: '2026-09-13T00:00:00Z'
  });
  const receipts = receiptsFor(preflight, {
    'DEV-SECURITY': { verified_at: '2999-01-01T00:00:00Z' },
    'CORE-REQ-TRACEABILITY': {
      requirement_receipts: preflight.requirement_set.requirements.map(req => ({
        requirement_id: req.id,
        requirement_fingerprint: req.fingerprint,
        mode: req.mode,
        result: 'PASS',
        executed_checks: 1,
        failures: 0,
        skips: 0,
        verifier: 'INDEPENDENT_VERIFIER',
        verified_at: '2999-01-01T00:00:00Z',
        evidence_refs: [{ location: `requirements/${req.id}`, revision_or_sha: 'req-sha' }]
      }))
    }
  });
  const result = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    receipts,
    evaluationRequested: true,
    currentTime: '2026-09-13T00:00:00Z'
  });
  const security = result.gate.evaluated_receipts.find(item => (
    item.obligation_id === 'DEV-SECURITY'
  ));
  const traceability = result.gate.evaluated_receipts.find(item => (
    item.obligation_id === 'CORE-REQ-TRACEABILITY'
  ));
  assert.equal(result.gate.status, 'HOLD');
  assert.ok(security.issues.includes('FUTURE_VERIFICATION_TIMESTAMP'));
  assert.ok(traceability.issues.includes('REQUIREMENT_FUTURE_VERIFICATION_TIMESTAMP'));
});

test('proof gate rejects mistyped, invalid and future evidence pointers', () => {
  const currentTime = '2026-09-13T00:00:00Z';
  const preflight = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    currentTime
  });
  const invalidPointer = { location: true, observed_at: 'not-a-date' };
  const futurePointer = { location: 'evidence/future', observed_at: '2999-01-01T00:00:00Z' };
  const receipts = receiptsFor(preflight, {
    'DEV-SECURITY': {
      execution_ref: invalidPointer,
      evidence_refs: [futurePointer]
    },
    'CORE-REQ-TRACEABILITY': {
      requirement_receipts: preflight.requirement_set.requirements.map(req => ({
        requirement_id: req.id,
        requirement_fingerprint: req.fingerprint,
        mode: req.mode,
        result: 'PASS',
        executed_checks: 1,
        failures: 0,
        skips: 0,
        verifier: 'INDEPENDENT_VERIFIER',
        verified_at: '2020-01-01T00:00:00Z',
        evidence_refs: [invalidPointer, futurePointer]
      }))
    }
  });
  const result = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    receipts,
    evaluationRequested: true,
    currentTime
  });
  const security = result.gate.evaluated_receipts.find(item => (
    item.obligation_id === 'DEV-SECURITY'
  ));
  const traceability = result.gate.evaluated_receipts.find(item => (
    item.obligation_id === 'CORE-REQ-TRACEABILITY'
  ));
  assert.equal(result.gate.status, 'HOLD');
  assert.ok(security.issues.includes('EXECUTION_REF_MISSING_OR_INVALID'));
  assert.ok(security.issues.includes('VERSIONED_EVIDENCE_MISSING_OR_INVALID'));
  assert.ok(traceability.issues.includes('REQUIREMENT_EVIDENCE_MISSING_OR_INVALID'));
});

test('proof receipt identity, verifier and timestamps preserve schema types at runtime', () => {
  const currentTime = '2026-09-13T00:00:00Z';
  const preflight = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    currentTime
  });
  const receipts = receiptsFor(preflight, {
    'DEV-SECURITY': {
      receipt_id: { fake: true },
      verifier: { fake: true },
      verified_at: 1
    },
    'CORE-REQ-TRACEABILITY': {
      requirement_receipts: preflight.requirement_set.requirements.map(req => ({
        requirement_id: req.id,
        requirement_fingerprint: req.fingerprint,
        mode: req.mode,
        result: 'PASS',
        executed_checks: 1,
        failures: 0,
        skips: 0,
        verifier: { fake: true },
        verified_at: 1,
        evidence_refs: [{ location: `requirements/${req.id}`, revision_or_sha: 'req-sha' }]
      }))
    }
  });
  const result = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    receipts,
    evaluationRequested: true,
    currentTime
  });
  const security = result.gate.evaluated_receipts.find(item => (
    item.obligation_id === 'DEV-SECURITY'
  ));
  const traceability = result.gate.evaluated_receipts.find(item => (
    item.obligation_id === 'CORE-REQ-TRACEABILITY'
  ));
  assert.equal(result.gate.status, 'HOLD');
  assert.ok(security.issues.includes('RECEIPT_ID_MISSING_OR_INVALID'));
  assert.ok(security.issues.includes('VERIFIER_MISSING_OR_INVALID'));
  assert.ok(security.issues.includes('VERIFIED_AT_MISSING_OR_INVALID'));
  assert.ok(traceability.issues.includes('REQUIREMENT_VERIFIER_MISSING_OR_INVALID'));
  assert.ok(traceability.issues.includes('REQUIREMENT_VERIFIED_AT_MISSING_OR_INVALID'));
});

test('one valid pointer cannot hide unsupported fields or contaminated evidence', () => {
  const currentTime = '2026-09-13T00:00:00Z';
  const preflight = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    currentTime
  });
  const validPointer = { location: 'evidence/valid', revision_or_sha: 'evidence-sha' };
  const invalidPointer = {
    location: 'evidence/future',
    observed_at: '2999-01-01T00:00:00Z',
    hidden: 'not allowed'
  };
  const receipts = receiptsFor(preflight, {
    'DEV-SECURITY': {
      failures: 99,
      skips: 99,
      evidence_refs: [validPointer, invalidPointer]
    },
    'CORE-REQ-TRACEABILITY': {
      requirement_receipts: preflight.requirement_set.requirements.map(req => ({
        requirement_id: req.id,
        requirement_fingerprint: req.fingerprint,
        mode: req.mode,
        result: 'PASS',
        executed_checks: 1,
        failures: 0,
        skips: 0,
        verifier: 'INDEPENDENT_VERIFIER',
        verified_at: '2020-01-01T00:00:00Z',
        evidence_refs: [validPointer, invalidPointer],
        failures: 99
      }))
    }
  });
  const result = compileProofContract(task, {
    subjectRevision: 'subject-sha',
    receipts,
    evaluationRequested: true,
    currentTime
  });
  const security = result.gate.evaluated_receipts.find(item => (
    item.obligation_id === 'DEV-SECURITY'
  ));
  const traceability = result.gate.evaluated_receipts.find(item => (
    item.obligation_id === 'CORE-REQ-TRACEABILITY'
  ));
  assert.equal(result.gate.status, 'HOLD');
  assert.ok(security.issues.includes('PASS_WITH_FAILURE_OR_SKIP'));
  assert.ok(security.issues.includes('VERSIONED_EVIDENCE_MISSING_OR_INVALID'));
  assert.ok(traceability.issues.includes('REQUIREMENT_PASS_WITH_FAILURE_OR_SKIP'));
  assert.ok(traceability.issues.includes('REQUIREMENT_EVIDENCE_MISSING_OR_INVALID'));
});

test('truth-state evidence pointers must be typed and not future-dated', () => {
  const result = evaluateTruthStates({
    authorization: {
      state: 'GRANTED',
      evidence_ref: { location: true, revision_or_sha: true }
    },
    execution: {
      state: 'SUCCEEDED',
      evidence_ref: { location: 'runs/future', observed_at: '2999-01-01T00:00:00Z' }
    }
  }, null, { currentTime: '2026-09-13T00:00:00Z' });
  assert.equal(result.status, 'HOLD');
  assert.ok(result.issues.includes('AUTHORIZATION_EVIDENCE_MISSING'));
  assert.ok(result.issues.includes('EXECUTION_EVIDENCE_MISSING'));
});

test('truth states cannot turn creation into verification or outcome evidence', () => {
  const result = evaluateTruthStates({
    artifact: { state: 'CREATED', revision: 'new' },
    verification: { state: 'PASS', revision: 'old', executed_checks: 0, skips: 1 },
    authorization: { state: 'NOT_GRANTED' },
    execution: { state: 'SUCCEEDED' },
    outcome: { state: 'IMPROVED' }
  }, 'new');
  assert.equal(result.status, 'HOLD');
  assert.ok(result.issues.includes('VERIFICATION_REVISION_MISMATCH'));
  assert.ok(result.issues.includes('ZERO_RUN_PASS'));
  assert.ok(result.issues.includes('EXECUTED_WITHOUT_AUTHORITY'));
  assert.ok(result.issues.includes('OUTCOME_COMPARISON_MISSING'));
  assert.ok(result.issues.includes('OUTCOME_DIRECTION_MISSING'));
});

test('truth-state PASS cannot infer missing failure or skip counts as zero', () => {
  const result = evaluateTruthStates({
    artifact: { state: 'CREATED', revision: 'same' },
    verification: { state: 'PASS', revision: 'same', executed_checks: 1 }
  }, 'same');
  assert.equal(result.status, 'HOLD');
  assert.ok(result.issues.includes('FAILURE_COUNT_MISSING_OR_INVALID'));
  assert.ok(result.issues.includes('SKIP_COUNT_MISSING_OR_INVALID'));
  assert.ok(result.issues.includes('PASS_WITH_FAILURE_OR_SKIP'));
});

test('a previous PASS becomes stale after the subject revision changes', () => {
  const result = evaluateTruthStates({
    artifact: { state: 'CREATED', revision: 'old' },
    verification: { state: 'PASS', revision: 'old', executed_checks: 3, failures: 0, skips: 0 }
  }, 'new');
  assert.ok(result.issues.includes('PASS_IS_STALE'));
});
