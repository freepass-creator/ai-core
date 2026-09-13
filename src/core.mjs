import { resolveSourceRequirements, bindResolvedSources } from './source-resolver.mjs';
import { compileContext } from './context-compiler.mjs';
import { resolveCapabilities } from './capability-resolver.mjs';

export const CORE_VERSION = '0.2.0-candidate.0';

const DEV_HINTS = [
  '개발', '코드', 'ui', 'ux', 'erp', '웹', '앱', '버그', '기능',
  'firebase', 'react', 'typescript', 'javascript', 'api'
];
const DOC_HINTS = ['문서', '보고서', 'pdf', '계약서', '양식'];
const LEGAL_HINTS = ['법률', '소송', '준비서면', '고소', '판례', '법원'];
const DOMAINS = new Set(['development', 'document', 'legal', 'business']);
const RISKS = new Set(['A', 'B', 'C', 'D']);

export function normalizeTask(input = {}) {
  if (!input.goal || typeof input.goal !== 'string' || !input.goal.trim()) {
    throw new Error('goal is required');
  }

  const domain = input.domain ?? inferDomain(input.goal);
  const risk = input.risk ?? 'A';
  if (!DOMAINS.has(domain)) throw new Error(`unsupported domain: ${domain}`);
  if (!RISKS.has(risk)) throw new Error(`unsupported risk: ${risk}`);

  const changedFilesEstimate = Number(input.changed_files_estimate ?? 0);
  if (!Number.isInteger(changedFilesEstimate) || changedFilesEstimate < 0) {
    throw new Error('changed_files_estimate must be a non-negative integer');
  }

  return {
    task_id: input.task_id ?? `CORE-${Date.now()}`,
    goal: input.goal.trim(),
    project: input.project ?? null,
    project_ref: input.project_ref ?? 'main',
    domain,
    risk,
    authority_required: Boolean(input.authority_required),
    done_when: Array.isArray(input.done_when) ? input.done_when : [],
    constraints: Array.isArray(input.constraints) ? input.constraints : [],
    changed_files_estimate: changedFilesEstimate,
    needs_build: Boolean(input.needs_build),
    needs_dependency_install: Boolean(input.needs_dependency_install),
    needs_runtime_debug: Boolean(input.needs_runtime_debug),
    cloud_reproducible: input.cloud_reproducible !== false,
    external_effect: input.external_effect ?? 'none'
  };
}

export function inferDomain(goal) {
  const normalized = goal.toLowerCase();
  if (DEV_HINTS.some(hint => normalized.includes(hint))) return 'development';
  if (LEGAL_HINTS.some(hint => normalized.includes(hint))) return 'legal';
  if (DOC_HINTS.some(hint => normalized.includes(hint))) return 'document';
  return 'business';
}

export function capabilityPlan(task) {
  if (!['development', 'document'].includes(task.domain)) return [];

  const scopes = ['dev.repo.lifecycle'];
  const goal = task.goal.toLowerCase();
  if (['ui', 'ux', '화면', '상품'].some(hint => goal.includes(hint))) {
    scopes.push('dev.design.token', 'dev.design.atom');
  }
  if (['상품', '카드'].some(hint => goal.includes(hint))) {
    scopes.push('dev.design.atom.product_card');
  }
  if (task.domain === 'document') scopes.push('dev.doc.form');
  return [...new Set(scopes)];
}

export function executionRoute(task) {
  const hasExternalEffect = task.external_effect !== 'none';
  if (task.risk === 'D' || hasExternalEffect) {
    return {
      route: 'HUMAN_GATE',
      reason: 'live or external effect requires owner-system gates',
      required_approvals: ['CLAUDE_DESIGN', 'CLAUDE_FINAL', 'USER_JUST_IN_TIME']
    };
  }
  if (task.risk === 'C') {
    return {
      route: 'HUMAN_GATE',
      reason: 'new workflow or protected structure requires design approval',
      required_approvals: ['CLAUDE_DESIGN']
    };
  }
  if (task.authority_required) {
    return {
      route: 'HUMAN_GATE',
      reason: 'owner-system authority is required',
      required_approvals: ['OWNER_SYSTEM_APPROVAL']
    };
  }
  if (!task.cloud_reproducible) {
    return {
      route: 'LOCAL_REQUIRED',
      reason: 'not reproducible in cloud',
      required_approvals: []
    };
  }
  if (
    task.changed_files_estimate >= 10
    || task.needs_build
    || task.needs_dependency_install
    || task.needs_runtime_debug
  ) {
    return {
      route: 'WORK_CODEX',
      reason: 'repository execution/build/test/debug loop required',
      required_approvals: []
    };
  }
  return {
    route: 'GPT_DIRECT',
    reason: 'bounded GitHub-native work',
    required_approvals: []
  };
}

function contextPointersFromBindings(sourceBindings) {
  return sourceBindings.map(binding => {
    if (binding.status === 'BOUND') {
      return { ...binding.pointer, required: binding.required };
    }
    return {
      system: binding.system,
      kind: binding.kind,
      status: 'unresolved',
      location: binding.location ?? `${binding.system}:${binding.kind}`,
      reason: binding.reason ?? binding.status,
      required: binding.required
    };
  });
}

export function orchestrate(input, environment = {}) {
  const task = normalizeTask(input);
  const requirements = resolveSourceRequirements(task);
  const sourceBindings = bindResolvedSources(
    requirements,
    environment.resolved_sources ?? []
  );
  const requestedScopes = capabilityPlan(task);
  const capabilityBindings = environment.devcenter_registry
    ? resolveCapabilities(requestedScopes, environment.devcenter_registry)
    : requestedScopes.map(scope => ({ scope, status: 'RESOLVE_REQUIRED' }));
  const context = compileContext({
    task,
    sourcePointers: contextPointersFromBindings(sourceBindings),
    capabilityRefs: environment.capability_refs ?? [],
    failures: environment.failures ?? [],
    decisions: environment.decisions ?? []
  });
  const execution = executionRoute(task);
  const holds = [];

  if (!task.project && task.domain === 'development') holds.push('PROJECT_UNRESOLVED');
  if (task.project && !environment.subject_revision) {
    holds.push('SUBJECT_REVISION_UNRESOLVED');
  }
  if (!task.done_when.length) holds.push('DONE_WHEN_UNSPECIFIED');
  if (sourceBindings.some(binding => binding.required && binding.status !== 'BOUND')) {
    holds.push('SOURCE_HOLD');
  }
  if (capabilityBindings.some(binding => binding.status === 'HOLD')) {
    holds.push('CAPABILITY_CONFLICT');
  }
  if (capabilityBindings.some(binding => (
    ['RESOLVE_REQUIRED', 'SELECTED', 'CANDIDATE_ONLY', 'MISSING'].includes(binding.status)
  ))) {
    holds.push('CAPABILITY_UNRESOLVED');
  }
  if (context.status === 'HOLD') holds.push('CONTEXT_HOLD');

  const uniqueHolds = [...new Set(holds)];
  const status = uniqueHolds.length
    ? 'HOLD'
    : execution.route === 'HUMAN_GATE'
      ? 'APPROVAL_REQUIRED'
      : 'READY';
  const pinnedSources = sourceBindings
    .filter(binding => binding.status === 'BOUND')
    .map(binding => binding.pointer);
  const resolvedCapabilities = capabilityBindings
    .filter(binding => binding.status === 'RESOLVED')
    .map(binding => binding.asset);

  return {
    core_version: CORE_VERSION,
    task,
    source_requirements: requirements,
    source_bindings: sourceBindings,
    requested_capability_scopes: requestedScopes,
    capability_bindings: capabilityBindings,
    context,
    execution,
    status,
    holds: uniqueHolds,
    work_packet: {
      task_id: task.task_id,
      project: task.project,
      subject_revision: environment.subject_revision ?? null,
      goal: task.goal,
      allowed_scope: task.constraints,
      done_when: task.done_when,
      source_bindings: pinnedSources,
      capabilities: resolvedCapabilities,
      execution_route: execution.route,
      approval_requirements: execution.required_approvals,
      evidence_required: [
        'subject_revision',
        'source_revision_set',
        'capability_revision_set',
        'checks_executed',
        'failures_and_skips',
        'review_status'
      ]
    },
    execution_authorized: false
  };
}
