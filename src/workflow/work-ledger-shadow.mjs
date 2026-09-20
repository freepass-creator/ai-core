import { createWorkflowEngine, WorkflowError } from './engine.mjs';

const REOBSERVABLE = new Set(['RECEIVED', 'PLANNED', 'IN_PROGRESS']);
const RAW_EVENT_TYPES = new Set(['CREATED', 'TRANSITIONED', 'BLOCKED', 'RESUMED', 'CANCELLED', 'REOBSERVED']);

const slug = value => String(value ?? '').toLowerCase().replaceAll('_', '-');

function reject(reason, details = {}) {
  return { eligible: false, reasons: [reason], ...details };
}

function transitionIdFor(event) {
  if (event.type === 'REOBSERVED') {
    if (event.from_state !== event.to_state) return null;
    return `work.${slug(event.from_state)}.reobserve`;
  }
  return `work.${slug(event.from_state)}.to.${slug(event.to_state)}`;
}

function validRevision(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

export function createWorkLedgerShadow(workflow) {
  if (workflow?.workflow_id !== 'ai-core.work-lifecycle') {
    throw new WorkflowError('WORK_LEDGER_SHADOW_WORKFLOW_REQUIRED');
  }

  const engine = createWorkflowEngine(workflow, {
    evaluateGuard: (guard, context, projection) => {
      const event = context.event;
      switch (guard.guard_id) {
        case 'work.project-same':
          return event?.project_id === projection?.project_id;
        case 'work.subject-revision-same':
          return event?.subject_revision === projection?.subject_revision;
        case 'work.subject-revision-changed':
          return validRevision(event?.subject_revision)
            && event.subject_revision !== projection?.subject_revision;
        case 'work.subject-revision-present':
          return validRevision(event?.subject_revision);
        case 'work.verified-revision-compatible':
          return projection?.verification_captured !== true
            || event?.subject_revision === projection?.verified_revision;
        case 'work.verified-revision-present':
          return projection?.verification_captured === true;
        case 'work.evidence-present':
          return Array.isArray(event?.evidence_refs) && event.evidence_refs.length > 0;
        default:
          return false;
      }
    },
  });

  function inspect(projection, event) {
    if (!event || typeof event !== 'object') return reject('LEDGER_EVENT_REQUIRED');
    if (!RAW_EVENT_TYPES.has(event.type)) return reject('LEDGER_EVENT_TYPE_INVALID');

    if (event.type === 'CREATED') {
      const reasons = [];
      if (projection) reasons.push('WORK_ALREADY_CREATED');
      if (event.from_state !== null) reasons.push('CREATE_FROM_STATE_INVALID');
      if (event.to_state !== 'RECEIVED') reasons.push('CREATE_TO_STATE_INVALID');
      return {
        eligible: reasons.length === 0,
        reasons,
        transition_id: null,
        from_state: null,
        to_state: event.to_state,
      };
    }

    if (!projection) return reject('WORK_NOT_CREATED');
    if (event.work_id !== projection.entity_id) return reject('WORK_ID_MISMATCH');
    const transition_id = transitionIdFor(event);
    if (!transition_id) return reject('TRANSITION_NOT_ALLOWED');

    try {
      const result = engine.inspectTransition(projection, transition_id, { event });
      return { ...result, transition_id };
    } catch (error) {
      if (error instanceof WorkflowError && error.code === 'TRANSITION_UNKNOWN') {
        return reject('TRANSITION_NOT_ALLOWED', {
          transition_id,
          from_state: event.from_state,
          to_state: event.to_state,
        });
      }
      throw error;
    }
  }

  function decide(projection, event) {
    const inspection = inspect(projection, event);
    if (!inspection.eligible) return { status: 'REJECTED', inspection, projection, decision: null };

    if (event.type === 'CREATED') {
      return {
        status: 'ACCEPTED',
        inspection,
        projection,
        decision: null,
      };
    }

    const transition = workflow.transitions.find(item => item.transition_id === inspection.transition_id);
    if (!transition) {
      return {
        status: 'REJECTED',
        inspection: reject('TRANSITION_NOT_ALLOWED', {
          transition_id: inspection.transition_id,
          from_state: event.from_state,
          to_state: event.to_state,
        }),
        projection,
        decision: null,
      };
    }

    try {
      const decision = engine.decide({
        projection,
        transition_id: transition.transition_id,
        command_id: transition.command_id,
        command_payload: {
          type: event.type,
          project_id: event.project_id,
          from_state: event.from_state,
          to_state: event.to_state,
          subject_revision: event.subject_revision ?? null,
          evidence_refs: [...(event.evidence_refs ?? [])],
        },
        actor: event.actor ?? null,
        reason: event.reason ?? null,
        expected_revision: projection.revision,
        request_id: event.event_id ?? null,
        guard_context: { event },
      });
      return { status: 'ACCEPTED', inspection, projection, decision };
    } catch (error) {
      if (error instanceof WorkflowError) {
        if (error.code === 'TRANSITION_GUARD_REJECTED') {
          return {
            status: 'REJECTED',
            inspection: {
              eligible: false,
              reasons: [...(error.details?.reasons ?? [])],
              transition_id: inspection.transition_id,
              from_state: inspection.from_state,
              to_state: inspection.to_state,
            },
            projection,
            decision: null,
            error_code: error.code,
          };
        }
        return {
          status: 'REJECTED',
          inspection: reject(`ENGINE_DECISION_REJECTED:${error.code}`, {
            transition_id: inspection.transition_id,
            from_state: inspection.from_state,
            to_state: inspection.to_state,
          }),
          projection,
          decision: null,
          error_code: error.code,
        };
      }
      throw error;
    }
  }

  function apply(projection, event) {
    const adjudication = decide(projection, event);
    const inspection = adjudication.inspection;
    if (adjudication.status !== 'ACCEPTED') return { status: 'REJECTED', inspection, projection };

    if (event.type === 'CREATED') {
      const revisions = event.subject_revision ? [event.subject_revision] : [];
      return {
        status: 'ACCEPTED',
        inspection,
        projection: {
          entity_id: event.work_id,
          revision: 0,
          states: { lifecycle: 'RECEIVED' },
          project_id: event.project_id,
          subject_revision: event.subject_revision,
          verification_captured: false,
          verified_revision: null,
          revisions,
          event_count: 1,
        },
      };
    }

    let verification_captured = projection.verification_captured === true;
    let verified_revision = projection.verified_revision ?? null;

    if (event.to_state === 'VERIFYING') {
      verification_captured = true;
      verified_revision = event.subject_revision;
    } else if (REOBSERVABLE.has(event.to_state)) {
      verification_captured = false;
      verified_revision = null;
    }

    const revisions = [...(projection.revisions ?? [])];
    if (event.type === 'REOBSERVED'
      && event.subject_revision
      && revisions.at(-1) !== event.subject_revision) {
      revisions.push(event.subject_revision);
    }

    return {
      status: 'ACCEPTED',
      inspection,
      projection: {
        ...projection,
        revision: adjudication.decision.next_projection.revision,
        states: adjudication.decision.next_projection.states,
        subject_revision: event.type === 'REOBSERVED'
          ? event.subject_revision
          : projection.subject_revision,
        verification_captured,
        verified_revision,
        revisions,
        event_count: (projection.event_count ?? 0) + 1,
      },
    };
  }

  function replay(events) {
    let projection = null;
    for (const [index, event] of (events ?? []).entries()) {
      const result = apply(projection, event);
      if (result.status !== 'ACCEPTED') {
        return {
          status: 'INVALID',
          index,
          line: index + 1,
          event,
          inspection: result.inspection,
          projection,
        };
      }
      projection = result.projection;
    }
    return { status: 'VALID', projection };
  }

  return Object.freeze({
    inspect,
    decide,
    apply,
    replay,
    workflow_id: workflow.workflow_id,
    workflow_version: workflow.version,
  });
}
