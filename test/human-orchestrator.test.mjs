import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIntentEnvelope,
  compileHumanOrchestration,
  partitionActions,
  prioritizeQuestions,
  selectApplicableMemory
} from '../src/human-orchestrator.mjs';

function sourceRef(suffix = '1') {
  return {
    location: `memory:opaque-${suffix}`,
    observed_at: '2026-09-13T10:00:00Z'
  };
}

test('decision-changing inferred intent stays provisional and asks one question', () => {
  const result = compileHumanOrchestration({
    goal: '관리자 화면을 개선한다',
    domain: 'development',
    project: 'freepasserp',
    allowed_scope: ['path:drafts/**'],
    intent_hypotheses: [{
      id: 'INTENT-1',
      statement: '업무 처리 속도 개선이 최우선입니까?',
      confidence: 0.6,
      changes_decision: true
    }],
    proposed_actions: [
      {
        id: 'DRAFT',
        description: '가역적인 화면 초안을 만든다',
        target: 'freepasserp',
        operation: 'write:path:drafts/screen.md',
        effect: 'local_artifact',
        reversible: true
      },
      {
        id: 'DEPLOY',
        description: '운영 화면에 배포한다',
        target: 'production',
        operation: 'deploy:production',
        effect: 'production',
        reversible: true
      }
    ]
  });

  assert.equal(result.status, 'DECISION_REQUIRED');
  assert.equal(result.intent.hypotheses[0].status, 'PROVISIONAL');
  assert.equal(result.intent.inferred_intent_confirmed_automatically, false);
  assert.equal(result.questions_to_ask.length, 1);
  assert.equal(result.phase_gate.status, 'PREPARE_ONLY');
  assert.deepEqual(result.actions.prepare_now.map(item => item.id), ['DRAFT']);
  assert.deepEqual(result.actions.approval_required.map(item => item.id), ['DEPLOY']);
});

test('intent is confirmed only with user-directive evidence', () => {
  const task = {
    task_id: 'TASK-INTENT-1',
    goal: '관리자 화면을 개선한다',
    intent_hypotheses: [{
      id: 'INTENT-1',
      statement: 'PC 웹을 먼저 개선한다',
      confirmed: true,
      confirmation: {
        authority: 'user_directive',
        source_ref: {
          location: 'conversation:opaque#message-7',
          observed_at: '2026-09-13T12:00:00Z'
        }
      }
    }]
  };
  const provisional = buildIntentEnvelope(task, {
    currentTime: '2026-09-13T13:00:00Z'
  });
  assert.equal(provisional.hypotheses[0].status, 'PROVISIONAL');

  const intent = buildIntentEnvelope(task, {
    currentTime: '2026-09-13T13:00:00Z',
    verifiedIntentConfirmations: [{
      task_id: task.task_id,
      hypothesis_id: 'INTENT-1',
      statement_digest: provisional.hypotheses[0].statement_digest,
      intent_context_digest: provisional.hypotheses[0].intent_context_digest,
      source_ref: {
        location: 'conversation:opaque#message-7',
        observed_at: '2026-09-13T12:00:00Z'
      }
    }]
  });

  assert.equal(intent.hypotheses[0].status, 'CONFIRMED');
  assert.deepEqual(intent.unresolved_hypothesis_ids, []);
  assert.throws(
    () => buildIntentEnvelope({
      goal: '관리자 화면을 개선한다',
      intent_hypotheses: [{ statement: '근거 없는 확정', confirmed: true }]
    }),
    /cannot be confirmed without user evidence/
  );
});

test('evidence tuple encoding prevents source pointer delimiter collisions', () => {
  const task = {
    task_id: 'TASK-POINTER-COLLISION',
    goal: '명확한 UI 수정',
    intent_hypotheses: [{
      id: 'INTENT-POINTER',
      statement: 'PC 웹을 우선한다',
      confirmed: true,
      confirmation: {
        authority: 'user_directive',
        source_ref: { location: 'a', revision_or_sha: 'b@c' }
      }
    }]
  };
  const provisional = buildIntentEnvelope(task, {
    currentTime: '2026-09-13T13:00:00Z'
  });
  const collision = buildIntentEnvelope(task, {
    currentTime: '2026-09-13T13:00:00Z',
    verifiedIntentConfirmations: [{
      task_id: task.task_id,
      hypothesis_id: 'INTENT-POINTER',
      statement_digest: provisional.hypotheses[0].statement_digest,
      intent_context_digest: provisional.hypotheses[0].intent_context_digest,
      source_ref: { location: 'a@b', revision_or_sha: 'c' }
    }]
  });

  assert.equal(collision.hypotheses[0].status, 'PROVISIONAL');
  assert.equal(collision.hypotheses[0].confirmation.verification, 'UNVERIFIED');
});

test('intent confirmations cannot be replayed into a different task context', () => {
  const confirmation = {
    authority: 'user_directive',
    source_ref: { location: 'conversation:opaque#approval', revision_or_sha: 'message-sha' }
  };
  const originalTask = {
    task_id: 'TASK-SANDBOX',
    project: 'sandbox',
    goal: '샌드박스 레코드를 삭제한다',
    intent_hypotheses: [{
      id: 'DELETE',
      statement: '삭제한다',
      confirmed: true,
      confirmation
    }]
  };
  const original = buildIntentEnvelope(originalTask);
  const receipt = {
    task_id: originalTask.task_id,
    hypothesis_id: 'DELETE',
    statement_digest: original.hypotheses[0].statement_digest,
    intent_context_digest: original.hypotheses[0].intent_context_digest,
    source_ref: confirmation.source_ref
  };
  const productionTask = {
    ...originalTask,
    task_id: 'TASK-PRODUCTION',
    project: 'production',
    goal: '운영 고객 레코드를 삭제한다'
  };
  const replay = buildIntentEnvelope(productionTask, {
    verifiedIntentConfirmations: [receipt]
  });
  assert.equal(replay.hypotheses[0].status, 'PROVISIONAL');
});

test('intent context digest covers risk, effect, domain and completion semantics', () => {
  const source = { location: 'conversation:opaque#semantic-approval', revision_or_sha: 'm1' };
  const originalTask = {
    task_id: 'TASK-SAME-ID',
    project: 'records',
    project_ref: 'main',
    goal: '레코드 처리 방식을 정한다',
    domain: 'development',
    applicable_domains: ['development'],
    risk: 'A',
    authority_required: false,
    external_effect: 'none',
    done_when: ['로컬 초안이 생성됨'],
    intent_hypotheses: [{
      id: 'ACTION',
      statement: '삭제한다',
      confirmed: true,
      confirmation: { authority: 'user_directive', source_ref: source }
    }]
  };
  const original = buildIntentEnvelope(originalTask);
  const receipt = {
    task_id: originalTask.task_id,
    hypothesis_id: 'ACTION',
    statement_digest: original.hypotheses[0].statement_digest,
    intent_context_digest: original.hypotheses[0].intent_context_digest,
    source_ref: source
  };
  const changed = buildIntentEnvelope({
    ...originalTask,
    domain: 'legal',
    applicable_domains: ['legal'],
    risk: 'D',
    authority_required: true,
    external_effect: 'live_data',
    done_when: ['운영 고객 데이터가 삭제됨']
  }, { verifiedIntentConfirmations: [receipt] });
  assert.notEqual(
    original.hypotheses[0].intent_context_digest,
    changed.hypotheses[0].intent_context_digest
  );
  assert.equal(changed.hypotheses[0].status, 'PROVISIONAL');
});

test('only the highest-value unresolved human question is surfaced', () => {
  const questions = prioritizeQuestions([
    {
      id: 'KNOWN',
      prompt: '이미 아는 내용',
      already_known: true,
      resolution_ref: sourceRef('known'),
      decision_impact: 5,
      irreversibility: 5,
      uncertainty: 5
    },
    {
      id: 'SOURCE',
      prompt: '정본에서 찾을 내용',
      externally_resolvable: true,
      decision_impact: 5,
      irreversibility: 5,
      uncertainty: 5
    },
    {
      id: 'LOW',
      prompt: '결과가 바뀌지 않는 질문',
      changes_decision: false,
      decision_impact: 1,
      irreversibility: 1,
      uncertainty: 1
    },
    {
      id: 'CHOICE',
      prompt: '사업 목표 중 무엇을 우선합니까?',
      user_judgment_required: true,
      decision_impact: 5,
      irreversibility: 4,
      uncertainty: 5
    }
  ], 1);

  assert.deepEqual(questions.map(item => item.id), ['CHOICE']);
});

test('external or remembered evidence cannot answer a user-only judgment', () => {
  const result = compileHumanOrchestration({
    task_id: 'TASK-HUMAN-CHOICE',
    goal: '출시 우선순위를 정한다',
    decision_questions: [{
      id: 'PRIORITY',
      prompt: '속도와 완성도 중 무엇을 우선합니까?',
      already_known: true,
      externally_resolvable: true,
      user_judgment_required: true,
      resolution_ref: sourceRef('old-priority'),
      decision_impact: 5,
      irreversibility: 4,
      uncertainty: 5
    }]
  });
  assert.equal(result.status, 'DECISION_REQUIRED');
  assert.deepEqual(result.questions_to_ask.map(item => item.id), ['PRIORITY']);
  assert.deepEqual(result.research_now, []);
});

test('question budget preserves lower-priority questions as deferred work', () => {
  const result = compileHumanOrchestration({
    goal: '두 우선순위를 정한다',
    decision_questions: [
      {
        id: 'HIGH',
        prompt: '가장 중요한 고객군은 누구입니까?',
        user_judgment_required: true,
        decision_impact: 5,
        irreversibility: 4,
        uncertainty: 5
      },
      {
        id: 'LOWER',
        prompt: '두 번째 우선순위는 무엇입니까?',
        user_judgment_required: true,
        decision_impact: 3,
        irreversibility: 2,
        uncertainty: 3
      }
    ]
  });

  assert.deepEqual(result.questions_to_ask.map(item => item.id), ['HIGH']);
  assert.deepEqual(result.deferred_questions.map(item => item.id), ['LOWER']);
  assert.equal(result.deferred_questions[0].reason, 'QUESTION_BUDGET_DEFERRED');
});

test('zero or invalid question budgets cannot create a false READY state', () => {
  const task = {
    goal: '우선순위를 정한다',
    decision_questions: [{
      id: 'PRIORITY',
      prompt: '가장 중요한 결과는 무엇입니까?',
      user_judgment_required: true,
      decision_impact: 5,
      irreversibility: 3,
      uncertainty: 5
    }]
  };
  const zero = compileHumanOrchestration(task, { maximumQuestions: 0 });
  assert.equal(zero.status, 'DECISION_REQUIRED');
  assert.equal(zero.phase_gate.execution_blocked, true);
  assert.deepEqual(zero.questions_to_ask, []);
  assert.deepEqual(zero.deferred_questions.map(item => item.id), ['PRIORITY']);

  const invalid = compileHumanOrchestration(task, { maximumQuestions: Number.NaN });
  assert.equal(invalid.status, 'HOLD_INVALID_INPUT');
});

test('revoked and superseded memory never enters applicable context', () => {
  const selected = selectApplicableMemory([
    {
      memory_id: 'ACTIVE',
      rule_key: 'ui-priority',
      summary: 'PC 웹을 우선한다',
      scope: 'LOCAL',
      state: 'ACTIVE',
      project: 'freepasserp',
      authority: 'user_directive',
      sanitized: true,
      source_ref: sourceRef('active')
    },
    {
      memory_id: 'REVOKED',
      rule_key: 'old-preference',
      summary: '철회된 예전 선호',
      scope: 'LOCAL',
      state: 'ACTIVE',
      project: 'freepasserp',
      authority: 'user_directive',
      sanitized: true,
      source_ref: sourceRef('revoked')
    },
    {
      memory_id: 'SUPERSEDED',
      rule_key: 'old-guidance',
      summary: '대체된 지침',
      scope: 'LOCAL',
      state: 'SUPERSEDED',
      project: 'freepasserp',
      authority: 'user_directive',
      sanitized: true,
      source_ref: sourceRef('superseded')
    }
  ], {
    domain: 'development',
    project: 'freepasserp',
    revokedMemoryIds: ['REVOKED'],
    now: '2026-09-13T13:00:00Z'
  });

  assert.deepEqual(selected.applicable.map(item => item.memory_id), ['ACTIVE']);
  assert.deepEqual(
    selected.excluded.map(item => [item.memory_id, item.reason]),
    [
      ['REVOKED', 'REVOKED_BY_CURRENT_INSTRUCTION'],
      ['SUPERSEDED', 'SUPERSEDED']
    ]
  );
  assert.equal(selected.revoked_memory_applied, false);
  assert.equal(selected.applicable[0].current_user_confirmation_implied, false);
  assert.equal('summary' in selected.excluded[0], false);
});

test('expired and out-of-scope memory is excluded', () => {
  const selected = selectApplicableMemory([
    {
      memory_id: 'EXPIRED',
      rule_key: 'expired-rule',
      summary: '기한이 지난 판단',
      scope: 'UNIVERSAL',
      state: 'ACTIVE',
      authority: 'transfer_gate',
      sanitized: true,
      expires_at: '2026-09-13T09:00:00Z',
      source_ref: sourceRef('expired')
    },
    {
      memory_id: 'OTHER-DOMAIN',
      rule_key: 'legal-only',
      summary: '다른 도메인 규칙',
      scope: 'DOMAIN',
      state: 'ACTIVE',
      domain: 'legal',
      authority: 'approved_source',
      sanitized: true,
      source_ref: sourceRef('domain')
    },
    {
      memory_id: 'OTHER-PROJECT',
      rule_key: 'other-project',
      summary: '다른 프로젝트 선택',
      scope: 'LOCAL',
      state: 'ACTIVE',
      project: 'another-project',
      authority: 'user_directive',
      sanitized: true,
      source_ref: sourceRef('project')
    }
  ], {
    domain: 'development',
    project: 'freepasserp',
    now: '2026-09-13T13:00:00Z'
  });

  assert.equal(selected.applicable.length, 0);
  assert.deepEqual(selected.excluded.map(item => item.reason), [
    'EXPIRED',
    'DOMAIN_MISMATCH',
    'PROJECT_MISMATCH'
  ]);
});

test('domain memory applies to any declared applicable domain', () => {
  const selected = selectApplicableMemory([{
    memory_id: 'LEGAL-PRINCIPLE',
    rule_key: 'legal-source-policy',
    summary: '법률 판단은 최신 공식 근거에 결속한다',
    scope: 'DOMAIN',
    state: 'ACTIVE',
    domain: 'legal',
    kind: 'principle',
    authority: 'approved_source',
    sanitized: true,
    source_ref: sourceRef('legal-principle')
  }], {
    domain: 'development',
    domains: ['development', 'legal'],
    project: 'legal-app',
    now: '2026-09-13T13:00:00Z'
  });

  assert.deepEqual(selected.applicable.map(item => item.memory_id), ['LEGAL-PRINCIPLE']);
});

test('raw or unversioned memory input fails closed without leaking content', () => {
  const raw = compileHumanOrchestration({
    goal: '검토한다',
    domain: 'business'
  }, {
    memoryClaims: [{
      memory_id: 'BAD',
      summary: '잘못된 입력',
      raw_content: 'private transcript must not escape',
      scope: 'UNIVERSAL',
      source_ref: sourceRef('bad')
    }]
  });
  assert.equal(raw.status, 'HOLD_INVALID_INPUT');
  assert.equal(JSON.stringify(raw).includes('private transcript must not escape'), false);

  const unversioned = compileHumanOrchestration({
    goal: '검토한다',
    domain: 'business'
  }, {
    memoryClaims: [{ memory_id: 'NO-SOURCE', summary: '출처가 없다', scope: 'UNIVERSAL' }]
  });
  assert.equal(unversioned.status, 'HOLD_INVALID_INPUT');
});

test('preparation and consequential actions are never collapsed', () => {
  const actions = partitionActions([
    {
      id: 'ANALYZE', description: '정본을 분석한다', target: 'local:workspace',
      operation: 'read:path:src/source.mjs', effect: 'none', reversible: true
    },
    {
      id: 'DRAFT', description: '초안을 만든다', target: 'local:workspace',
      operation: 'write:path:drafts/note.md', effect: 'local_artifact', reversible: true
    },
    {
      id: 'SEND', description: '외부에 발송한다', target: 'external:recipient',
      operation: 'send:message', effect: 'external_message', reversible: true
    },
    {
      id: 'DELETE', description: '데이터를 삭제한다', target: 'production',
      operation: 'delete:data', effect: 'live_data', reversible: false
    }
  ], {
    taskScope: { allowed: ['path:src/**', 'path:drafts/**'], forbidden: [] }
  });

  assert.deepEqual(actions.prepare_now.map(item => item.id), ['ANALYZE', 'DRAFT']);
  assert.deepEqual(actions.approval_required.map(item => item.id), ['SEND', 'DELETE']);
  assert.equal(actions.consequential_action_authorized, false);
});

test('safe-looking work cannot bypass an approval dependency', () => {
  const actions = partitionActions([
    {
      id: 'DEPLOY', description: '운영에 배포한다', target: 'production',
      operation: 'deploy:production', effect: 'production', reversible: true
    },
    {
      id: 'POST-DEPLOY-NOTE',
      description: '배포 후 안내 초안을 만든다',
      target: 'local:workspace',
      operation: 'write:path:drafts/post-deploy-note.md',
      effect: 'local_artifact',
      reversible: true,
      depends_on: ['DEPLOY']
    }
  ], {
    taskScope: { allowed: ['path:drafts/**'], forbidden: [] }
  });

  assert.deepEqual(actions.prepare_now, []);
  assert.deepEqual(
    actions.approval_required.map(item => [item.id, item.reason]),
    [
      ['DEPLOY', 'CONSEQUENTIAL_EFFECT'],
      ['POST-DEPLOY-NOTE', 'BLOCKED_BY_APPROVAL_DEPENDENCY']
    ]
  );
  assert.throws(
    () => partitionActions([{
      id: 'DRAFT',
      description: '초안을 만든다',
      effect: 'local_artifact',
      reversible: true,
      depends_on: ['UNKNOWN']
    }]),
    /dependency is unresolved/
  );
});

test('question output is normalized and does not echo extra input fields', () => {
  const questions = prioritizeQuestions([{
    id: 'Q1',
    prompt: '  우선순위를 선택해 주세요.  ',
    user_judgment_required: true,
    decision_impact: 5,
    irreversibility: 4,
    uncertainty: 5,
    raw_content: 'must not escape'
  }]);

  assert.equal(questions[0].prompt, '우선순위를 선택해 주세요.');
  assert.equal(JSON.stringify(questions).includes('must not escape'), false);
});

test('vague goals create one provisional intent question without mind-reading', () => {
  const result = compileHumanOrchestration({
    goal: '관리자 화면을 더 좋게 개선해줘',
    domain: 'development',
    project: 'freepasserp'
  });

  assert.equal(result.status, 'DECISION_REQUIRED');
  assert.equal(result.intent.ambiguity_detection, 'BOUNDED_HEURISTIC');
  assert.deepEqual(result.intent.unresolved_hypothesis_ids, ['INTENT-AUTO-DESIRED-OUTCOME']);
  assert.equal(result.questions_to_ask.length, 1);
});

test('explicit completion criteria prevents a redundant vague-goal question', () => {
  const result = compileHumanOrchestration({
    goal: 'API 응답속도를 30% 개선한다',
    domain: 'development',
    done_when: ['p95 응답시간이 200ms 이하임']
  });
  assert.equal(result.status, 'READY');
  assert.deepEqual(result.questions_to_ask, []);
});

test('zero-value questions are audited without consuming the user question budget', () => {
  const result = compileHumanOrchestration({
    goal: '요청을 검토한다',
    decision_questions: [{
      id: 'ZERO',
      prompt: '결정에 영향이 없는 선호를 다시 물을까요?',
      user_judgment_required: false,
      changes_decision: false,
      decision_impact: 0,
      uncertainty: 0
    }]
  });
  assert.equal(result.status, 'READY');
  assert.deepEqual(result.questions_to_ask, []);
  assert.deepEqual(result.questions_not_asked.map(item => item.id), ['ZERO']);
  assert.equal(result.questions_not_asked[0].reason, 'BELOW_QUESTION_THRESHOLD');
});

test('an unscored decision-changing question stays blocking and visible', () => {
  const result = compileHumanOrchestration({
    goal: '고객 데이터 작업을 준비한다',
    decision_questions: [{
      id: 'DELETE-TARGET',
      prompt: '어느 고객 데이터를 삭제할까요?',
      user_judgment_required: true,
      changes_decision: true
    }]
  });
  assert.equal(result.status, 'DECISION_REQUIRED');
  assert.deepEqual(result.questions_to_ask.map(item => item.id), ['DELETE-TARGET']);
  assert.deepEqual(result.unresolved_decision_question_ids, ['DELETE-TARGET']);
  assert.equal(result.phase_gate.execution_blocked, true);
});

test('externally resolvable decisions become research work until evidence is attached', () => {
  const pending = compileHumanOrchestration({
    task_id: 'TASK-BROWSER-SUPPORT',
    goal: '지원 브라우저를 정한다',
    decision_questions: [{
      id: 'BROWSER-SUPPORT',
      prompt: '현재 지원 브라우저 정책은 무엇인가?',
      externally_resolvable: true,
      decision_impact: 5,
      uncertainty: 5
    }]
  });
  assert.equal(pending.status, 'RESEARCH_REQUIRED');
  assert.deepEqual(pending.questions_to_ask, []);
  assert.deepEqual(pending.research_now.map(item => item.id), ['BROWSER-SUPPORT']);

  const resolvedQuestion = {
    id: 'BROWSER-SUPPORT',
    prompt: '현재 지원 브라우저 정책은 무엇인가?',
    externally_resolvable: true,
    decision_impact: 5,
    uncertainty: 5,
    resolution_ref: sourceRef('browser-policy')
  };
  const resolved = compileHumanOrchestration({
    task_id: 'TASK-BROWSER-SUPPORT',
    goal: '지원 브라우저를 정한다',
    decision_questions: [resolvedQuestion]
  }, {
    currentTime: '2026-09-13T13:00:00Z',
    verifiedQuestionResolutions: [{
      task_id: 'TASK-BROWSER-SUPPORT',
      question_id: 'BROWSER-SUPPORT',
      prompt_digest: pending.research_now[0].prompt_digest,
      question_context_digest: pending.research_now[0].question_context_digest,
      source_ref: sourceRef('browser-policy'),
      resolution_summary: '지원 정책은 최신 Chrome, Edge, Safari 두 개 주요 버전이다.',
      sanitized: true
    }]
  });
  assert.equal(resolved.status, 'READY');
  assert.deepEqual(resolved.research_now, []);
  assert.deepEqual(resolved.resolved_questions.map(item => item.id), ['BROWSER-SUPPORT']);
  assert.equal(resolved.resolved_questions[0].resolution_verification, 'VERIFIED');
  assert.match(resolved.resolved_questions[0].resolution_digest, /^sha256:[a-f0-9]{64}$/);
  assert.match(resolved.resolved_questions[0].resolution_summary, /Chrome/);
});

test('unverified or future question evidence cannot resolve research', () => {
  const input = {
    task_id: 'TASK-BROWSER-FUTURE',
    goal: '지원 브라우저를 정한다',
    decision_questions: [{
      id: 'BROWSER-SUPPORT',
      prompt: '현재 지원 브라우저 정책은 무엇인가?',
      externally_resolvable: true,
      resolution_ref: sourceRef('browser-policy')
    }]
  };
  const unverified = compileHumanOrchestration(input, {
    currentTime: '2026-09-13T13:00:00Z'
  });
  assert.equal(unverified.status, 'RESEARCH_REQUIRED');

  const future = compileHumanOrchestration(input, {
    currentTime: '2026-09-13T13:00:00Z',
    verifiedQuestionResolutions: [{
      task_id: input.task_id,
      question_id: 'BROWSER-SUPPORT',
      prompt_digest: unverified.research_now[0].prompt_digest,
      question_context_digest: unverified.research_now[0].question_context_digest,
      source_ref: {
        location: 'memory:opaque-browser-policy',
        observed_at: '2999-01-01T00:00:00Z'
      },
      resolution_summary: '미래에서 온 답',
      sanitized: true
    }]
  });
  assert.equal(future.status, 'HOLD_INVALID_INPUT');
});

test('verified question answers cannot be replayed into a different task context', () => {
  const question = {
    id: 'RETENTION',
    prompt: '보존 기간은 얼마인가?',
    externally_resolvable: true,
    resolution_ref: sourceRef('retention')
  };
  const originalTask = {
    task_id: 'TASK-RETENTION-A',
    project: 'sandbox',
    goal: '샌드박스 보존 정책을 정한다',
    decision_questions: [question]
  };
  const original = compileHumanOrchestration(originalTask, {
    currentTime: '2026-09-13T13:00:00Z'
  });
  const receipt = {
    task_id: originalTask.task_id,
    question_id: 'RETENTION',
    prompt_digest: original.research_now[0].prompt_digest,
    question_context_digest: original.research_now[0].question_context_digest,
    source_ref: sourceRef('retention'),
    resolution_summary: '샌드박스 보존 기간은 7일이다.',
    sanitized: true
  };
  const replay = compileHumanOrchestration({
    ...originalTask,
    task_id: 'TASK-RETENTION-B',
    project: 'production',
    goal: '운영 데이터 보존 정책을 정한다'
  }, {
    currentTime: '2026-09-13T13:00:00Z',
    verifiedQuestionResolutions: [receipt]
  });
  assert.equal(replay.status, 'RESEARCH_REQUIRED');
  assert.deepEqual(replay.resolved_questions, []);
});

test('question context digest covers consequential task semantics', () => {
  const question = {
    id: 'ACTION-POLICY',
    prompt: '적용 정책은 무엇인가?',
    externally_resolvable: true,
    resolution_ref: sourceRef('action-policy')
  };
  const originalTask = {
    task_id: 'TASK-ACTION-POLICY',
    project: 'records',
    goal: '레코드 처리 방식을 정한다',
    domain: 'development',
    risk: 'A',
    external_effect: 'none',
    done_when: ['초안 작성'],
    decision_questions: [question]
  };
  const original = compileHumanOrchestration(originalTask, {
    currentTime: '2026-09-13T13:00:00Z'
  });
  const receipt = {
    task_id: originalTask.task_id,
    question_id: question.id,
    prompt_digest: original.research_now[0].prompt_digest,
    question_context_digest: original.research_now[0].question_context_digest,
    source_ref: sourceRef('action-policy'),
    resolution_summary: '로컬 검토만 허용한다.',
    sanitized: true
  };
  const changed = compileHumanOrchestration({
    ...originalTask,
    domain: 'legal',
    applicable_domains: ['legal'],
    risk: 'D',
    authority_required: true,
    external_effect: 'live_data',
    done_when: ['운영 데이터 삭제'],
    decision_questions: [question]
  }, {
    currentTime: '2026-09-13T13:00:00Z',
    verifiedQuestionResolutions: [receipt]
  });
  assert.equal(changed.status, 'RESEARCH_REQUIRED');
  assert.notEqual(
    original.research_now[0].question_context_digest,
    changed.research_now[0].question_context_digest
  );
});

test('human evidence pointers reject scalar coercion across all receipt types', () => {
  const invalidPointer = { location: true, revision_or_sha: true };
  const intent = compileHumanOrchestration({
    task_id: 'TASK-STRICT-POINTER',
    goal: '의도를 확인한다',
    intent_hypotheses: [{
      id: 'STRICT',
      statement: '진행한다',
      confirmed: true,
      confirmation: { authority: 'user_directive', source_ref: invalidPointer }
    }]
  });
  assert.equal(intent.status, 'HOLD_INVALID_INPUT');
  assert.match(intent.issues[0], /location must be a string/);

  const question = compileHumanOrchestration({
    task_id: 'TASK-STRICT-QUESTION',
    goal: '정책을 확인한다',
    decision_questions: [{
      id: 'STRICT-Q',
      prompt: '정책은 무엇인가?',
      externally_resolvable: true,
      resolution_ref: sourceRef('strict-question')
    }]
  }, {
    verifiedQuestionResolutions: [{
      task_id: 'TASK-STRICT-QUESTION',
      question_id: 'STRICT-Q',
      prompt_digest: `sha256:${'a'.repeat(64)}`,
      question_context_digest: `sha256:${'b'.repeat(64)}`,
      source_ref: invalidPointer,
      resolution_summary: '비식별 답변',
      sanitized: true
    }]
  });
  assert.equal(question.status, 'HOLD_INVALID_INPUT');
  assert.match(question.issues[0], /location must be a string/);

  assert.throws(() => selectApplicableMemory([{
    memory_id: 'STRICT-MEMORY',
    rule_key: 'strict-memory',
    summary: '비식별 기억',
    scope: 'LOCAL',
    state: 'ACTIVE',
    project: 'records',
    authority: 'user_directive',
    sanitized: true,
    source_ref: invalidPointer
  }], { project: 'records' }), /location must be a string/);
});

test('verified question summaries and receipt identities reject scalar coercion', () => {
  const task = {
    task_id: 'TASK-STRICT-RECEIPT',
    goal: '지원 정책을 확인한다',
    decision_questions: [{
      id: 'POLICY',
      prompt: '정책은 무엇인가?',
      externally_resolvable: true,
      resolution_ref: sourceRef('strict-receipt')
    }]
  };
  const pending = compileHumanOrchestration(task, {
    currentTime: '2026-09-13T13:00:00Z'
  });
  const base = {
    task_id: task.task_id,
    question_id: 'POLICY',
    prompt_digest: pending.research_now[0].prompt_digest,
    question_context_digest: pending.research_now[0].question_context_digest,
    source_ref: sourceRef('strict-receipt'),
    sanitized: true
  };
  const badSummary = compileHumanOrchestration(task, {
    currentTime: '2026-09-13T13:00:00Z',
    verifiedQuestionResolutions: [{
      ...base,
      resolution_summary: { fake: true }
    }]
  });
  assert.equal(badSummary.status, 'HOLD_INVALID_INPUT');
  assert.match(badSummary.issues[0], /resolution_summary must be a string/);

  const badIdentity = compileHumanOrchestration(task, {
    currentTime: '2026-09-13T13:00:00Z',
    verifiedQuestionResolutions: [{
      ...base,
      task_id: { fake: true },
      resolution_summary: '비식별 답변'
    }]
  });
  assert.equal(badIdentity.status, 'HOLD_INVALID_INPUT');
  assert.match(badIdentity.issues[0], /task_id must be a string/);
});

test('conflicting verified answers for one source revision fail closed', () => {
  const task = {
    task_id: 'TASK-POLICY-CONFLICT',
    goal: '지원 정책을 정한다',
    decision_questions: [{
      id: 'POLICY',
      prompt: '현재 지원 정책은 무엇인가?',
      externally_resolvable: true,
      resolution_ref: sourceRef('policy-conflict')
    }]
  };
  const pending = compileHumanOrchestration(task, {
    currentTime: '2026-09-13T13:00:00Z'
  });
  const baseReceipt = {
    task_id: task.task_id,
    question_id: 'POLICY',
    prompt_digest: pending.research_now[0].prompt_digest,
    question_context_digest: pending.research_now[0].question_context_digest,
    source_ref: sourceRef('policy-conflict'),
    sanitized: true
  };
  const conflict = compileHumanOrchestration(task, {
    currentTime: '2026-09-13T13:00:00Z',
    verifiedQuestionResolutions: [
      { ...baseReceipt, resolution_summary: '정책 A' },
      { ...baseReceipt, resolution_summary: '정책 B' }
    ]
  });
  assert.equal(conflict.status, 'HOLD_INVALID_INPUT');
  assert.match(conflict.issues[0], /resolutions conflict/);

  const duplicate = compileHumanOrchestration(task, {
    currentTime: '2026-09-13T13:00:00Z',
    verifiedQuestionResolutions: [
      { ...baseReceipt, resolution_summary: '정책 A' },
      { ...baseReceipt, resolution_summary: '정책 A' }
    ]
  });
  assert.equal(duplicate.status, 'READY');
  assert.deepEqual(duplicate.resolved_questions.map(item => item.resolution_summary), ['정책 A']);
});

test('unclassified or mistyped action metadata fails closed', () => {
  assert.throws(
    () => partitionActions([{
      id: 'SEND',
      description: '실제 이메일을 발송한다'
    }]),
    /effect is required/
  );

  assert.throws(
    () => partitionActions([{
      id: 'DELETE',
      description: '운영 데이터를 삭제한다',
      effect: 'none',
      reversible: 'false'
    }]),
    /reversible must be a boolean/
  );
});

test('action dependencies must form an acyclic graph', () => {
  assert.throws(
    () => partitionActions([
      {
        id: 'A',
        description: 'A 초안',
        effect: 'local_artifact',
        reversible: true,
        depends_on: ['B']
      },
      {
        id: 'B',
        description: 'B 초안',
        effect: 'local_artifact',
        reversible: true,
        depends_on: ['A']
      }
    ]),
    /must be acyclic/
  );
});

test('memory scope, authority and active rule conflicts fail closed', () => {
  const common = {
    summary: '검증된 비식별 기억',
    state: 'ACTIVE',
    authority: 'user_directive',
    sanitized: true,
    source_ref: sourceRef('memory-contract')
  };
  assert.throws(
    () => selectApplicableMemory([{
      ...common,
      memory_id: 'LOCAL-WITHOUT-PROJECT',
      rule_key: 'local-rule',
      scope: 'LOCAL'
    }]),
    /project is required/
  );
  assert.throws(
    () => selectApplicableMemory([{
      ...common,
      memory_id: 'FAKE-UNIVERSAL',
      rule_key: 'universal-rule',
      scope: 'UNIVERSAL'
    }]),
    /transfer_gate authority/
  );
  assert.throws(
    () => selectApplicableMemory([
      {
        ...common,
        memory_id: 'ACTIVE-1',
        rule_key: 'same-rule',
        scope: 'LOCAL',
        project: 'ai-core'
      },
      {
        ...common,
        memory_id: 'ACTIVE-2',
        rule_key: 'same-rule',
        scope: 'LOCAL',
        project: 'ai-core'
      }
    ], { project: 'ai-core' }),
    /explicit supersession/
  );
});

test('explicit low-impact hypotheses cannot suppress vague-goal ambiguity detection', () => {
  const result = compileHumanOrchestration({
    goal: '관리자 UI를 알아서 개선해줘',
    intent_hypotheses: [{
      id: 'NON-BLOCKING',
      statement: '색상은 기존 토큰을 사용한다.',
      changes_decision: false
    }]
  });

  assert.equal(result.status, 'DECISION_REQUIRED');
  assert.ok(result.intent.unresolved_hypothesis_ids.includes('INTENT-AUTO-DESIRED-OUTCOME'));
});

test('revoked IDs are normalized before memory selection', () => {
  const selected = selectApplicableMemory([{
    memory_id: ' OLD ',
    rule_key: 'old-rule',
    summary: '철회된 기억',
    scope: 'LOCAL',
    state: 'ACTIVE',
    project: 'ai-core',
    authority: 'user_directive',
    sanitized: true,
    source_ref: sourceRef('trimmed-revocation')
  }], {
    project: 'ai-core',
    revokedMemoryIds: [' OLD '],
    now: '2026-09-13T13:00:00Z'
  });

  assert.deepEqual(selected.applicable, []);
  assert.deepEqual(selected.excluded.map(item => item.memory_id), ['OLD']);
});

test('time-bound preference memory requires an expiry', () => {
  const base = {
    memory_id: 'OLD-PREFERENCE',
    rule_key: 'ui-preference',
    summary: '오래된 화면 선호',
    scope: 'LOCAL',
    state: 'ACTIVE',
    project: 'ai-core',
    authority: 'user_directive',
    sanitized: true,
    source_ref: {
      location: 'memory:opaque-old-preference',
      observed_at: '2001-01-01T00:00:00Z'
    }
  };
  assert.throws(
    () => selectApplicableMemory([{
      ...base,
      kind: 'preference'
    }], {
      project: 'ai-core',
      now: '2026-09-13T13:00:00Z'
    }),
    /requires expires_at/
  );
  assert.throws(
    () => selectApplicableMemory([{ ...base, kind: 'Preference' }], {
      project: 'ai-core',
      now: '2026-09-13T13:00:00Z'
    }),
    /kind is unsupported/
  );
  assert.throws(
    () => selectApplicableMemory([{
      memory_id: 'EMPTY-KIND',
      rule_key: 'empty-kind',
      summary: '종류 없는 기억',
      scope: 'LOCAL',
      state: 'ACTIVE',
      project: 'ai-core',
      authority: 'user_directive',
      kind: '',
      sanitized: true,
      source_ref: sourceRef('empty-kind')
    }], { project: 'ai-core' }),
    /kind is unsupported/
  );
});
