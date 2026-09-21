import { createHash } from 'node:crypto';

const SHA = /^[a-f0-9]{40}$/;
const SESSION_STATES = new Set(['active', 'idle', 'notLoaded', 'completed', 'failed', 'unknown']);
const REPOSITORY_PATH = /^(?![A-Za-z]:)(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$)).+/;

function required(value, code) {
  if (!value) throw new Error(code);
  return value;
}

function projectRevisionSet(project) {
  return new Set([
    project.github?.main_head,
    ...(project.github?.open_prs ?? []).map((pr) => pr.head_revision),
    project.local?.head,
  ].filter((value) => SHA.test(value ?? '')));
}

function deriveIntegrity(project) {
  const reasons = [];
  if (project.registry_registered === false) reasons.push('PROJECT_NOT_REGISTERED');
  if (!SHA.test(project.github?.main_head ?? '')) reasons.push('GITHUB_MAIN_HEAD_UNVERIFIED');
  if (!project.local?.exists) reasons.push('LOCAL_PATH_MISSING');
  if ((project.local?.dirty_entries ?? 0) > 0) reasons.push('LOCAL_DIRTY');
  if ((project.additional_checkouts ?? []).some((item) => (item.dirty_entries ?? 0) > 0)) reasons.push('ALTERNATE_CHECKOUT_DIRTY');
  if (project.local?.exists && !SHA.test(project.local?.head ?? '')) reasons.push('LOCAL_HEAD_UNVERIFIED');
  if (project.local?.branch === project.default_branch && project.local?.head !== project.github?.main_head) {
    reasons.push('LOCAL_DEFAULT_BRANCH_DRIFT');
  }
  if (project.registry_revision && project.registry_revision !== project.github?.main_head) {
    reasons.push('REGISTRY_REVISION_STALE');
  }
  if (project.registry_path !== undefined && project.registry_path !== project.local?.path) {
    reasons.push('REGISTRY_PATH_DRIFT');
  }
  if (project.deployment?.status === 'HOLD') reasons.push('DEPLOYMENT_HOLD');
  return { status: reasons.length ? 'HOLD' : 'READY', reasons };
}

function deriveWorkStatus(session) {
  if (!session) return 'WAITING';
  if (!SESSION_STATES.has(session.state)) return 'HOLD';
  if (session.state === 'active') return 'IN_PROGRESS';
  if (session.state === 'failed') return 'HOLD';
  if (session.state === 'completed' && session.completion_evidence?.length) return 'COMPLETED';
  return 'WAITING';
}

function deriveDependency(dependency, byId) {
  const endpoints = dependency.bindings.map((binding) => {
    const project = byId.get(binding.project_id);
    const observed = project ? projectRevisionSet(project).has(binding.revision) : false;
    return { ...binding, observed };
  });
  const reasons = [];
  if (endpoints.some((item) => !item.observed)) reasons.push('REVISION_NOT_OBSERVED');
  if (!dependency.evidence_refs?.length) reasons.push('EVIDENCE_MISSING');
  if (dependency.readiness === 'HOLD') reasons.push('DECLARED_HOLD');
  return {
    ...dependency,
    bindings: endpoints,
    status: reasons.length ? 'HOLD' : 'BOUND',
    reasons,
  };
}

export function buildOperationsBoard(snapshot) {
  required(snapshot?.schema === 'ai-core-operations-observation/v1', 'OBSERVATION_SCHEMA_INVALID');
  required(snapshot.observed_at, 'OBSERVED_AT_REQUIRED');
  required(Array.isArray(snapshot.projects), 'PROJECTS_REQUIRED');

  const ids = new Set();
  const projects = snapshot.projects.map((project) => {
    required(project.project_id, 'PROJECT_ID_REQUIRED');
    if (ids.has(project.project_id)) throw new Error(`PROJECT_DUPLICATE:${project.project_id}`);
    ids.add(project.project_id);
    const session = snapshot.sessions?.find((item) => item.project_id === project.project_id) ?? null;
    const integrity = deriveIntegrity(project);
    if (session?.cwd !== undefined && session.cwd !== project.local?.path) {
      integrity.status = 'HOLD';
      integrity.reasons.push('SESSION_CWD_DRIFT');
    }
    const work_status = deriveWorkStatus(session);
    return {
      ...project,
      session,
      work_status,
      integrity,
      status: integrity.status === 'HOLD' || work_status === 'HOLD' ? 'HOLD' : work_status,
      next_order: project.next_order ?? null,
      deployment: project.deployment ?? { status: 'UNKNOWN', evidence: [] },
    };
  });
  const byId = new Map(projects.map((project) => [project.project_id, project]));
  const dependencies = (snapshot.dependencies ?? []).map((item) => deriveDependency(item, byId));
  const roundtrips = verifyOrderRoundTrips(snapshot.route_receipts ?? [], byId, snapshot.sessions ?? []);
  const counts = {};
  for (const project of projects) counts[project.status] = (counts[project.status] ?? 0) + 1;
  return {
    schema: 'ai-core-operations-board/v1',
    observed_at: snapshot.observed_at,
    generated_at: snapshot.generated_at ?? snapshot.observed_at,
    source: snapshot.source,
    summary: {
      project_count: projects.length,
      status_counts: counts,
      dependency_holds: dependencies.filter((item) => item.status === 'HOLD').length,
      order_roundtrip_status: roundtrips.status,
    },
    projects,
    dependencies,
    order_roundtrips: roundtrips,
  };
}

export function validateDependencyCatalog(snapshot, catalog) {
  required(catalog?.schema === 'ai-core-operations-dependencies/v1', 'DEPENDENCY_CATALOG_SCHEMA_INVALID');
  const definitions = new Map((catalog.relationships ?? []).map((item) => [item.dependency_id, item]));
  if (definitions.size !== (catalog.relationships ?? []).length) throw new Error('DEPENDENCY_CATALOG_DUPLICATE');
  const observedIds = new Set((snapshot.dependencies ?? []).map((item) => item.dependency_id));
  for (const definition of definitions.values()) {
    const observed = (snapshot.dependencies ?? []).find((item) => item.dependency_id === definition.dependency_id);
    required(observed, `DEPENDENCY_OBSERVATION_MISSING:${definition.dependency_id}`);
    const boundProjects = new Set(observed.bindings.map((item) => item.project_id));
    if (!boundProjects.has(definition.producer_project_id)) {
      throw new Error(`DEPENDENCY_PRODUCER_BINDING_MISSING:${definition.dependency_id}`);
    }
    for (const projectId of definition.consumer_project_ids) {
      if (!boundProjects.has(projectId)) throw new Error(`DEPENDENCY_CONSUMER_BINDING_MISSING:${definition.dependency_id}:${projectId}`);
    }
  }
  for (const dependencyId of observedIds) {
    if (!definitions.has(dependencyId)) throw new Error(`DEPENDENCY_DEFINITION_MISSING:${dependencyId}`);
  }
  return true;
}

export function verifyOrderRoundTrips(receipts, projects, sessions) {
  if (!receipts.length) {
    return { status: 'HOLD', verified: [], rejected: [], reasons: ['NO_DURABLE_ROUTE_RECEIPT'] };
  }
  const sessionIds = new Set(sessions.map((item) => item.session_id));
  const verified = [];
  const rejected = [];
  for (const receipt of receipts) {
    const reasons = [];
    if (!receipt.order_id) reasons.push('ORDER_ID_MISSING');
    if (!receipt.source_session_id) reasons.push('SOURCE_SESSION_MISSING');
    if (!sessionIds.has(receipt.target_session_id)) reasons.push('TARGET_SESSION_NOT_OBSERVED');
    if (!projects.has(receipt.project_id)) reasons.push('PROJECT_NOT_OBSERVED');
    if (receipt.result_returned_to !== receipt.source_session_id) reasons.push('RESULT_NOT_RETURNED_TO_SOURCE');
    if (!receipt.completion_evidence?.length) reasons.push('COMPLETION_EVIDENCE_MISSING');
    (reasons.length ? rejected : verified).push({ ...receipt, reasons });
  }
  return {
    status: rejected.length ? 'HOLD' : 'VERIFIED',
    verified,
    rejected,
    reasons: rejected.length ? ['ROUNDTRIP_RECEIPT_INVALID'] : [],
  };
}

export function buildSessionHandoff(board, closeout) {
  required(board?.schema === 'ai-core-operations-board/v1', 'BOARD_SCHEMA_INVALID');
  const project = board.projects.find((item) => item.project_id === closeout.project_id);
  required(project, 'PROJECT_NOT_FOUND');
  required(closeout.session_id, 'SESSION_ID_REQUIRED');
  required(REPOSITORY_PATH.test(closeout.authoritative_path ?? ''), 'AUTHORITATIVE_PATH_INVALID');
  required(SHA.test(closeout.revision ?? ''), 'REVISION_INVALID');
  required(projectRevisionSet(project).has(closeout.revision), 'REVISION_NOT_OBSERVED');
  required(Array.isArray(closeout.completion_evidence) && closeout.completion_evidence.length, 'COMPLETION_EVIDENCE_REQUIRED');
  required(closeout.next_order, 'NEXT_ORDER_REQUIRED');
  const payload = {
    schema: 'ai-core-session-handoff/v1',
    observed_at: board.observed_at,
    closed_at: closeout.closed_at,
    session_id: closeout.session_id,
    source_order_id: closeout.source_order_id ?? null,
    project_id: closeout.project_id,
    repository: project.repository,
    authoritative_path: closeout.authoritative_path,
    revision: closeout.revision,
    result_status: closeout.result_status,
    completion_evidence: closeout.completion_evidence,
    next_order: closeout.next_order,
    return_to_session_id: closeout.return_to_session_id ?? null,
    authority: 'EVIDENCE_ONLY_NO_MERGE_DEPLOY_OR_EXTERNAL_WRITE',
  };
  return {
    ...payload,
    digest: `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`,
  };
}
