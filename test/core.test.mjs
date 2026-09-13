import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrate, executionRoute, normalizeTask } from '../src/core.mjs';

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
    changed_files_estimate: 2
  }, resolvedEnvironment);
  assert.equal(output.execution.route, 'GPT_DIRECT');
  assert.equal(output.status, 'READY');
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
    needs_build: true
  });
  assert.equal(executionRoute(task).route, 'WORK_CODEX');
});

test('risk C requires Claude design gate', () => {
  const task = normalizeTask({ goal: '새 업무 흐름 개발', risk: 'C' });
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
  }, resolvedEnvironment);
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
