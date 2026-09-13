import test from 'node:test';
import assert from 'node:assert/strict';
import { compileHumanOrchestration } from '../src/human-orchestrator.mjs';
import {
  compileHumanStewardship,
  normalizePortfolioSnapshot
} from '../src/human-stewardship.mjs';

function compile(task, options = {}) {
  const humanOrchestration = compileHumanOrchestration(task, {
    currentTime: '2026-09-13T12:00:00Z'
  });
  return compileHumanStewardship(task, { humanOrchestration, ...options });
}

test('a low-risk local draft does not fabricate portfolio, foresight or follow-up work', () => {
  const result = compile({
    task_id: 'STEWARDSHIP-LOW',
    goal: '버튼 여백을 수정한다',
    domain: 'development',
    project: 'ai-core',
    risk: 'A',
    external_effect: 'none',
    allowed_scope: ['path:src/**'],
    proposed_actions: [{
      id: 'DRAFT',
      description: '로컬 패치를 준비한다',
      target: 'ai-core',
      operation: 'write:path:src/button.css',
      effect: 'local_artifact',
      reversible: true
    }]
  });
  assert.equal(result.portfolio_contract.status, 'NOT_REQUIRED');
  assert.equal(result.foresight_contract.mode, 'LIGHT');
  assert.deepEqual(result.foresight_contract.risks, []);
  assert.equal(result.follow_through_contract.status, 'NOT_REQUIRED');
  assert.equal(result.follow_through_contract.tracking_active, false);
  assert.equal(result.follow_through_contract.automation_binding, 'NOT_IMPLEMENTED');
  assert.equal(result.outcome_observed, false);
});

test('a desired outcome alone does not fabricate monitoring', () => {
  const result = compile({
    task_id: 'STEWARDSHIP-DESIRED-ONLY',
    goal: '로컬 문구를 다듬는다',
    desired_outcome: '문구가 더 명확해진다',
    domain: 'development',
    project: 'ai-core',
    risk: 'A',
    external_effect: 'none',
    allowed_scope: ['path:drafts/**'],
    proposed_actions: [{
      id: 'DRAFT',
      description: '로컬 문구 초안을 만든다',
      target: 'ai-core',
      operation: 'write:path:drafts/copy.md',
      effect: 'local_artifact',
      reversible: true
    }]
  });
  assert.equal(result.follow_through_contract.status, 'NOT_REQUIRED');
  assert.deepEqual(result.follow_through_contract.active_observations, []);
});

test('an external effect without a consequential action stays unbound', () => {
  const result = compile({
    task_id: 'STEWARDSHIP-MISSING-EXECUTION-ACTION',
    goal: '고객 발송을 준비한다',
    domain: 'communication',
    risk: 'B',
    external_effect: 'send',
    allowed_scope: ['path:drafts/**'],
    proposed_actions: [{
      id: 'DRAFT',
      description: '발송 전 로컬 초안을 만든다',
      target: 'local:workspace',
      operation: 'write:path:drafts/message.md',
      effect: 'local_artifact',
      reversible: true
    }]
  });
  assert.equal(
    result.follow_through_contract.status,
    'DEFERRED_UNTIL_CONSEQUENTIAL_ACTION_BOUND'
  );
  assert.deepEqual(result.follow_through_contract.active_observations, []);
});

test('consequential work creates one unbound observation without claiming monitoring', () => {
  const result = compile({
    task_id: 'STEWARDSHIP-EXTERNAL',
    goal: '고객에게 결과를 발송한다',
    domain: 'communication',
    risk: 'D',
    external_effect: 'send',
    proposed_actions: [{
      id: 'SEND',
      description: '고객에게 발송한다',
      effect: 'external_message',
      reversible: false
    }],
    recovery_strategy: '발송 중단 및 정정 안내 초안을 준비한다'
  });
  assert.equal(result.foresight_contract.mode, 'DEEP');
  assert.equal(result.foresight_contract.future_claims_promoted_to_fact, false);
  assert.equal(result.foresight_contract.automatic_action_selected, false);
  assert.equal(result.follow_through_contract.status, 'PLANNED_UNBOUND');
  assert.equal(result.follow_through_contract.outcome_state, 'NOT_STARTED');
  assert.equal(result.follow_through_contract.active_observations.length, 1);
  assert.match(
    result.follow_through_contract.active_observations[0].binding_digest,
    /^sha256:[a-f0-9]{64}$/
  );
  assert.equal(result.follow_through_contract.tracking_active, false);
  assert.equal(result.follow_through_contract.automation_binding, 'NOT_IMPLEMENTED');
  assert.equal(result.portfolio_contract.status, 'NOT_ASSESSED_ADVISORY');
});

test('portfolio discovery is driven by a typed portfolio effect, not filename keywords', () => {
  const local = compile({
    task_id: 'STEWARDSHIP-PORTFOLIO-NONE',
    goal: '문서를 편집한다',
    domain: 'development',
    risk: 'A',
    external_effect: 'none',
    portfolio_effect: 'none',
    allowed_scope: ['path:docs/**'],
    proposed_actions: [{
      id: 'DOC',
      description: '로컬 파일을 편집한다',
      target: 'ai-core',
      operation: 'write:path:docs/commitment.md',
      effect: 'local_artifact',
      reversible: true
    }]
  });
  assert.equal(local.portfolio_contract.status, 'NOT_REQUIRED');

  const priorityChange = compile({
    task_id: 'STEWARDSHIP-PORTFOLIO-IMPACT',
    goal: '우선순위 변경안을 검토한다',
    domain: 'business',
    risk: 'B',
    external_effect: 'none',
    portfolio_effect: 'change_priority',
    proposed_actions: []
  });
  assert.equal(priorityChange.portfolio_contract.status, 'NOT_DECLARED');
  assert.equal(
    priorityChange.portfolio_contract.recommendation,
    'DISCOVER_SCOPED_AIOPS_COMMITMENTS'
  );
});

test('irreversible work without recovery requires a foresight hold', () => {
  const result = compile({
    task_id: 'STEWARDSHIP-IRREVERSIBLE',
    goal: '운영 데이터를 삭제한다',
    domain: 'business',
    risk: 'D',
    external_effect: 'delete',
    proposed_actions: [{
      id: 'DELETE',
      description: '운영 데이터를 삭제한다',
      effect: 'production_delete',
      reversible: false
    }]
  });
  assert.equal(result.foresight_contract.execution_hold_required, true);
  assert.ok(result.foresight_contract.risks.some(risk => (
    risk.code === 'IRREVERSIBLE_ACTION_WITHOUT_VERIFIED_RECOVERY'
  )));
  assert.equal(result.authorization, 'NOT_GRANTED');
});

test('portfolio analysis selects only declared relevant commitments and never changes priority', () => {
  const snapshot = {
    revision: 'portfolio-r1',
    observed_at: '2026-09-13T10:00:00Z',
    commitments: [
      {
        commitment_id: 'RELEVANT',
        goal_summary: '이번 릴리스',
        status: 'ACTIVE',
        dependencies: [],
        resource_claims: ['team:platform'],
        priority: 'USER_CONFIRMED_HIGH',
        source_ref: { location: 'aiops:commitments/relevant', revision_or_sha: 'r1' },
        sanitized: true
      },
      {
        commitment_id: 'UNRELATED',
        goal_summary: '관련 없는 장기 계획',
        status: 'ACTIVE',
        dependencies: [],
        resource_claims: ['team:other'],
        priority: 'UNKNOWN',
        source_ref: { location: 'aiops:commitments/unrelated', revision_or_sha: 'r1' },
        sanitized: true
      }
    ]
  };
  const result = compile({
    task_id: 'STEWARDSHIP-PORTFOLIO',
    goal: '새 릴리스를 준비한다',
    domain: 'development',
    project: 'ai-core',
    risk: 'C',
    external_effect: 'none',
    related_commitment_ids: ['RELEVANT'],
    resource_claims: ['team:platform'],
    proposed_actions: []
  }, { portfolioSnapshot: snapshot });
  assert.equal(result.portfolio_contract.status, 'STRUCTURALLY_ANALYZED_UNAUTHENTICATED');
  assert.deepEqual(
    result.portfolio_contract.relevant_commitments.map(item => item.commitment_id),
    ['RELEVANT']
  );
  assert.equal(JSON.stringify(result).includes('관련 없는 장기 계획'), false);
  assert.deepEqual(result.portfolio_contract.conflicts, []);
  assert.equal(result.portfolio_contract.recommendation, 'PROCEED_CANDIDATE');
  assert.equal(result.portfolio_contract.priority_change_authorized, false);
  assert.equal(result.user_priority_changed, false);
  assert.equal(result.user_commitment_cancelled, false);
});

test('portfolio snapshots are strict, revision-bound and sanitized', () => {
  assert.throws(() => normalizePortfolioSnapshot({
    revision: 'r1',
    observed_at: '2026-09-13T10:00:00Z',
    commitments: [{
      commitment_id: 'C-1',
      goal_summary: '업무',
      status: 'ACTIVE',
      dependencies: [],
      resource_claims: [],
      priority: 'UNKNOWN',
      source_ref: { location: 'aiops:C-1', revision_or_sha: 'r1' },
      sanitized: true,
      raw_content: 'must not enter'
    }]
  }), /unsupported fields/);
  for (const missingField of ['dependencies', 'resource_claims', 'priority']) {
    const commitment = {
      commitment_id: 'C-1',
      goal_summary: '업무',
      status: 'ACTIVE',
      dependencies: [],
      resource_claims: [],
      priority: 'UNKNOWN',
      source_ref: { location: 'aiops:C-1', revision_or_sha: 'r1' },
      sanitized: true
    };
    delete commitment[missingField];
    assert.throws(() => normalizePortfolioSnapshot({
      revision: 'r1',
      observed_at: '2026-09-13T10:00:00Z',
      commitments: [commitment]
    }), /missing required fields/);
  }
  const result = compile({
    task_id: 'STEWARDSHIP-BAD-PORTFOLIO',
    goal: '업무를 검토한다',
    domain: 'business',
    risk: 'A',
    external_effect: 'none',
    related_commitment_ids: ['C-1']
  }, { portfolioSnapshot: { revision: 'r1', commitments: [] } });
  assert.equal(result.status, 'HOLD_INVALID_INPUT');
  assert.deepEqual(result.issues, ['PORTFOLIO_INPUT_REJECTED']);
});

test('support quality remains a vector of unknown evidence states, not a scalar score', () => {
  const result = compile({
    task_id: 'STEWARDSHIP-VECTOR',
    goal: '현황을 설명한다',
    domain: 'business',
    risk: 'A',
    external_effect: 'none'
  });
  assert.deepEqual(new Set(Object.values(result.support_quality_vector)), new Set(['UNKNOWN']));
  assert.equal(result.composite_support_score, null);
});

test('a caller recovery sentence never clears an irreversible execution hold', () => {
  const result = compile({
    task_id: 'STEWARDSHIP-RECOVERY-TEXT',
    goal: '운영 데이터를 삭제한다',
    domain: 'business',
    risk: 'D',
    external_effect: 'delete',
    recovery_strategy: '복구 불가',
    proposed_actions: [{
      id: 'DELETE',
      description: '운영 데이터를 삭제한다',
      target: 'production',
      operation: 'delete:production-data',
      effect: 'production_delete',
      reversible: false
    }]
  });
  assert.equal(result.foresight_contract.execution_hold_required, true);
  assert.equal(
    JSON.stringify(result.foresight_contract).includes('복구 불가'),
    false
  );
});

test('known consequential actions always produce an explicit conditional review obligation', () => {
  const result = compile({
    task_id: 'STEWARDSHIP-CONSEQUENCE',
    goal: '운영에 배포한다',
    domain: 'development',
    project: 'ai-core',
    risk: 'A',
    external_effect: 'write',
    proposed_actions: [{
      id: 'DEPLOY',
      description: '운영에 배포한다',
      target: 'production',
      operation: 'deploy:production',
      effect: 'production',
      reversible: true
    }]
  });
  assert.equal(result.foresight_contract.mode, 'DEEP');
  assert.equal(
    result.foresight_contract.assessment_status,
    'CONDITIONAL_ONLY_NOT_EXECUTION_CLEARANCE'
  );
  assert.ok(result.foresight_contract.risks.length > 0);
});

test('mandatory legal and irreversible risks survive the three-risk limit', () => {
  const result = compile({
    task_id: 'STEWARDSHIP-LEGAL-PRIORITY',
    goal: '법적 통지를 고객에게 발송한다',
    domain: 'legal',
    risk: 'D',
    external_effect: 'unknown',
    proposed_actions: [{
      id: 'SEND',
      description: '법적 통지를 발송한다',
      target: 'external:recipient',
      operation: 'send:message',
      effect: 'local_artifact',
      reversible: true
    }]
  });
  const codes = result.foresight_contract.risks.map(risk => risk.code);
  assert.ok(codes.includes('LEGAL_AUTHORITY_OR_DEADLINE_DRIFT'));
  assert.ok(codes.includes('IRREVERSIBLE_ACTION_WITHOUT_VERIFIED_RECOVERY'));
  const irreversible = result.foresight_contract.risks.find(risk => (
    risk.code === 'IRREVERSIBLE_ACTION_WITHOUT_VERIFIED_RECOVERY'
  ));
  assert.deepEqual(irreversible.evidence, ['SEND']);
});

test('an irrelevant malformed portfolio snapshot is quarantined without blocking simple work', () => {
  const result = compile({
    task_id: 'STEWARDSHIP-IRRELEVANT-PORTFOLIO',
    goal: '현황을 설명한다',
    domain: 'business',
    risk: 'A',
    external_effect: 'none'
  }, { portfolioSnapshot: { malformed: true } });
  assert.equal(result.status, 'CANDIDATE');
  assert.equal(result.portfolio_contract.status, 'NOT_REQUIRED');
  assert.deepEqual(result.issues, []);
});

test('old portfolio state is advisory and requests a scoped refresh', () => {
  const result = compile({
    task_id: 'STEWARDSHIP-STALE-PORTFOLIO',
    goal: '관련 작업을 검토한다',
    domain: 'business',
    risk: 'C',
    external_effect: 'none',
    related_commitment_ids: ['C-OLD']
  }, {
    currentTime: '2026-09-13T12:00:00Z',
    portfolioSnapshot: {
      revision: 'old-r1',
      observed_at: '2026-09-10T12:00:00Z',
      commitments: [{
        commitment_id: 'C-OLD',
        goal_summary: '오래된 상태',
        status: 'BLOCKED',
        dependencies: [],
        resource_claims: [],
        priority: 'UNKNOWN',
        source_ref: { location: 'aiops:commitments/C-OLD', revision_or_sha: 'old-r1' },
        sanitized: true
      }]
    }
  });
  assert.equal(result.portfolio_contract.status, 'STALE_UNAUTHENTICATED');
  assert.equal(result.portfolio_contract.recommendation, 'REFETCH_SCOPED_AIOPS_COMMITMENTS');
  assert.equal(result.portfolio_contract.conflict_claims_are_advisory, true);
  assert.equal(result.user_priority_changed, false);
});

test('follow-through is a revision-bound plan and changes when the plan changes', () => {
  const task = {
    task_id: 'STEWARDSHIP-BINDING',
    goal: '고객 전달물을 준비한다',
    desired_outcome: '고객 오류율이 감소한다',
    outcome_observation: {
      event_or_metric: '고객 오류율',
      evidence_required: '배포 후 오류율 집계 영수증'
    },
    domain: 'communication',
    risk: 'A',
    external_effect: 'none',
    allowed_scope: ['path:drafts/**'],
    done_when: ['초안이 검토 가능하다'],
    proposed_actions: [{
      id: 'DRAFT',
      description: '로컬 초안을 만든다',
      target: 'ai-core',
      operation: 'write:path:drafts/customer-message.md',
      effect: 'local_artifact',
      reversible: true
    }]
  };
  const first = compile(task, { subjectRevision: 'sha-1' });
  const second = compile(task, { subjectRevision: 'sha-2' });
  const changedGoal = compile({ ...task, goal: '다른 고객 전달물을 준비한다' }, {
    subjectRevision: 'sha-1'
  });
  const changedRequirement = compile({ ...task, done_when: ['다른 검사가 완료된다'] }, {
    subjectRevision: 'sha-1'
  });
  assert.equal(first.follow_through_contract.status, 'PLANNED_UNBOUND');
  assert.equal(first.follow_through_contract.outcome_state, 'NOT_STARTED');
  assert.equal(first.follow_through_contract.tracking_active, false);
  assert.notEqual(
    first.follow_through_contract.active_observations[0].binding_digest,
    second.follow_through_contract.active_observations[0].binding_digest
  );
  assert.notEqual(
    first.follow_through_contract.active_observations[0].binding_digest,
    changedGoal.follow_through_contract.active_observations[0].binding_digest
  );
  assert.notEqual(
    first.follow_through_contract.active_observations[0].binding_digest,
    changedRequirement.follow_through_contract.active_observations[0].binding_digest
  );
});
