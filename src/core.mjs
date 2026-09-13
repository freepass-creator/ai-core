const DEV_HINTS = ['개발','코드','ui','ux','erp','웹','앱','버그','기능','firebase','react','typescript','javascript','api'];
const DOC_HINTS = ['문서','보고서','pdf','계약서','양식'];
const LEGAL_HINTS = ['법률','소송','준비서면','고소','판례','법원'];

export function normalizeTask(input = {}) {
  if (!input.goal || typeof input.goal !== 'string') throw new Error('goal is required');
  return {
    task_id: input.task_id ?? `CORE-${Date.now()}`,
    goal: input.goal.trim(),
    project: input.project ?? null,
    domain: input.domain ?? inferDomain(input.goal),
    risk: input.risk ?? 'A',
    authority_required: Boolean(input.authority_required),
    done_when: input.done_when ?? [],
    constraints: input.constraints ?? [],
    changed_files_estimate: Number(input.changed_files_estimate ?? 0),
    needs_build: Boolean(input.needs_build),
    needs_dependency_install: Boolean(input.needs_dependency_install),
    needs_runtime_debug: Boolean(input.needs_runtime_debug),
    cloud_reproducible: input.cloud_reproducible !== false,
    external_effect: input.external_effect ?? 'none'
  };
}

export function inferDomain(goal) {
  const s = goal.toLowerCase();
  if (DEV_HINTS.some(x => s.includes(x))) return 'development';
  if (LEGAL_HINTS.some(x => s.includes(x))) return 'legal';
  if (DOC_HINTS.some(x => s.includes(x))) return 'document';
  return 'business';
}

export function sourcePlan(task) {
  const sources = [{ owner_system: 'project', reason: 'current project instructions and current revision', required: Boolean(task.project) }];
  sources.push({ owner_system: 'aiops', reason: 'business meaning, operational failures, authority and SSOT pointers', required: task.domain !== 'development' || Boolean(task.project) });
  if (task.domain === 'development' || task.domain === 'document') {
    sources.push({ owner_system: 'devcenter', reason: 'standards, registry, reusable assets and verification', required: true });
  }
  return sources;
}

export function capabilityPlan(task) {
  if (task.domain !== 'development' && task.domain !== 'document') return [];
  const scopes = ['dev.repo.lifecycle'];
  const g = task.goal.toLowerCase();
  if (g.includes('ui') || g.includes('ux') || g.includes('화면') || g.includes('상품')) scopes.push('dev.design.token', 'dev.design.atom');
  if (g.includes('상품') || g.includes('카드')) scopes.push('dev.design.atom.product_card');
  if (task.domain === 'document') scopes.push('dev.doc.form');
  return [...new Set(scopes)].map(scope => ({ scope, registry: 'freepass-creator/devcenter:registry.json', status: 'resolve_required' }));
}

export function executionRoute(task) {
  const external = task.external_effect !== 'none' || task.authority_required || task.risk === 'D';
  if (external) return { route: 'HUMAN_GATE', reason: 'external or authority-sensitive action; existing owner-system approval remains required' };
  if (!task.cloud_reproducible) return { route: 'LOCAL_REQUIRED', reason: 'task is declared not reproducible in cloud' };
  const codex = task.changed_files_estimate >= 10 || task.needs_build || task.needs_dependency_install || task.needs_runtime_debug;
  if (codex) return { route: 'WORK_CODEX', reason: 'repository execution/build/test/debug loop is required' };
  return { route: 'GPT_DIRECT', reason: 'bounded design or GitHub-native change without declared execution-heavy requirements' };
}

export function orchestrate(input) {
  const task = normalizeTask(input);
  const sources = sourcePlan(task);
  const capabilities = capabilityPlan(task);
  const execution = executionRoute(task);
  const holds = [];
  if (!task.project && task.domain === 'development') holds.push('PROJECT_UNRESOLVED');
  if (!task.done_when.length) holds.push('DONE_WHEN_UNSPECIFIED');
  return {
    core_version: '0.1.0',
    task,
    source_plan: sources,
    capability_plan: capabilities,
    execution,
    status: holds.length ? 'HOLD' : execution.route === 'HUMAN_GATE' ? 'APPROVAL_REQUIRED' : 'READY',
    holds,
    work_packet: {
      task_id: task.task_id,
      project: task.project,
      goal: task.goal,
      allowed_scope: task.constraints,
      done_when: task.done_when,
      required_sources: sources.filter(x => x.required).map(x => x.owner_system),
      capability_scopes: capabilities.map(x => x.scope),
      execution_route: execution.route,
      evidence_required: ['subject_revision', 'checks_executed', 'failures_and_skips', 'review_status']
    },
    execution_authorized: false
  };
}
