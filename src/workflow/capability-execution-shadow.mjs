import { createHash } from 'node:crypto';
import { isAbsolute, relative } from 'node:path';
import { createWorkflowEngine, WorkflowError } from './engine.mjs';

const canonical = value => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
    : value;

const digest = value => `sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;
const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;

function safeReceipt(result) {
  if (result?.schema !== 'ai-core-work-result/v1') return null;
  const checks = Array.isArray(result.checks) ? result.checks : [];
  const evidenceRefs = result.evidence_refs ?? [];
  if (!Array.isArray(evidenceRefs) || !evidenceRefs.every(nonempty)) return null;
  return {
    schema: result.schema,
    order_id: result.order_id ?? null,
    work_id: result.work_id ?? null,
    project_id: result.project_id ?? null,
    capability_id: result.capability_id ?? null,
    subject_revision: result.subject_revision ?? null,
    mode: result.mode ?? null,
    status: result.status,
    summary: String(result.summary ?? '').slice(0, 4000),
    artifact_refs: [...(result.artifact_refs ?? [])].map(String),
    evidence_refs: [...evidenceRefs],
    checks: checks.map(item => ({
      name: String(item?.name ?? ''),
      status: String(item?.status ?? ''),
      detail: item?.detail == null ? null : String(item.detail).slice(0, 2000),
    })),
    execution: {
      performed: result.execution?.performed === true,
      external_effect: result.execution?.external_effect === true,
      started_at: result.execution?.started_at ?? null,
      ended_at: result.execution?.ended_at ?? null,
      authorization_source: result.execution?.authorization_source ?? null,
    },
    outcome: { observed: result.outcome?.observed === true },
    blockers: [...(result.blockers ?? [])].map(String),
    next_action: result.next_action == null ? null : String(result.next_action).slice(0, 4000),
    walls: [...(result.walls ?? [])].map(String),
  };
}

export function createCapabilityExecutionShadow(workflow) {
  if (workflow?.workflow_id !== 'ai-core.capability-execution') {
    throw new WorkflowError('CAPABILITY_EXECUTION_SHADOW_WORKFLOW_REQUIRED');
  }
  const engine = createWorkflowEngine(workflow);

  function projection(row) {
    if (!row) throw new WorkflowError('CAPABILITY_EXECUTION_REQUEST_MISSING');
    return {
      entity_id: row.request_id,
      revision: Number(row.version ?? 1),
      states: { lifecycle: row.state },
      order_id: row.order_id,
      requirement_revision: row.requirement_revision,
      work_id: row.work_id,
      capability_id: row.capability_id,
      project_id: row.project_id,
      subject_revision: row.subject_revision,
      payload_digest: row.payload_digest,
      input_digest: row.input_digest,
      perform: row.perform === 1 || row.perform === true,
    };
  }

  function facts(row, result) {
    const receipt = safeReceipt(result);
    return {
      receipt,
      values: {
        'execution.result_schema_valid': receipt !== null,
        'execution.result_context_matches': receipt !== null
          && receipt.order_id === row.order_id
          && receipt.work_id === row.work_id,
        'execution.result_capability_matches': receipt !== null
          && receipt.capability_id === row.capability_id
          && receipt.project_id === row.project_id,
        'execution.result_revision_matches': receipt !== null
          && receipt.subject_revision === row.subject_revision,
        'execution.result_status': receipt?.status ?? null,
      },
    };
  }

  function decideComplete(row, result, {
    requestId = row?.request_id,
    reconciliation = false,
  } = {}) {
    if (!row) return { eligible: false, code: 'CAPABILITY_EXECUTION_REQUEST_MISSING' };

    const evaluated = facts(row, result);
    if (row.state === 'RESULT') {
      const prior = row.result_json ? JSON.parse(row.result_json) : null;
      if (!evaluated.receipt || digest(prior) !== digest(evaluated.receipt)) {
        return {
          eligible: false,
          code: 'CAPABILITY_EXECUTION_RESULT_CONFLICT',
          facts: evaluated.values,
        };
      }
      return {
        eligible: true,
        code: null,
        replay: true,
        persistent_state: 'RESULT',
        receipt: prior,
        facts: evaluated.values,
      };
    }

    if (!evaluated.values['execution.result_schema_valid']) {
      return { eligible: false, code: 'WORK_RESULT_SCHEMA_INVALID', facts: evaluated.values };
    }
    if (!evaluated.values['execution.result_context_matches']) {
      return { eligible: false, code: 'WORK_RESULT_CONTEXT_MISMATCH', facts: evaluated.values };
    }
    if (!evaluated.values['execution.result_capability_matches']) {
      return { eligible: false, code: 'WORK_RESULT_CAPABILITY_MISMATCH', facts: evaluated.values };
    }
    if (!evaluated.values['execution.result_revision_matches']) {
      return { eligible: false, code: 'WORK_RESULT_REVISION_STALE', facts: evaluated.values };
    }

    try {
      const transition_id = reconciliation
        ? 'capability-execution.reconcile-terminal'
        : 'capability-execution.complete';
      const command_id = reconciliation
        ? 'capability-execution.reconcile'
        : 'capability-execution.complete';
      const decision = engine.decide({
        projection: projection(row),
        transition_id,
        command_id,
        command_payload: evaluated.receipt ?? result,
        actor: { actor_id: 'ai-core-capability' },
        facts: evaluated.values,
        expected_revision: Number(row.version ?? 1),
        idempotency_key: requestId,
      });
      return {
        eligible: true,
        code: null,
        replay: false,
        persistent_state: decision.next_projection.states.lifecycle,
        receipt: evaluated.receipt,
        decision,
        facts: evaluated.values,
      };
    } catch (error) {
      if (error instanceof WorkflowError) {
        return {
          eligible: false,
          code: error.code,
          reasons: error.details?.reasons ?? [],
          facts: evaluated.values,
        };
      }
      throw error;
    }
  }

  function classifyReconciliation(row, capability, observed, {
    clock = () => Date.now(),
    projectRoot = null,
  } = {}) {
    if (!row) return { action: 'ERROR', code: 'CAPABILITY_EXECUTION_REQUEST_MISSING' };
    if (row.state === 'RESULT') {
      return {
        action: 'REPLAY_RESULT',
        persistent_state: 'RESULT',
        result: row.result_json ? JSON.parse(row.result_json) : null,
        reconciled: true,
      };
    }
    if (!capability?.receipt) {
      return {
        action: 'HOLD_NO_TRANSITION',
        persistent_state: 'RESERVED',
        status: 'HOLD',
        reason: 'EXECUTION_OUTCOME_UNKNOWN',
        reconciled: false,
      };
    }
    if (observed?.status === 'HOLD' && observed?.reason === 'EXECUTION_RECEIPT_MISSING') {
      return {
        action: 'HOLD_NO_TRANSITION',
        persistent_state: 'RESERVED',
        status: 'HOLD',
        reason: 'EXECUTION_OUTCOME_UNKNOWN',
        reconciled: false,
      };
    }

    const mapped = observed?.status === 'SUCCEEDED'
      ? 'SUCCEEDED'
      : observed?.status === 'FAILED'
        ? 'FAILED'
        : 'HOLD';

    let ref = null;
    if (observed?.path && projectRoot) {
      const rel = relative(projectRoot, observed.path);
      if (rel && !rel.startsWith('..') && !isAbsolute(rel)) ref = rel.replaceAll('\\', '/');
    }

    const result = {
      schema: 'ai-core-work-result/v1',
      order_id: row.order_id,
      work_id: row.work_id,
      project_id: row.project_id,
      capability_id: row.capability_id,
      subject_revision: row.subject_revision,
      mode: capability.mode,
      status: mapped,
      summary: mapped === 'SUCCEEDED'
        ? '응답 유실 뒤 terminal execution receipt로 성공을 재확인했습니다.'
        : mapped === 'FAILED'
          ? '응답 유실 뒤 terminal execution receipt에서 실패를 확인했습니다.'
          : '응답 유실 뒤 terminal execution receipt가 HOLD 상태입니다.',
      artifact_refs: ref ? [ref] : [],
      evidence_refs: ref ? [`MEASURED:${ref} state=${observed?.state ?? 'unknown'}`] : [],
      checks: [{
        name: 'execution.receipt.reconcile',
        status: mapped === 'SUCCEEDED' ? 'PASS' : 'FAIL',
        detail: observed?.state ?? observed?.reason ?? null,
      }],
      execution: {
        performed: true,
        external_effect: capability.mode === 'EXTERNAL_MUTATION',
        started_at: null,
        ended_at: new Date(clock()).toISOString(),
        authorization_source: null,
      },
      outcome: { observed: mapped === 'SUCCEEDED' },
      blockers: mapped === 'SUCCEEDED' ? [] : [observed?.reason ?? 'EXECUTION_RECEIPT_HOLD'],
      next_action: mapped === 'SUCCEEDED'
        ? '정본 상태 전이는 기존 Control Tower/Work Ledger 규칙으로 계속합니다.'
        : 'terminal receipt 내용을 확인합니다.',
      walls: [...(capability.walls ?? [])],
    };

    return {
      action: 'PERSIST_TERMINAL_RESULT',
      persistent_state: 'RESULT',
      status: 'RESULT',
      mapped_status: mapped,
      result,
      reconciled: true,
    };
  }

  return Object.freeze({
    projection,
    decideComplete,
    classifyReconciliation,
    normalizeResult: safeReceipt,
    workflow_id: workflow.workflow_id,
    workflow_version: workflow.version,
  });
}
