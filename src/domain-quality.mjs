import { createHash } from 'node:crypto';
import { effectiveDomains, effectiveRisk } from './domain-policy.mjs';

export const PROOF_POLICY_REVISION = '2026-09-13.5';

const UNIVERSAL_OBLIGATIONS = Object.freeze([
  obligation(
    'CORE-TASK-CONTRACT',
    '목적·범위·완료조건이 명시되고 서로 모순되지 않는다',
    'task_contract'
  ),
  obligation(
    'CORE-SSOT-REVISION',
    '정본·입력·대상 revision과 금지된 중복 권위를 식별한다',
    'versioned_source_pointers'
  ),
  obligation(
    'CORE-EPISTEMIC-BOUNDARY',
    '사실·가설·추론·불확실성을 분리하고 UNKNOWN을 추측으로 메우지 않는다',
    'claim_classification'
  ),
  obligation(
    'CORE-REQ-TRACEABILITY',
    '모든 완료조건이 같은 task·project·revision의 검사 영수증으로 덮인다',
    'requirement_receipt_set'
  ),
  obligation(
    'CORE-STATE-SEPARATION',
    '작성·검증·승인·실행·성과 상태를 서로 대신 사용하지 않는다',
    'truth_state_evidence'
  ),
  obligation(
    'CORE-PRIVACY-AUTHORITY',
    '개인정보·비밀·수신자·실행 권한과 최소 공개 범위를 확인한다',
    'privacy_and_authority_review'
  ),
  obligation(
    'CORE-RECOVERY',
    '실패·되돌리기·중단 조건과 복구 책임을 명시한다',
    'rollback_or_recovery_plan'
  ),
  obligation(
    'CORE-OUTCOME',
    '산출물 생성과 현실 성과를 구분하고 후속 측정 방법을 정한다',
    'outcome_measurement_plan'
  )
]);

const DOMAIN_OBLIGATIONS = Object.freeze({
  development: Object.freeze([
    obligation('DEV-INPUT-OUTPUT', '입출력 계약·데이터 경계·상태 전이를 검증한다', 'contract_and_state_tests'),
    obligation('DEV-REGRESSION', '정상·실패·빈값·권한·동시성·회귀와 데이터 손실을 검사한다', 'executed_regression_suite'),
    obligation('DEV-SECURITY', '인증·인가·비밀·개인정보·의존성 경계를 점검한다', 'security_review'),
    obligation('DEV-REUSE', '기존 capability·공통 부품을 조회하고 중복 구현을 정당화한다', 'reuse_decision'),
    obligation('DEV-UI-PREVIEW', '시각 변경은 코딩 전 승인 시안 또는 최신 지시의 명시적 면제를 갖는다', 'preview_approval_or_waiver', 'visual_scope_only'),
    obligation('DEV-DEPLOYMENT', '빌드·마이그레이션·호환성·배포·롤백 경계를 실제 revision에 묶는다', 'deployment_and_rollback_evidence'),
    obligation('DEV-OBSERVABILITY', '로그·오류·성능·비용과 운영 결과를 관찰할 수 있다', 'observability_evidence')
  ]),
  legal: Object.freeze([
    obligation('LEGAL-ISSUE-MAP', '목표·관할·쟁점·요청 구제를 특정한다', 'issue_and_remedy_map'),
    obligation('LEGAL-CLAIM-LAYERS', 'FACT·EVIDENCE·상대 주장·INFERENCE·AUTHORITY·UNCERTAINTY를 분리한다', 'classified_legal_record'),
    obligation('LEGAL-CHRONOLOGY', '사건·증거·절차의 날짜와 출처를 연결한다', 'sourced_chronology'),
    obligation('LEGAL-CURRENT-AUTHORITY', '적용 시점의 최신 공식 법령·판례·절차 원문을 확인한다', 'current_official_authority'),
    obligation('LEGAL-DEADLINES', '관할·기산점·제출 또는 대응 기한을 검증하고 불명확하면 HOLD한다', 'deadline_verification'),
    obligation('LEGAL-COUNTERCASE', '상대방의 최강 반론·불리한 증거·예외와 반박 한계를 함께 검토한다', 'counterargument_matrix'),
    obligation('LEGAL-CITATION', '인용·요약·증거 번호가 원문과 일치한다', 'citation_and_evidence_audit'),
    obligation('LEGAL-HUMAN-REVIEW', '권한과 책임이 있는 인간이 같은 revision을 최종 검토한다', 'responsible_human_review')
  ]),
  business: Object.freeze([
    obligation('BIZ-STATE-LAYERS', '계약·매출 인식·현금 수취·고객 행동·최종 성과를 구분한다', 'business_state_reconciliation'),
    obligation('BIZ-ECONOMICS', '매출뿐 아니라 비용·마진·현금흐름·운전자본 영향을 계산한다', 'economics_and_cashflow_model'),
    obligation('BIZ-ASSUMPTIONS', '가정·시나리오·민감도와 확인되지 않은 수치를 표시한다', 'assumption_register'),
    obligation('BIZ-RISK', '하방 위험·중단 조건·가역성·책임자를 정한다', 'risk_and_stop_conditions'),
    obligation('BIZ-OUTCOME', '선행/후행 지표·기준선·측정기간으로 실제 효과를 검증한다', 'measured_business_outcome')
  ]),
  document: Object.freeze([
    obligation('DOC-PURPOSE-AUDIENCE', '목적·독자·사용 장면·요청 행동이 일치한다', 'purpose_and_audience_review'),
    obligation('DOC-SOURCE-ALIGNMENT', '주장·수치·인용·표가 최신 원본과 연결된다', 'source_and_citation_audit'),
    obligation('DOC-CONSISTENCY', '본문·표·각주·첨부 사이의 용어·수치·날짜가 일치한다', 'cross_document_consistency'),
    obligation('DOC-RENDER', '최종 형식에서 페이지·폰트·이미지·링크·내보내기를 실제 확인한다', 'rendered_artifact_review'),
    obligation('DOC-ACCESSIBILITY', '가독성·탐색성·대체텍스트·재사용성과 개인정보 노출을 점검한다', 'accessibility_and_privacy_review')
  ]),
  communication: Object.freeze([
    obligation('COMMS-RECIPIENT', '정확한 수신자·채널·발신 주체를 확인한다', 'recipient_resolution'),
    obligation('COMMS-FACTS', '사실·수치·약속·첨부와 근거가 일치한다', 'message_fact_check'),
    obligation('COMMS-ACTION', '수신자가 해야 할 행동·기한·회신 경로가 명확하다', 'recipient_action_contract'),
    obligation('COMMS-TONE', '관계·목적·민감도에 맞는 어조와 최소 공개 범위를 확인한다', 'tone_and_disclosure_review'),
    obligation('COMMS-DELIVERY', '초안·승인·발송·수신·성과를 분리해 증거를 남긴다', 'delivery_state_evidence')
  ])
});

function obligation(id, statement, evidence, condition = 'always') {
  return Object.freeze({ id, statement, evidence_required: evidence, condition });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function dateTimeEpoch(value) {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) return Number.NaN;
  return Date.parse(value);
}

function unsupportedFields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['INVALID_OBJECT'];
  return Object.keys(value).filter(key => !allowed.has(key)).sort();
}

const PROOF_RECEIPT_FIELDS = new Set([
  'receipt_id', 'obligation_id', 'task_id', 'project', 'subject_revision',
  'requirement_set_digest', 'source_revision_set_digest',
  'capability_revision_set_digest', 'policy_revision', 'result',
  'executed_checks', 'failures', 'skips', 'verifier', 'verified_at', 'artifact_ref',
  'execution_ref', 'requirement_receipts', 'evidence_refs'
]);
const REQUIREMENT_RECEIPT_FIELDS = new Set([
  'requirement_id', 'requirement_fingerprint', 'mode', 'result',
  'executed_checks', 'failures', 'skips', 'verifier', 'verified_at', 'evidence_refs'
]);
const EVIDENCE_POINTER_FIELDS = new Set([
  'location', 'revision_or_sha', 'observed_at'
]);

function normalizedRequirement(entry, index) {
  const text = typeof entry === 'string' ? entry.trim() : String(entry?.text ?? '').trim();
  if (!text) throw new Error(`done_when[${index}] must contain text`);
  const requestedMode = typeof entry === 'object' ? entry?.mode : null;
  const mode = requestedMode === 'required' || !requestedMode ? 'automated' : String(requestedMode);
  if (!['automated', 'manual', 'external'].includes(mode)) {
    throw new Error(`done_when[${index}] has unsupported verification mode: ${mode}`);
  }
  const requirement = {
    id: typeof entry === 'object' && entry?.id
      ? String(entry.id)
      : `REQ-${String(index + 1).padStart(3, '0')}`,
    text,
    mode,
    required: typeof entry === 'object' ? entry?.required !== false : true
  };
  return {
    ...requirement,
    fingerprint: `sha256:${sha256(JSON.stringify(requirement))}`
  };
}

export function buildRequirementSet(task) {
  const requirements = (task?.done_when ?? []).map(normalizedRequirement);
  const ids = requirements.map(item => item.id);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  const taskContract = {
    task_id: task?.task_id ?? null,
    project: task?.project ?? null,
    project_ref: task?.project_ref ?? null,
    goal: String(task?.goal ?? '').trim(),
    desired_outcome: task?.desired_outcome ?? null,
    constraints: Array.isArray(task?.constraints) ? task.constraints.map(String) : [],
    domain: task?.domain ?? null,
    applicable_domains: effectiveDomains(task),
    risk: effectiveRisk(task),
    authority_required: task?.authority_required === true,
    external_effect: task?.external_effect ?? 'unknown'
  };
  const canonical = JSON.stringify({
    task_contract: taskContract,
    requirements
  });
  return {
    requirements,
    digest: `sha256:${sha256(canonical)}`,
    task_contract_digest: `sha256:${sha256(JSON.stringify(taskContract))}`,
    duplicate_ids: duplicateIds,
    status: duplicateIds.length ? 'HOLD' : requirements.length ? 'DEFINED' : 'HOLD'
  };
}

function buildRevisionSet(items = [], kind) {
  if (!Array.isArray(items)) throw new Error(`${kind}_revision_set must be an array`);
  const normalized = items.map(item => {
    if (kind === 'source') {
      return {
        system: item?.system ?? null,
        kind: item?.kind ?? null,
        location: item?.location ?? null,
        revision_or_sha: item?.revision_or_sha ?? null,
        observed_at: item?.observed_at ?? null
      };
    }
    return {
      id: item?.id ?? null,
      scope: item?.scope ?? null,
      location: item?.source?.locator ?? item?.location ?? null,
      revision_or_sha: item?.source?.revision_or_sha ?? item?.revision_or_sha ?? null
    };
  }).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return {
    items: normalized,
    digest: `sha256:${sha256(JSON.stringify(normalized))}`
  };
}

export function buildSourceRevisionSet(items = []) {
  return buildRevisionSet(items, 'source');
}

export function buildCapabilityRevisionSet(items = []) {
  return buildRevisionSet(items, 'capability');
}

export function proofObligationsFor(task) {
  const domains = effectiveDomains(task);
  const obligations = [...UNIVERSAL_OBLIGATIONS];
  for (const domain of domains) {
    const domainItems = DOMAIN_OBLIGATIONS[domain];
    if (!domainItems) throw new Error(`unsupported proof domain: ${domain ?? 'missing'}`);
    obligations.push(...domainItems);
  }
  return [...new Map(obligations.map(item => [item.id, item])).values()]
    .map(item => ({ ...item }));
}

function pointerIsVersioned(pointer, evaluationEpoch = Date.now()) {
  if (unsupportedFields(pointer, EVIDENCE_POINTER_FIELDS).length) return false;
  const location = typeof pointer?.location === 'string' ? pointer.location.trim() : '';
  const revision = typeof pointer?.revision_or_sha === 'string'
    ? pointer.revision_or_sha.trim()
    : '';
  const observedAt = typeof pointer?.observed_at === 'string'
    ? pointer.observed_at.trim()
    : '';
  const observedEpoch = dateTimeEpoch(observedAt);
  if (observedAt && (Number.isNaN(observedEpoch) || observedEpoch > evaluationEpoch)) return false;
  return Boolean(location && (revision || observedAt));
}

function receiptIssues(receipt, contract, knownObligations, evaluationEpoch) {
  const issues = [];
  if (unsupportedFields(receipt, PROOF_RECEIPT_FIELDS).length) {
    issues.push('RECEIPT_SHAPE_OR_FIELDS_INVALID');
  }
  if (typeof receipt?.receipt_id !== 'string' || !receipt.receipt_id.trim()) {
    issues.push('RECEIPT_ID_MISSING_OR_INVALID');
  }
  if (!knownObligations.has(receipt?.obligation_id)) issues.push('ORPHANED_OBLIGATION');
  if (receipt?.task_id !== contract.task_id) issues.push('WRONG_TASK');
  if ((receipt?.project ?? null) !== (contract.project ?? null)) issues.push('WRONG_PROJECT');
  if (!contract.subject_revision || receipt?.subject_revision !== contract.subject_revision) {
    issues.push('STALE_OR_MISSING_SUBJECT_REVISION');
  }
  if (receipt?.requirement_set_digest !== contract.requirement_set.digest) {
    issues.push('STALE_REQUIREMENT_SET');
  }
  if (receipt?.source_revision_set_digest !== contract.source_revision_set.digest) {
    issues.push('STALE_SOURCE_REVISION_SET');
  }
  if (receipt?.capability_revision_set_digest !== contract.capability_revision_set.digest) {
    issues.push('STALE_CAPABILITY_REVISION_SET');
  }
  if (receipt?.policy_revision !== PROOF_POLICY_REVISION) issues.push('STALE_POLICY_REVISION');
  if (!['PASS', 'FAIL', 'PARTIAL', 'SKIPPED', 'UNKNOWN'].includes(receipt?.result)) {
    issues.push('INVALID_RESULT');
  }
  if (receipt?.result === 'SKIPPED') issues.push('SKIPPED_CHECK');
  if (receipt?.result === 'UNKNOWN') issues.push('UNKNOWN_RESULT');
  if (!Number.isInteger(receipt?.executed_checks) || receipt.executed_checks <= 0) {
    issues.push('ZERO_OR_UNKNOWN_EXECUTION');
  }
  if (!Number.isInteger(receipt?.failures) || receipt.failures < 0) {
    issues.push('FAILURE_COUNT_MISSING_OR_INVALID');
  }
  if (!Number.isInteger(receipt?.skips) || receipt.skips < 0) {
    issues.push('SKIP_COUNT_MISSING_OR_INVALID');
  }
  if (receipt?.result === 'PASS' && (receipt.failures !== 0 || receipt.skips !== 0)) {
    issues.push('PASS_WITH_FAILURE_OR_SKIP');
  }
  if (typeof receipt?.verifier !== 'string' || !receipt.verifier.trim()) {
    issues.push('VERIFIER_MISSING_OR_INVALID');
  }
  const verifiedAt = dateTimeEpoch(receipt?.verified_at);
  if (Number.isNaN(verifiedAt)) {
    issues.push('VERIFIED_AT_MISSING_OR_INVALID');
  } else if (verifiedAt > evaluationEpoch) {
    issues.push('FUTURE_VERIFICATION_TIMESTAMP');
  }
  if (!pointerIsVersioned(receipt?.artifact_ref, evaluationEpoch)) {
    issues.push('ARTIFACT_REF_MISSING_OR_INVALID');
  }
  if (contract.subject_revision && receipt?.artifact_ref?.revision_or_sha !== contract.subject_revision) {
    issues.push('ARTIFACT_REVISION_MISMATCH');
  }
  if (!pointerIsVersioned(receipt?.execution_ref, evaluationEpoch)) {
    issues.push('EXECUTION_REF_MISSING_OR_INVALID');
  }
  if (
    !Array.isArray(receipt?.evidence_refs)
    || receipt.evidence_refs.length === 0
    || receipt.evidence_refs.some(pointer => !pointerIsVersioned(pointer, evaluationEpoch))
  ) {
    issues.push('VERSIONED_EVIDENCE_MISSING_OR_INVALID');
  }
  return issues;
}

function traceabilityEvaluation(receipt, requirementSet, evaluationEpoch) {
  if (receipt?.obligation_id !== 'CORE-REQ-TRACEABILITY') {
    return { issues: [], partial_reasons: [] };
  }
  const bindings = Array.isArray(receipt.requirement_receipts)
    ? receipt.requirement_receipts
    : [];
  const covered = bindings.map(item => item?.requirement_id).filter(Boolean);
  const known = requirementSet.requirements.map(item => item.id);
  const expectedAutomated = requirementSet.requirements
    .filter(item => item.required && item.mode === 'automated')
    .map(item => item.id);
  const duplicate = covered.filter((id, index) => covered.indexOf(id) !== index);
  const missing = expectedAutomated.filter(id => !covered.includes(id));
  const orphaned = covered.filter(id => !known.includes(id));
  const issues = [
    ...(duplicate.length ? ['DUPLICATE_REQUIREMENT_COVERAGE'] : []),
    ...(missing.length ? ['UNCOVERED_REQUIREMENT'] : []),
    ...(orphaned.length ? ['ORPHANED_REQUIREMENT_COVERAGE'] : [])
  ];
  const partialReasons = [];

  for (const requirement of requirementSet.requirements) {
    const binding = bindings.find(item => item?.requirement_id === requirement.id);
    if (!binding) {
      if (requirement.required && requirement.mode === 'manual') {
        partialReasons.push(`MANUAL_CONFIRMATION_PENDING:${requirement.id}`);
      }
      if (requirement.required && requirement.mode === 'external') {
        partialReasons.push(`EXTERNAL_EVIDENCE_PENDING:${requirement.id}`);
      }
      continue;
    }
    if (unsupportedFields(binding, REQUIREMENT_RECEIPT_FIELDS).length) {
      issues.push('REQUIREMENT_RECEIPT_SHAPE_OR_FIELDS_INVALID');
    }
    if (binding.requirement_fingerprint !== requirement.fingerprint) {
      issues.push('STALE_REQUIREMENT_FINGERPRINT');
    }
    if (binding.mode !== requirement.mode) issues.push('WRONG_VERIFICATION_MODE');
    if (typeof binding.verifier !== 'string' || !binding.verifier.trim()) {
      issues.push('REQUIREMENT_VERIFIER_MISSING_OR_INVALID');
    }
    const verifiedAt = dateTimeEpoch(binding.verified_at);
    if (Number.isNaN(verifiedAt)) {
      issues.push('REQUIREMENT_VERIFIED_AT_MISSING_OR_INVALID');
    } else if (verifiedAt > evaluationEpoch) {
      issues.push('REQUIREMENT_FUTURE_VERIFICATION_TIMESTAMP');
    }
    if (
      !Array.isArray(binding.evidence_refs)
      || binding.evidence_refs.length === 0
      || binding.evidence_refs.some(pointer => !pointerIsVersioned(pointer, evaluationEpoch))
    ) {
      issues.push('REQUIREMENT_EVIDENCE_MISSING_OR_INVALID');
    }
    if (binding.result === 'FAIL') {
      issues.push('FAILED_REQUIREMENT');
      continue;
    }
    if (requirement.mode === 'automated') {
      if (binding.result !== 'PASS') issues.push('AUTOMATED_REQUIREMENT_NOT_PASS');
      if (!Number.isInteger(binding.executed_checks) || binding.executed_checks <= 0) {
        issues.push('REQUIREMENT_ZERO_OR_UNKNOWN_EXECUTION');
      }
      if (!Number.isInteger(binding.failures) || binding.failures < 0) {
        issues.push('REQUIREMENT_FAILURE_COUNT_MISSING_OR_INVALID');
      }
      if (!Number.isInteger(binding.skips) || binding.skips < 0) {
        issues.push('REQUIREMENT_SKIP_COUNT_MISSING_OR_INVALID');
      }
      if (binding.result === 'PASS' && (binding.failures !== 0 || binding.skips !== 0)) {
        issues.push('REQUIREMENT_PASS_WITH_FAILURE_OR_SKIP');
      }
    } else if (requirement.mode === 'manual' && binding.result !== 'CONFIRMED') {
      partialReasons.push(`MANUAL_CONFIRMATION_PENDING:${requirement.id}`);
    } else if (requirement.mode === 'external' && binding.result !== 'EVIDENCED') {
      partialReasons.push(`EXTERNAL_EVIDENCE_PENDING:${requirement.id}`);
    }
  }

  return {
    issues: [...new Set(issues)],
    partial_reasons: [...new Set(partialReasons)]
  };
}

export function evaluateProofGate(contract, receipts = [], { requested = false } = {}) {
  if (!requested) {
    return {
      status: 'NOT_EVALUATED',
      reason: 'Preflight contract only; verification receipts were not requested',
      pass_is_bound_to_revision: true
    };
  }

  const knownObligations = new Set(contract.obligations.map(item => item.id));
  const evaluationEpoch = dateTimeEpoch(contract.evaluation_time);
  const receiptIds = receipts.map(item => item?.receipt_id).filter(Boolean);
  const obligationIds = receipts.map(item => item?.obligation_id).filter(Boolean);
  const issues = [];
  if (Number.isNaN(evaluationEpoch)) issues.push('EVALUATION_TIME_INVALID');
  if (new Set(receiptIds).size !== receiptIds.length) issues.push('DUPLICATE_RECEIPT_ID');
  if (new Set(obligationIds).size !== obligationIds.length) issues.push('DUPLICATE_OBLIGATION_RECEIPT');
  if (contract.requirement_set.status !== 'DEFINED') issues.push('REQUIREMENT_SET_INVALID');
  if (!contract.subject_revision) issues.push('SUBJECT_REVISION_UNRESOLVED');

  const evaluated = receipts.map(receipt => {
    const traceability = traceabilityEvaluation(
      receipt,
      contract.requirement_set,
      evaluationEpoch
    );
    const receiptIssueSet = [...new Set([
      ...receiptIssues(receipt, contract, knownObligations, evaluationEpoch),
      ...traceability.issues
    ])];
    return {
      receipt_id: receipt?.receipt_id ?? null,
      obligation_id: receipt?.obligation_id ?? null,
      result: receipt?.result ?? 'UNKNOWN',
      status: receiptIssueSet.length
        ? 'HOLD'
        : traceability.partial_reasons.length || receipt?.result === 'PARTIAL'
          ? 'PARTIAL'
          : receipt.result,
      issues: receiptIssueSet,
      partial_reasons: traceability.partial_reasons
    };
  });

  const covered = new Set(receipts.map(item => item?.obligation_id));
  const missingObligations = contract.obligations
    .filter(item => !covered.has(item.id))
    .map(item => item.id);
  if (missingObligations.length) issues.push('UNCOVERED_OBLIGATION');
  if (evaluated.some(item => (
    item.result === 'FAIL' || item.issues.includes('FAILED_REQUIREMENT')
  ))) issues.push('FAILED_CHECK');
  if (evaluated.some(item => item.issues.length)) issues.push('INVALID_OR_STALE_RECEIPT');
  const partialReasons = evaluated.flatMap(item => item.partial_reasons);
  if (evaluated.some(item => item.status === 'PARTIAL')) issues.push('PARTIAL_VERIFICATION');

  const uniqueIssues = [...new Set(issues)];
  return {
    status: uniqueIssues.includes('FAILED_CHECK')
      ? 'FAIL'
      : uniqueIssues.length === 1 && uniqueIssues[0] === 'PARTIAL_VERIFICATION'
        ? 'PARTIAL'
      : uniqueIssues.length
        ? 'HOLD'
        : 'PASS',
    policy_revision: PROOF_POLICY_REVISION,
    issues: uniqueIssues,
    missing_obligations: missingObligations,
    partial_reasons: partialReasons,
    evaluated_receipts: evaluated,
    bound_to: {
      task_id: contract.task_id,
      project: contract.project,
      subject_revision: contract.subject_revision,
      requirement_set_digest: contract.requirement_set.digest,
      source_revision_set_digest: contract.source_revision_set.digest,
      capability_revision_set_digest: contract.capability_revision_set.digest
    },
    pass_is_bound_to_revision: true
  };
}

export function compileProofContract(task, {
  subjectRevision = null,
  sourceRevisionSet = [],
  capabilityRevisionSet = [],
  receipts = [],
  evaluationRequested = false,
  currentTime = new Date().toISOString()
} = {}) {
  const evaluationEpoch = dateTimeEpoch(currentTime);
  if (Number.isNaN(evaluationEpoch)) throw new Error('currentTime must be a valid date-time');
  const contract = {
    policy_revision: PROOF_POLICY_REVISION,
    evaluation_time: new Date(evaluationEpoch).toISOString(),
    task_id: task.task_id,
    project: task.project,
    domain: task.domain,
    applicable_domains: effectiveDomains(task),
    subject_revision: subjectRevision,
    requirement_set: buildRequirementSet(task),
    source_revision_set: buildSourceRevisionSet(sourceRevisionSet),
    capability_revision_set: buildCapabilityRevisionSet(capabilityRevisionSet),
    obligations: proofObligationsFor(task),
    epistemic_limit: 'Structural PASS does not prove legal correctness, business impact, deployment, or source freshness beyond bound evidence'
  };
  return {
    ...contract,
    gate: evaluateProofGate(contract, receipts, { requested: evaluationRequested })
  };
}

export function evaluateTruthStates(states = {}, currentRevision = null, {
  currentTime = new Date().toISOString()
} = {}) {
  const issues = [];
  const evaluationEpoch = Date.parse(currentTime);
  if (Number.isNaN(evaluationEpoch)) issues.push('EVALUATION_TIME_INVALID');
  const artifact = states.artifact ?? { state: 'ABSENT' };
  const verification = states.verification ?? { state: 'NOT_RUN' };
  const authorization = states.authorization ?? { state: 'NOT_GRANTED' };
  const execution = states.execution ?? { state: 'NOT_RUN' };
  const outcome = states.outcome ?? { state: 'UNMEASURED' };

  if (verification.state === 'PASS') {
    if (artifact.state !== 'CREATED') issues.push('VERIFIED_WITHOUT_ARTIFACT');
    if (!verification.revision || verification.revision !== artifact.revision) {
      issues.push('VERIFICATION_REVISION_MISMATCH');
    }
    if (!Number.isInteger(verification.executed_checks) || verification.executed_checks <= 0) {
      issues.push('ZERO_RUN_PASS');
    }
    if (!Number.isInteger(verification.failures) || verification.failures < 0) {
      issues.push('FAILURE_COUNT_MISSING_OR_INVALID');
    }
    if (!Number.isInteger(verification.skips) || verification.skips < 0) {
      issues.push('SKIP_COUNT_MISSING_OR_INVALID');
    }
    if (verification.failures !== 0 || verification.skips !== 0) {
      issues.push('PASS_WITH_FAILURE_OR_SKIP');
    }
  }
  if (currentRevision && verification.state === 'PASS' && verification.revision !== currentRevision) {
    issues.push('PASS_IS_STALE');
  }
  if (
    authorization.state === 'GRANTED'
    && !pointerIsVersioned(authorization.evidence_ref, evaluationEpoch)
  ) {
    issues.push('AUTHORIZATION_EVIDENCE_MISSING');
  }
  if (execution.state === 'SUCCEEDED') {
    if (!['GRANTED', 'NOT_REQUIRED'].includes(authorization.state)) {
      issues.push('EXECUTED_WITHOUT_AUTHORITY');
    }
    if (!pointerIsVersioned(execution.evidence_ref, evaluationEpoch)) {
      issues.push('EXECUTION_EVIDENCE_MISSING');
    }
  }
  if (outcome.state === 'IMPROVED') {
    if (execution.state !== 'SUCCEEDED') issues.push('OUTCOME_WITHOUT_EXECUTION');
    if (!Number.isFinite(outcome.baseline) || !Number.isFinite(outcome.measured)) {
      issues.push('OUTCOME_COMPARISON_MISSING');
    }
    if (!['higher', 'lower'].includes(outcome.better_when)) {
      issues.push('OUTCOME_DIRECTION_MISSING');
    } else if (
      Number.isFinite(outcome.baseline)
      && Number.isFinite(outcome.measured)
      && (
        (outcome.better_when === 'higher' && outcome.measured <= outcome.baseline)
        || (outcome.better_when === 'lower' && outcome.measured >= outcome.baseline)
      )
    ) {
      issues.push('CLAIMED_IMPROVEMENT_NOT_OBSERVED');
    }
    if (!pointerIsVersioned(outcome.evidence_ref, evaluationEpoch)) {
      issues.push('OUTCOME_EVIDENCE_MISSING');
    }
  }

  return {
    status: issues.length ? 'HOLD' : 'CONSISTENT',
    states: { artifact, verification, authorization, execution, outcome },
    issues: [...new Set(issues)]
  };
}
