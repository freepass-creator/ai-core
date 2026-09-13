import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  orchestrate,
  executionRoute,
  inferApplicableDomains,
  normalizeTask
} from '../src/core.mjs';

function statementDigest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

const resolvedSources = [
  { system: 'project', kind: 'instructions', status: 'authoritative', location: 'freepass-creator/ai-core:AGENTS.md', revision_or_sha: 'project-sha' },
  { system: 'aiops', kind: 'control', status: 'authoritative', location: 'freepass-creator/aiops:docs/CONTROL_PLANE.md', revision_or_sha: 'control-sha' },
  { system: 'aiops', kind: 'knowledge', status: 'authoritative', location: 'freepass-creator/aiops:docs/aiknowhow/README.md', revision_or_sha: 'knowledge-sha' },
  { system: 'devcenter', kind: 'registry', status: 'authoritative', location: 'freepass-creator/devcenter:registry.json', revision_or_sha: 'registry-sha' },
  { system: 'devcenter', kind: 'inspection', status: 'authoritative', location: 'freepass-creator/devcenter:operations/inspection/POLICY.md', revision_or_sha: 'inspection-sha' }
];
const devcenterRegistry = {
  datasets: [
    ['dev.repo.lifecycle', 'repo'],
    ['dev.design.token', 'token'],
    ['dev.design.atom', 'atom'],
    ['dev.design.atom.product_card', 'product-card']
  ].map(([scope, id]) => ({
    id,
    scope,
    role: 'authoritative',
    source: { locator: `repo/${id}.md`, revision_or_sha: `${id}-sha` }
  }))
};
const resolvedEnvironment = {
  subject_revision: 'subject-commit-sha',
  resolved_sources: resolvedSources,
  devcenter_registry: devcenterRegistry
};

test('small bounded development is READY only with pinned sources and capabilities', () => {
  const output = orchestrate({
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 요구사항과 일치'],
    external_effect: 'none',
    changed_files_estimate: 2
  }, resolvedEnvironment);
  assert.equal(output.execution.route, 'GPT_DIRECT');
  assert.equal(output.status, 'READY');
  assert.equal(
    output.human_orchestration.evaluation_time,
    output.assurance.evaluation_time
  );
  assert.equal(output.execution_authorized, false);
  assert.ok(output.work_packet.proactive_review_lenses.includes('security_privacy_and_authority'));
  assert.equal(output.evolution.status, 'NO_SIGNAL');
});

test('offline planning holds instead of claiming missing live sources are ready', () => {
  const output = orchestrate({
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 요구사항과 일치']
  });
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('SOURCE_HOLD'));
  assert.ok(output.holds.includes('CAPABILITY_UNRESOLVED'));
  assert.ok(output.holds.includes('SUBJECT_REVISION_UNRESOLVED'));
  assert.equal(output.evolution.status, 'NO_SIGNAL');
});

test('build loop routes WORK_CODEX', () => {
  const task = normalizeTask({
    goal: 'ERP 검색 기능 개발',
    project: 'freepasserp4',
    done_when: ['build pass'],
    external_effect: 'none',
    needs_build: true
  });
  assert.equal(executionRoute(task).route, 'WORK_CODEX');
});

test('risk C requires Claude design gate', () => {
  const task = normalizeTask({ goal: '새 업무 흐름 개발', risk: 'C', external_effect: 'none' });
  const route = executionRoute(task);
  assert.equal(route.route, 'HUMAN_GATE');
  assert.deepEqual(route.required_approvals, ['CLAUDE_DESIGN']);
});

test('external effect requires all live-action gates after context resolves', () => {
  const output = orchestrate({
    goal: '운영 데이터 변경',
    project: 'aiops',
    done_when: ['verified'],
    risk: 'D',
    external_effect: 'sheet_write'
  }, {
    ...resolvedEnvironment,
    resolved_sources: resolvedSources.map(source => (
      source.system === 'project'
        ? { ...source, location: 'freepass-creator/aiops:AGENTS.md' }
        : source
    ))
  });
  assert.equal(output.execution.route, 'HUMAN_GATE');
  assert.equal(output.status, 'APPROVAL_REQUIRED');
  assert.deepEqual(output.execution.required_approvals, [
    'CLAUDE_DESIGN',
    'CLAUDE_FINAL',
    'USER_JUST_IN_TIME'
  ]);
  assert.equal(output.execution_authorized, false);
});

test('unresolved development project is HOLD', () => {
  const output = orchestrate({ goal: '웹 UI 개발', done_when: ['done'] });
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('PROJECT_UNRESOLVED'));
});

test('missing done_when is HOLD', () => {
  const output = orchestrate({ goal: 'ERP 기능 개발', project: 'freepasserp4' });
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('DONE_WHEN_UNSPECIFIED'));
});

test('duplicate completion IDs hold before proof evaluation is requested', () => {
  const output = orchestrate({
    task_id: 'DUPLICATE-DONE-WHEN',
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    external_effect: 'none',
    done_when: [
      { id: 'SAME', text: '검사 A' },
      { id: 'SAME', text: '검사 B' }
    ]
  }, resolvedEnvironment);
  assert.equal(output.assurance.requirement_set.status, 'HOLD');
  assert.deepEqual(output.assurance.requirement_set.duplicate_ids, ['SAME']);
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('REQUIREMENT_SET_INVALID'));
});

test('legal work defaults to risk C and cannot proceed without current authority', () => {
  const output = orchestrate({
    task_id: 'LEGAL-1',
    goal: '준비서면 법률 검토',
    done_when: ['쟁점별 근거가 확인됨']
  }, {
    resolved_sources: resolvedSources
  });
  assert.equal(output.task.domain, 'legal');
  assert.equal(output.task.risk, 'C');
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('SOURCE_HOLD'));
  assert.ok(output.execution.required_approvals.includes('RESPONSIBLE_HUMAN_FINAL_REVIEW'));
  assert.ok(output.work_packet.proactive_review_lenses.includes(
    'fact_evidence_opponent_claim_inference_authority_uncertainty'
  ));
});

test('mixed legal-development work composes both safety overlays', () => {
  assert.deepEqual(
    inferApplicableDomains('소송 자료 관리 웹 기능 개발'),
    ['legal', 'development']
  );
  const output = orchestrate({
    task_id: 'LEGAL-DEV-1',
    goal: '소송 자료 관리 웹 기능 개발',
    project: 'legal-app',
    done_when: ['권한별 자료 접근이 검증됨'],
    external_effect: 'none',
    risk: 'A'
  }, resolvedEnvironment);

  assert.equal(output.task.domain, 'legal');
  assert.deepEqual(output.task.applicable_domains, ['legal', 'development']);
  assert.equal(output.task.risk, 'C');
  assert.equal(output.task.risk_adjustment, 'LEGAL_MINIMUM_C');
  assert.deepEqual(output.execution.required_approvals, [
    'CLAUDE_DESIGN',
    'RESPONSIBLE_HUMAN_FINAL_REVIEW'
  ]);
  assert.ok(output.source_requirements.some(item => (
    item.system === 'domain' && item.kind === 'current_authority' && item.required
  )));
  assert.ok(output.requested_capability_scopes.includes('dev.repo.lifecycle'));
  assert.ok(output.assurance.obligations.some(item => item.id === 'LEGAL-CURRENT-AUTHORITY'));
  assert.ok(output.assurance.obligations.some(item => item.id === 'DEV-SECURITY'));
  assert.ok(output.work_packet.proactive_review_lenses.includes(
    'current_official_law_and_case_authority'
  ));
  assert.ok(output.work_packet.proactive_review_lenses.includes(
    'security_privacy_and_authority'
  ));
  assert.ok(output.holds.includes('SOURCE_HOLD'));
});

test('common Korean and English regulated-development goals retain legal protection', () => {
  for (const goal of [
    '근로자 해고 절차 웹 기능',
    '개인정보 동의 관리 웹 기능',
    '계약서 자동화 앱 개발',
    'Build a GDPR compliance web app',
    'Contract termination workflow API'
  ]) {
    const task = normalizeTask({ goal, external_effect: 'none' });
    assert.ok(task.applicable_domains.includes('legal'), goal);
    assert.ok(task.applicable_domains.includes('development'), goal);
    assert.equal(task.risk, 'C', goal);
    assert.ok(
      executionRoute(task).required_approvals.includes('RESPONSIBLE_HUMAN_FINAL_REVIEW'),
      goal
    );
  }
});

test('short English technical hints do not match inside ordinary business words', () => {
  for (const goal of [
    'Build a revenue forecast',
    'Create a capital allocation plan',
    'Prepare an equity analysis'
  ]) {
    const task = normalizeTask({ goal, external_effect: 'none' });
    assert.deepEqual(task.applicable_domains, ['business'], goal);
    assert.equal(task.domain, 'business', goal);
  }
});

test('public routing helper cannot remove primary legal protections with an empty overlay', () => {
  const route = executionRoute({
    goal: '법률 검토',
    domain: 'legal',
    applicable_domains: [],
    risk: 'A',
    external_effect: 'none'
  });
  assert.deepEqual(route.required_approvals, [
    'CLAUDE_DESIGN',
    'RESPONSIBLE_HUMAN_FINAL_REVIEW'
  ]);
});

test('declared domain overlays are additive and cannot be discarded during normalization', () => {
  const task = normalizeTask({
    goal: 'Create a workflow',
    domain: 'development',
    applicable_domains: ['legal'],
    risk: 'A',
    external_effect: 'none'
  });
  assert.deepEqual(task.applicable_domains, ['development', 'legal']);
  assert.equal(task.risk, 'C');
  assert.deepEqual(executionRoute(task).required_approvals, [
    'CLAUDE_DESIGN',
    'RESPONSIBLE_HUMAN_FINAL_REVIEW'
  ]);
  assert.throws(
    () => normalizeTask({
      goal: 'Create a workflow',
      applicable_domains: 'legal',
      external_effect: 'none'
    }),
    /applicable_domains must be an array/
  );
});

test('communication work gets recipient, delivery and outcome separation', () => {
  const output = orchestrate({
    task_id: 'COMMS-1',
    goal: '고객에게 안내 이메일 초안 작성',
    domain: 'communication',
    done_when: ['수신자 행동이 명확함']
  }, {
    resolved_sources: resolvedSources
  });
  assert.ok(output.work_packet.proactive_review_lenses.includes(
    'sender_recipient_channel_and_authority'
  ));
  assert.ok(output.assurance.obligations.some(item => item.id === 'COMMS-DELIVERY'));
});

test('sanitized conversation lessons become non-adopted improvement candidates', () => {
  const output = orchestrate({
    task_id: 'LEARN-1',
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 일치']
  }, {
    ...resolvedEnvironment,
    conversation_observations: [{
      observation_id: 'OBS-1',
      rule_key: 'preview-before-code',
      summary: 'Visual changes need a reviewed preview before coding',
      expected_behavior: 'Require approved preview or explicit waiver',
      domains: ['development'],
      authority: 'user_directive',
      source_ref: {
        location: 'conversation:opaque#message-1',
        observed_at: '2026-09-13T10:00:00Z'
      },
      sanitized: true
    }]
  });
  assert.equal(output.learning.status, 'LEARNING_CANDIDATES');
  assert.equal(output.work_packet.learning_contract.raw_conversation_stored, false);
  const candidate = output.evolution.candidates.find(item => item.kind === 'conversation_lesson');
  assert.equal(candidate.target_system, 'devcenter');
  assert.equal(candidate.auto_adopted, false);
});

test('requested proof evaluation holds on missing receipts', () => {
  const output = orchestrate({
    task_id: 'PROOF-1',
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 일치']
  }, {
    ...resolvedEnvironment,
    proof_evaluation_requested: true
  });
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('PROOF_GATE_HOLD'));
  assert.equal(output.assurance.gate.status, 'HOLD');
});

test('malformed proof controls cannot silently disable proof evaluation', () => {
  const output = orchestrate({
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 일치'],
    external_effect: 'none'
  }, {
    ...resolvedEnvironment,
    proof_receipts: { receipt_id: 'NOT-AN-ARRAY' },
    proof_evaluation_requested: 'false'
  });
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('PROOF_INPUT_REJECTED'));
  assert.equal(output.assurance.gate.status, 'HOLD');
  assert.deepEqual(output.input_issues.proof, [
    'proof_receipts must be an array',
    'proof_evaluation_requested must be a boolean'
  ]);
});

test('invalid conversation learning input cannot be silently ignored', () => {
  const output = orchestrate({
    task_id: 'LEARN-BAD',
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 일치']
  }, {
    ...resolvedEnvironment,
    conversation_observations: [{
      observation_id: 'OBS-BAD',
      rule_key: 'raw-copy',
      summary: 'bad input',
      expected_behavior: 'copy everything',
      domains: ['development'],
      authority: 'assistant_inference',
      source_ref: { location: 'conversation:opaque', observed_at: '2026-09-13T10:00:00Z' },
      raw_content: 'must not be stored',
      sanitized: true
    }]
  });
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('LEARNING_INPUT_REJECTED'));
  assert.equal(JSON.stringify(output).includes('must not be stored'), false);
});

test('a rejected improvement observation holds the whole Core result', () => {
  const secretSignalId = 'private-customer-reference-123';
  const output = orchestrate({
    task_id: 'EVOLUTION-BAD',
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 일치'],
    external_effect: 'none',
    allowed_scope: ['path:notes/**'],
    forbidden_scope: ['path:secrets/**'],
    proposed_actions: [{
      id: 'PREPARE-EVOLUTION-REVIEW',
      description: '거부된 개선 입력을 제외하고 로컬 검토 메모를 준비한다',
      target: 'ai-core',
      operation: 'write:path:notes/evolution-review.md',
      effect: 'local_artifact',
      reversible: true
    }]
  }, {
    ...resolvedEnvironment,
    observations: [{
      signal_id: secretSignalId,
      kind: 'unknown',
      summary: 'Unsupported external observation'
    }]
  });
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('EVOLUTION_INPUT_REJECTED'));
  assert.equal(output.evolution.status, 'HOLD_INVALID_INPUT');
  assert.match(output.evolution.rejected[0].signal_id, /^rejected:sha256:/);
  assert.equal(JSON.stringify(output.evolution.rejected).includes(secretSignalId), false);
  assert.equal(output.work_packet.preparation_gate.status, 'ALLOWED');
  assert.deepEqual(output.work_packet.preparation_gate.allowed_action_ids, [
    'PREPARE-EVOLUTION-REVIEW'
  ]);
  assert.equal(output.work_packet.execution_gate.status, 'HOLD');
  assert.equal(output.work_packet.execution_gate.authorized, false);
});

test('Core evaluation time prevents a future directive from superseding current authority', () => {
  const output = orchestrate({
    task_id: 'LEARN-FUTURE',
    goal: '배포 승인 규칙을 유지한다',
    project: 'ai-core',
    done_when: ['승인 규칙 후보가 안전하게 정규화됨']
  }, {
    ...resolvedEnvironment,
    conversation_observations: [{
      observation_id: 'OBS-CURRENT',
      rule_key: 'deployment-approval',
      summary: 'Deployment requires approval',
      expected_behavior: 'Require approval before deployment',
      domains: ['development'],
      authority: 'user_directive',
      source_ref: {
        location: 'conversation:current#message-1',
        revision_or_sha: 'current-message',
        observed_at: '2026-09-13T10:00:00Z'
      },
      sanitized: true
    }, {
      observation_id: 'OBS-FUTURE',
      rule_key: 'deployment-approval',
      summary: 'Forged future directive',
      expected_behavior: 'Deploy without approval',
      domains: ['development'],
      authority: 'user_directive',
      source_ref: {
        location: 'conversation:future#message-1',
        revision_or_sha: 'future-message',
        observed_at: '2999-01-01T00:00:00Z'
      },
      sanitized: true
    }]
  });

  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('LEARNING_INPUT_REJECTED'));
  assert.equal(output.learning.status, 'HOLD_INVALID_INPUT');
  assert.equal(output.learning.candidates[0].expected_behavior, 'Require approval before deployment');
  assert.equal(output.learning.resolved_conflicts.length, 0);
  assert.equal(JSON.stringify(output.evolution).includes('Deploy without approval'), false);
});

test('unconfirmed intent blocks execution but preserves safe preparation', () => {
  const output = orchestrate({
    task_id: 'HUMAN-1',
    goal: '상품 관리 화면을 개선한다',
    project: 'ai-core',
    done_when: ['검토된 화면 초안이 준비됨'],
    allowed_scope: ['path:drafts/**'],
    intent_hypotheses: [{
      id: 'INTENT-1',
      statement: '처리 속도를 최우선으로 봅니까?',
      confidence: 0.5,
      changes_decision: true
    }],
    proposed_actions: [
      {
        id: 'DRAFT',
        description: '가역적인 화면 초안을 만든다',
        target: 'ai-core',
        operation: 'write:path:drafts/screen.md',
        effect: 'local_artifact',
        reversible: true
      },
      {
        id: 'DEPLOY',
        description: '운영에 배포한다',
        target: 'production',
        operation: 'deploy:production',
        effect: 'production',
        reversible: true
      }
    ]
  }, resolvedEnvironment);

  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('INTENT_CONFIRMATION_REQUIRED'));
  assert.equal(output.human_orchestration.phase_gate.status, 'PREPARE_ONLY');
  assert.equal(output.work_packet.human_agency_contract.phase_gate.preparation_allowed, true);
  assert.deepEqual(
    output.work_packet.human_agency_contract.actions.prepare_now.map(item => item.id),
    ['DRAFT']
  );
  assert.deepEqual(
    output.work_packet.human_agency_contract.actions.approval_required.map(item => item.id),
    ['DEPLOY']
  );
  assert.equal(output.execution_authorized, false);
});

test('confirmed intent does not create an intent hold', () => {
  const task = {
    task_id: 'HUMAN-2',
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 요구사항과 일치'],
    external_effect: 'none',
    intent_hypotheses: [{
      id: 'INTENT-CONFIRMED',
      statement: 'PC 웹을 우선한다',
      confirmed: true,
      confirmation: {
        authority: 'user_directive',
        source_ref: {
          location: 'conversation:opaque#message-10',
          observed_at: '2026-09-13T12:00:00Z'
        }
      }
    }]
  };
  const provisional = orchestrate(task, {
    ...resolvedEnvironment
  });
  const hypothesis = provisional.human_orchestration.intent.hypotheses[0];
  const output = orchestrate(task, {
    ...resolvedEnvironment,
    verified_intent_confirmations: [{
      task_id: task.task_id,
      hypothesis_id: 'INTENT-CONFIRMED',
      statement_digest: statementDigest('PC 웹을 우선한다'),
      intent_context_digest: hypothesis.intent_context_digest,
      source_ref: {
        location: 'conversation:opaque#message-10',
        observed_at: '2026-09-13T12:00:00Z'
      }
    }]
  });

  assert.equal(output.status, 'READY');
  assert.equal(output.holds.includes('INTENT_CONFIRMATION_REQUIRED'), false);
  assert.equal(output.human_orchestration.intent.hypotheses[0].status, 'CONFIRMED');
});

test('revoked memory is excluded from the work packet', () => {
  const output = orchestrate({
    task_id: 'HUMAN-3',
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 요구사항과 일치']
  }, {
    ...resolvedEnvironment,
    revoked_memory_ids: ['OLD-PREFERENCE'],
    memory_claims: [
      {
        memory_id: 'OLD-PREFERENCE',
        rule_key: 'ui-priority-old',
        summary: '철회된 예전 선호',
        scope: 'LOCAL',
        state: 'ACTIVE',
        project: 'ai-core',
        authority: 'user_directive',
        sanitized: true,
        source_ref: {
          location: 'memory:opaque#old',
          observed_at: '2026-09-13T09:00:00Z'
        }
      },
      {
        memory_id: 'CURRENT-CONSTRAINT',
        rule_key: 'project-scope',
        summary: '현재 프로젝트 범위만 수정한다',
        scope: 'LOCAL',
        state: 'ACTIVE',
        project: 'ai-core',
        authority: 'user_directive',
        sanitized: true,
        source_ref: {
          location: 'memory:opaque#current',
          observed_at: '2026-09-13T12:00:00Z'
        }
      }
    ]
  });

  const memory = output.work_packet.human_agency_contract.memory;
  assert.deepEqual(memory.applicable.map(item => item.memory_id), ['CURRENT-CONSTRAINT']);
  assert.deepEqual(memory.excluded.map(item => item.memory_id), ['OLD-PREFERENCE']);
  assert.equal(memory.revoked_memory_applied, false);
});

test('invalid human context is a hold and does not leak raw memory', () => {
  const output = orchestrate({
    task_id: 'HUMAN-BAD',
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 요구사항과 일치']
  }, {
    ...resolvedEnvironment,
    memory_claims: [{
      memory_id: 'BAD-MEMORY',
      summary: '잘못된 원문 입력',
      scope: 'LOCAL',
      project: 'ai-core',
      raw_content: 'private memory must not escape',
      source_ref: {
        location: 'memory:opaque#bad',
        observed_at: '2026-09-13T12:00:00Z'
      }
    }]
  });

  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('HUMAN_CONTEXT_INPUT_REJECTED'));
  assert.equal(JSON.stringify(output).includes('private memory must not escape'), false);
});

test('a proposed consequential action requires approval even without task external_effect', () => {
  const output = orchestrate({
    task_id: 'HUMAN-ACTION-GATE',
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 요구사항과 일치'],
    allowed_scope: ['environment:production'],
    forbidden_scope: ['environment:unresolved'],
    proposed_actions: [{
      id: 'DEPLOY',
      description: '검토된 결과를 운영에 배포한다',
      target: 'ai-core-production',
      operation: 'deploy:production',
      effect: 'production',
      reversible: true
    }]
  }, resolvedEnvironment);

  assert.equal(output.status, 'APPROVAL_REQUIRED');
  assert.equal(output.human_orchestration.status, 'APPROVAL_REQUIRED');
  assert.equal(output.human_orchestration.phase_gate.execution_blocked, true);
  assert.equal(output.execution.route, 'HUMAN_GATE');
  assert.deepEqual(output.execution.approval_action_ids, ['DEPLOY']);
  assert.deepEqual(output.work_packet.approval_requirements, [
    'CLAUDE_DESIGN',
    'CLAUDE_FINAL',
    'USER_JUST_IN_TIME'
  ]);
  assert.equal(
    output.work_packet.execution_gate.approval_contracts[0].action_context_digest,
    output.work_packet.plan_slice.actions[0].action_context_digest
  );
  assert.equal(output.execution_authorized, false);
});

test('a typed portfolio change cannot proceed without scoped commitments', () => {
  const output = orchestrate({
    task_id: 'PORTFOLIO-IMPACT-GATE',
    goal: '업무 우선순위를 변경한다',
    domain: 'business',
    risk: 'A',
    external_effect: 'none',
    portfolio_effect: 'change_priority',
    done_when: ['관련 commitment가 확인된다']
  }, resolvedEnvironment);
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('PORTFOLIO_DISCOVERY_REQUIRED'));
  assert.equal(output.human_stewardship.portfolio_contract.status, 'NOT_DECLARED');
  assert.equal(output.work_packet.plan_slice.handoff_status, 'BLOCKED');
});

test('a local action without a repository identity is held before handoff', () => {
  const output = orchestrate({
    task_id: 'LOCAL-WITHOUT-IDENTITY',
    goal: '로컬 초안을 작성한다',
    domain: 'business',
    external_effect: 'none',
    done_when: ['초안이 작성된다'],
    allowed_scope: ['path:drafts/**'],
    proposed_actions: [{
      id: 'DRAFT',
      description: '로컬 초안을 만든다',
      target: 'local:workspace',
      operation: 'write:path:drafts/note.md',
      effect: 'local_artifact',
      reversible: true
    }]
  }, resolvedEnvironment);
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('TARGET_REPOSITORY_IDENTITY_UNRESOLVED'));
  assert.equal(output.work_packet.preparation_gate.status, 'BLOCKED');
  assert.equal(output.work_packet.plan_slice.handoff_status, 'BLOCKED');
});

test('an irreversible action without recovery is held by the stewardship foresight gate', () => {
  const output = orchestrate({
    task_id: 'IRREVERSIBLE-NO-RECOVERY',
    goal: '운영 데이터를 삭제한다',
    project: 'ai-core',
    risk: 'D',
    external_effect: 'delete',
    done_when: ['삭제 범위가 검증됨'],
    allowed_scope: ['data:obsolete-records'],
    forbidden_scope: ['data:active-records'],
    proposed_actions: [{
      id: 'DELETE',
      description: '폐기 대상을 삭제한다',
      target: 'ai-core-production',
      operation: 'delete:data:obsolete-records',
      effect: 'production_delete',
      reversible: false
    }]
  }, resolvedEnvironment);
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('FORESIGHT_RECOVERY_PATH_REQUIRED'));
  assert.equal(output.human_stewardship.foresight_contract.execution_hold_required, true);
  assert.equal(output.work_packet.plan_slice.handoff_status, 'BLOCKED');
  assert.equal(output.execution_authorized, false);
});

test('an irreversible execution hold still allows independent recovery preparation', () => {
  const output = orchestrate({
    task_id: 'IRREVERSIBLE-WITH-RECOVERY-PREP',
    goal: '삭제 전 복구 증거를 준비한다',
    project: 'ai-core',
    risk: 'D',
    external_effect: 'delete',
    done_when: ['복구 증거와 삭제 계획이 분리됨'],
    allowed_scope: ['path:recovery/**', 'data:obsolete-records'],
    forbidden_scope: ['data:active-records'],
    proposed_actions: [{
      id: 'PREPARE-RECOVERY',
      description: '복구 검증 자료를 로컬에 만든다',
      target: 'ai-core',
      operation: 'write:path:recovery/rollback-plan.md',
      effect: 'local_artifact',
      reversible: true
    }, {
      id: 'DELETE',
      description: '검토 뒤 폐기 대상을 삭제한다',
      target: 'ai-core-production',
      operation: 'delete:data:obsolete-records',
      effect: 'production_delete',
      reversible: false,
      depends_on: ['PREPARE-RECOVERY']
    }]
  }, resolvedEnvironment);
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('FORESIGHT_RECOVERY_PATH_REQUIRED'));
  assert.equal(output.work_packet.preparation_gate.status, 'ALLOWED');
  assert.deepEqual(output.work_packet.preparation_gate.allowed_action_ids, [
    'PREPARE-RECOVERY'
  ]);
  assert.equal(output.work_packet.plan_slice.handoff_status, 'PREPARE_ONLY');
  assert.equal(output.execution_authorized, false);
});

test('action approval composition preserves owner-system approval', () => {
  const output = orchestrate({
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 일치'],
    authority_required: true,
    proposed_actions: [{
      id: 'PUBLISH',
      description: '결과를 운영에 게시한다',
      effect: 'production',
      reversible: true
    }]
  }, resolvedEnvironment);

  assert.deepEqual(output.execution.required_approvals, [
    'CLAUDE_DESIGN',
    'OWNER_SYSTEM_APPROVAL',
    'CLAUDE_FINAL',
    'USER_JUST_IN_TIME'
  ]);
});

test('all applicable approval conditions are preserved together', () => {
  const cases = [
    {
      input: { goal: '새 흐름', risk: 'C', authority_required: true, external_effect: 'none' },
      expected: ['CLAUDE_DESIGN', 'OWNER_SYSTEM_APPROVAL']
    },
    {
      input: { goal: '운영 변경', risk: 'D', authority_required: true, external_effect: 'write' },
      expected: [
        'CLAUDE_DESIGN',
        'OWNER_SYSTEM_APPROVAL',
        'CLAUDE_FINAL',
        'USER_JUST_IN_TIME'
      ]
    },
    {
      input: {
        goal: '법률 검토',
        domain: 'legal',
        risk: 'C',
        authority_required: true,
        external_effect: 'none'
      },
      expected: [
        'CLAUDE_DESIGN',
        'OWNER_SYSTEM_APPROVAL',
        'RESPONSIBLE_HUMAN_FINAL_REVIEW'
      ]
    },
    {
      input: { goal: '외부 발송', authority_required: true, external_effect: 'send' },
      expected: [
        'CLAUDE_DESIGN',
        'OWNER_SYSTEM_APPROVAL',
        'CLAUDE_FINAL',
        'USER_JUST_IN_TIME'
      ]
    }
  ];

  for (const item of cases) {
    assert.deepEqual(executionRoute(normalizeTask(item.input)).required_approvals, item.expected);
  }
});

test('missing external effect and invalid routing booleans fail closed', () => {
  const task = normalizeTask({
    goal: '운영 서버에 지금 배포해줘',
    project: 'ai-core',
    done_when: ['완료']
  });
  assert.equal(task.external_effect, 'unknown');
  assert.equal(task.external_effect_assessment, 'MISSING_ASSUMED_CONSEQUENTIAL');
  assert.equal(executionRoute(task).route, 'HUMAN_GATE');

  for (const field of [
    'authority_required',
    'needs_build',
    'needs_dependency_install',
    'needs_runtime_debug',
    'cloud_reproducible'
  ]) {
    assert.throws(
      () => normalizeTask({ goal: '검사', external_effect: 'none', [field]: 'false' }),
      new RegExp(`${field} must be a boolean`)
    );
  }
});

test('security-relevant arrays fail closed instead of being silently dropped', () => {
  assert.throws(
    () => orchestrate({
      goal: '상품 카드 UI 문구 수정',
      project: 'ai-core',
      done_when: ['문구가 일치'],
      proposed_actions: { description: '운영에 배포한다' }
    }, resolvedEnvironment),
    /proposed_actions must be an array/
  );

  const output = orchestrate({
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 일치']
  }, {
    ...resolvedEnvironment,
    revoked_memory_ids: 'OLD-PREFERENCE'
  });
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('HUMAN_CONTEXT_INPUT_REJECTED'));
});

test('nested task contracts reject unknown fields instead of echoing raw payloads', () => {
  assert.throws(() => orchestrate({
    goal: '작업을 검토한다',
    external_effect: 'none',
    raw_content: 'must never be accepted'
  }), /task has unsupported fields: raw_content/);

  assert.throws(() => orchestrate({
    goal: '의도를 검토한다',
    external_effect: 'none',
    done_when: ['검토 완료'],
    intent_hypotheses: [{
      statement: '진행한다',
      raw_content: 'must never be echoed'
    }]
  }), /intent_hypotheses\[0\] has unsupported fields: raw_content/);

  assert.throws(() => orchestrate({
    goal: '행동을 검토한다',
    external_effect: 'none',
    done_when: ['검토 완료'],
    proposed_actions: [{
      description: '초안을 만든다',
      effect: 'local_artifact',
      reversible: true,
      sensitive_payload: 'must never be echoed'
    }]
  }), /proposed_actions\[0\] has unsupported fields: sensitive_payload/);
});

test('non-string revisions cannot become pinned environment evidence', () => {
  const output = orchestrate({
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 일치'],
    external_effect: 'none'
  }, {
    subject_revision: true,
    resolved_sources: resolvedSources.map(source => ({
      ...source,
      revision_or_sha: true
    })),
    devcenter_registry: {
      datasets: devcenterRegistry.datasets.map(asset => ({
        ...asset,
        source: { ...asset.source, revision_or_sha: true }
      }))
    }
  });
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('ENVIRONMENT_INPUT_REJECTED'));
  assert.ok(output.holds.includes('SOURCE_HOLD'));
  assert.equal(output.work_packet.subject_revision, null);
  assert.deepEqual(output.work_packet.source_bindings, []);
});

test('source-resolvable human context remains a hold until research evidence exists', () => {
  const output = orchestrate({
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    done_when: ['문구가 일치'],
    decision_questions: [{
      id: 'BROWSER-POLICY',
      prompt: '현재 브라우저 지원 정책은 무엇인가?',
      externally_resolvable: true,
      decision_impact: 5,
      uncertainty: 5
    }]
  }, resolvedEnvironment);

  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('HUMAN_CONTEXT_RESEARCH_REQUIRED'));
  assert.deepEqual(output.human_orchestration.research_now.map(item => item.id), [
    'BROWSER-POLICY'
  ]);
});

test('an unscored decision-changing question cannot produce a false READY work packet', () => {
  const output = orchestrate({
    goal: '고객 데이터 조회 화면 수정',
    project: 'ai-core',
    done_when: ['조회 화면 테스트 통과'],
    external_effect: 'none',
    decision_questions: [{
      id: 'DELETE-TARGET',
      prompt: '어느 고객 데이터를 삭제할까요?',
      user_judgment_required: true,
      changes_decision: true
    }]
  }, resolvedEnvironment);
  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('INTENT_CONFIRMATION_REQUIRED'));
  assert.deepEqual(
    output.human_orchestration.questions_to_ask.map(item => item.id),
    ['DELETE-TARGET']
  );
  assert.deepEqual(
    output.human_orchestration.unresolved_decision_question_ids,
    ['DELETE-TARGET']
  );
});

test('intent and research blockers are composed independently', () => {
  const output = orchestrate({
    goal: '상품 관리 화면 개선',
    project: 'ai-core',
    done_when: ['검토된 화면 초안이 준비됨'],
    intent_hypotheses: [{
      id: 'PRIMARY-OUTCOME',
      statement: '처리 속도를 최우선 결과로 둔다.',
      changes_decision: true
    }],
    decision_questions: [{
      id: 'BROWSER-POLICY',
      prompt: '현재 브라우저 지원 정책은 무엇인가?',
      externally_resolvable: true,
      decision_impact: 5,
      uncertainty: 5
    }],
    proposed_actions: [{
      id: 'DRAFT',
      description: '화면 초안을 만든다',
      effect: 'local_artifact',
      reversible: true
    }]
  }, resolvedEnvironment);

  assert.ok(output.holds.includes('INTENT_CONFIRMATION_REQUIRED'));
  assert.ok(output.holds.includes('HUMAN_CONTEXT_RESEARCH_REQUIRED'));
  assert.equal(output.work_packet.preparation_gate.status, 'BLOCKED');
  assert.ok(output.work_packet.preparation_gate.blockers.includes(
    'HUMAN_CONTEXT_RESEARCH_REQUIRED'
  ));
});

test('final preparation gate blocks local preparation when authoritative context is missing', () => {
  const output = orchestrate({
    goal: '상품 카드 UI 문구 수정',
    project: 'ai-core',
    external_effect: 'none',
    done_when: ['문구가 일치'],
    allowed_scope: ['path:drafts/**'],
    proposed_actions: [{
      id: 'DRAFT',
      description: '화면 초안을 만든다',
      target: 'ai-core',
      operation: 'write:path:drafts/screen.md',
      effect: 'local_artifact',
      reversible: true
    }]
  });

  assert.equal(output.human_orchestration.phase_gate.preparation_allowed, true);
  assert.equal(output.work_packet.preparation_gate.status, 'BLOCKED');
  assert.ok(output.work_packet.preparation_gate.blockers.includes('SOURCE_HOLD'));
  assert.deepEqual(output.work_packet.preparation_gate.allowed_action_ids, []);
});
