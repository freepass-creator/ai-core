import { isConcreteScopeAllowed, operationPathScope } from './scope-contract.mjs';

const SAFE_DECLARED_EFFECTS = new Set(['none', 'local_artifact']);

const CONSEQUENTIAL_OPERATION = /(?:^|[:/._-])(deploy|merge|publish|send|email|message|delete|drop|purge|pay|payment|charge|transfer|grant|revoke|permission|invite|release|submit|upload)(?:$|[:/._-])/i;
const CONSEQUENTIAL_TARGET = /(?:^|[:/._-])(prod|production|live|customer|recipient|external|payment|billing|permission|account)(?:$|[:/._-])/i;
const NON_RETRACTABLE_OPERATION = /(?:^|[:/._-])(send|email|message|delete|drop|purge|pay|payment|charge|transfer|publish|submit)(?:$|[:/._-])/i;
const MUTATING_OPERATION = /(?:^|[:/._-])(write|create|update|modify|patch|delete|drop|purge|deploy|merge|publish|send|email|message|pay|payment|charge|transfer|grant|revoke|permission|invite|release|submit|upload)(?:$|[:/._-])/i;
const PATH_OPERATION = /^(?:read|write|patch):path:/i;

function normalized(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function assessActionSemantics(action = {}, {
  taskProject = null,
  taskScope = null
} = {}) {
  const effect = normalized(action.effect);
  const operation = normalized(action.operation);
  const rawOperation = typeof action.operation === 'string' ? action.operation.trim() : '';
  const operationVerb = operation.split(':', 1)[0];
  const target = normalized(action.target);
  const project = normalized(taskProject);
  const declaredSafe = SAFE_DECLARED_EFFECTS.has(effect);
  const operationScope = operationPathScope(rawOperation);
  const recognizedSafeOperation = operationScope !== null;
  const operationScopeAllowed = Boolean(
    operationScope
    && taskScope
    && isConcreteScopeAllowed(operationScope, taskScope)
  );
  const operationConsequential = CONSEQUENTIAL_OPERATION.test(operationVerb);
  const targetConsequential = CONSEQUENTIAL_TARGET.test(target);
  const recognizedLocalTarget = project
    ? target === project || target === `project:${project}`
    : /^local:(?:workspace|draft|artifact)$/.test(target);
  const crossProjectLocalTarget = Boolean(declaredSafe && target && !recognizedLocalTarget);
  const inferredConsequential = operationConsequential
    || targetConsequential
    || crossProjectLocalTarget;
  const knownNonRetractable = NON_RETRACTABLE_OPERATION.test(operationVerb)
    || NON_RETRACTABLE_OPERATION.test(effect);
  const issues = [];
  if (declaredSafe && !recognizedSafeOperation) {
    issues.push(PATH_OPERATION.test(rawOperation)
      ? 'ACTION_OPERATION_SCOPE_INVALID'
      : 'UNRECOGNIZED_SAFE_OPERATION');
  }
  if (declaredSafe && recognizedSafeOperation && !operationScopeAllowed) {
    issues.push(taskScope ? 'ACTION_OPERATION_SCOPE_OUTSIDE_PLAN' : 'ACTION_OPERATION_SCOPE_UNRESOLVED');
  }
  if (declaredSafe && !recognizedLocalTarget) issues.push('UNRECOGNIZED_LOCAL_TARGET');
  if (declaredSafe && inferredConsequential) issues.push('DECLARED_EFFECT_CONTRADICTS_ACTION_SEMANTICS');
  if (action.reversible === true && knownNonRetractable) {
    issues.push('REVERSIBILITY_CLAIM_CONTRADICTS_ACTION_SEMANTICS');
  }
  if (crossProjectLocalTarget) issues.push('LOCAL_ACTION_TARGET_OUTSIDE_TASK_PROJECT');
  return {
    classification: declaredSafe
      && recognizedSafeOperation
      && operationScopeAllowed
      && recognizedLocalTarget
      && !inferredConsequential
      ? 'LOCAL_PREPARATION'
      : 'CONSEQUENTIAL',
    declared_safe: declaredSafe,
    inferred_consequential: inferredConsequential,
    known_non_retractable: knownNonRetractable,
    mutating_operation: MUTATING_OPERATION.test(operationVerb)
      || /^(?:write|patch):path:/.test(operation)
      || effect === 'local_artifact',
    operation_scope: operationScope,
    operation_scope_allowed: operationScopeAllowed,
    issues,
    safe_preparation_candidate: declaredSafe
      && recognizedSafeOperation
      && operationScopeAllowed
      && recognizedLocalTarget
      && !inferredConsequential
      && !knownNonRetractable
      && action.reversible === true
      && action.approval_required !== true
  };
}

export function actionRequiresExecutionReview(action, options = {}) {
  return !assessActionSemantics(action, options).safe_preparation_candidate;
}
