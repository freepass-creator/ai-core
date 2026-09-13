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
    policy_revision: PROOF_POLICY_REVISION,
    result: 'PASS',
    executed_checks: 1,
    verifier: 'INDEPENDENT_VERIFIER',
    verified_at: '2026-09-13T12:00:00Z',
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
            verifier: 'INDEPENDENT_VERIFIER',
            verified_at: '2026-09-13T12:00:00Z',
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

test('requirement digest is stable but changes when completion criteria change', () => {
  const first = buildRequirementSet(task);
  const same = buildRequirementSet({ ...task, done_when: [...task.done_when] });
  const changed = buildRequirementSet({ ...task, done_when: ['different'] });
  assert.equal(first.digest, same.digest);
  assert.notEqual(first.digest, changed.digest);
  assert.equal(first.status, 'DEFINED');
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
  assert.ok(security.issues.includes('VERIFIER_MISSING'));
  assert.ok(security.issues.includes('ARTIFACT_REF_MISSING'));
  assert.ok(security.issues.includes('EXECUTION_REF_MISSING'));
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
        verifier: 'INDEPENDENT_VERIFIER',
        verified_at: '2026-09-13T12:00:00Z',
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
    verified_at: '2026-09-13T12:00:00Z',
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

test('a previous PASS becomes stale after the subject revision changes', () => {
  const result = evaluateTruthStates({
    artifact: { state: 'CREATED', revision: 'old' },
    verification: { state: 'PASS', revision: 'old', executed_checks: 3, failures: 0, skips: 0 }
  }, 'new');
  assert.ok(result.issues.includes('PASS_IS_STALE'));
});
