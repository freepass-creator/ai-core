import { resolveSourceRequirements, bindResolvedSources } from './source-resolver.mjs';
import { compileContext } from './context-compiler.mjs';
import { resolveCapabilities } from './capability-resolver.mjs';
import {
  compileEvolutionPlan,
  derivePreflightSignals,
  reviewLensesFor
} from './evolution-kernel.mjs';
import { compileConversationLearning } from './conversation-learning.mjs';
import { compileProofContract } from './domain-quality.mjs';

export const CORE_VERSION = '0.4.0-candidate.0';

const DEV_HINTS = [
  '개발', '코드', 'ui', 'ux', 'erp', '웹', '앱', '버그', '기능',
  'firebase', 'react', 'typescript', 'javascript', 'api'
];
const DOC_HINTS = ['문서', '보고서', 'pdf', '계약서', '양식'];
const LEGAL_HINTS = ['법률', '소송', '준비서면', '고소', '판례', '법원'];
const COMMUNICATION_HINTS = ['이메일', '메일', '메시지', '공문', '안내문', '회신'];
const DOMAINS = new Set(['development', 'document', 'legal', 'business', 'communication']);
const RISKS = new Set(['A', 'B', 'C', 'D']);

function defaultRiskForDomain(domain) {
  return domain === 'legal' ? 'C' : 'A';
}

function normalizeDoneWhen(doneWhen) {
  if (!Array.isArray(doneWhen)) return [];
  return doneWhen.map((entry, index) => {
    if (typeof entry === 'string') {
      if (!entry.trim()) throw new Error(`done_when[${index}] must not be empty`);
      return entry.trim();
    }
    if (entry && typeof entry === 'object' && String(entry.text ?? '').trim()) {
      return {
        id: entry.id ? String(entry.id) : `REQ-${String(index + 1).padStart(3, '0')}`,
        text: String(entry.text),
        mode: entry.mode ? String(entry.mode) : 'automated',
        required: entry.required !== false
      };
    }
    throw new Error(`done_when[${index}] must be a string or requirement object`);
  });
}

export function normalizeTask(input = {}) {
  if (!input.goal || typeof input.goal !== 'string' || !input.goal.trim()) {
    throw new Error('goal is required');
  }

  const domain = input.domain ?? inferDomain(input.goal);
  const risk = input.risk ?? defaultRiskForDomain(domain);
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
    done_when: normalizeDoneWhen(input.done_when),
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
  if (COMMUNICATION_HINTS.some(hint => normalized.includes(hint))) return 'communication';
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
    const requiredApprovals = ['CLAUDE_DESIGN', 'CLAUDE_FINAL', 'USER_JUST_IN_TIME'];
    if (task.domain === 'legal') requiredApprovals.push('RESPONSIBLE_HUMAN_FINAL_REVIEW');
    return {
      route: 'HUMAN_GATE',
      reason: 'live or external effect requires owner-system gates',
      required_approvals: requiredApprovals
    };
  }
  if (task.risk === 'C') {
    const requiredApprovals = ['CLAUDE_DESIGN'];
    if (task.domain === 'legal') requiredApprovals.push('RESPONSIBLE_HUMAN_FINAL_REVIEW');
    return {
      route: 'HUMAN_GATE',
      reason: 'new workflow or protected structure requires design approval',
      required_approvals: requiredApprovals
    };
  }
  if (task.domain === 'legal') {
    return {
      route: 'HUMAN_GATE',
      reason: 'legal work requires current official authority and responsible human review',
      required_approvals: ['RESPONSIBLE_HUMAN_FINAL_REVIEW']
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

  const learning = compileConversationLearning(
    Array.isArray(environment.conversation_observations)
      ? environment.conversation_observations
      : []
  );
  if (learning.status === 'HOLD_CONFLICT') holds.push('LEARNING_CONFLICT');
  if (learning.status === 'HOLD_INVALID_INPUT') holds.push('LEARNING_INPUT_REJECTED');

  const proofEvaluationRequested = environment.proof_evaluation_requested === true
    || Array.isArray(environment.proof_receipts);
  const assurance = compileProofContract(task, {
    subjectRevision: environment.subject_revision ?? null,
    receipts: Array.isArray(environment.proof_receipts) ? environment.proof_receipts : [],
    evaluationRequested: proofEvaluationRequested
  });
  if (proofEvaluationRequested && assurance.gate.status === 'FAIL') {
    holds.push('PROOF_GATE_FAILED');
  } else if (proofEvaluationRequested && assurance.gate.status !== 'PASS') {
    holds.push('PROOF_GATE_HOLD');
  }

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
  const proactiveReviewLenses = reviewLensesFor(task);
  const preflightSignals = environment.live_context_attempted
    ? derivePreflightSignals({
        task,
        sourceBindings,
        capabilityBindings,
        holds: uniqueHolds
      })
    : [];
  const evolution = compileEvolutionPlan({
    task,
    observations: [
      ...preflightSignals,
      ...learning.signals,
      ...(Array.isArray(environment.observations) ? environment.observations : [])
    ],
    sourcePointers: pinnedSources
  });

  return {
    core_version: CORE_VERSION,
    task,
    source_requirements: requirements,
    source_bindings: sourceBindings,
    requested_capability_scopes: requestedScopes,
    capability_bindings: capabilityBindings,
    context,
    execution,
    learning,
    assurance,
    evolution,
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
      proactive_review_lenses: proactiveReviewLenses,
      proof_contract: {
        policy_revision: assurance.policy_revision,
        domain: assurance.domain,
        requirement_set: assurance.requirement_set,
        obligations: assurance.obligations,
        gate: assurance.gate
      },
      learning_contract: {
        lifecycle: learning.lifecycle,
        candidate_rules: learning.candidates.map(candidate => ({
          rule_key: candidate.rule_key,
          fingerprint: candidate.fingerprint,
          domains: candidate.domains,
          maturity: candidate.maturity,
          governance_status: candidate.governance_status,
          source_refs: candidate.source_refs
        })),
        conflicts: learning.conflicts,
        resolved_conflicts: learning.resolved_conflicts,
        raw_conversation_stored: false,
        semantic_sanitization_verified: false,
        auto_adopted: false
      },
      feedback_contract: {
        destination: 'AI_CORE_EVOLUTION_KERNEL',
        accepts: [
          'failures',
          'friction',
          'unexpected_results',
          'metrics',
          'review_findings',
          'sanitized_conversation_observations'
        ]
      },
      evidence_required: [
        'subject_revision',
        'source_revision_set',
        'capability_revision_set',
        'requirement_set_digest',
        'checks_executed',
        'failures_and_skips',
        'proof_receipts',
        'review_status',
        'authorization_evidence',
        'execution_evidence',
        'outcome_evidence'
      ]
    },
    execution_authorized: false
  };
}
