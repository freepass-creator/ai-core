const COMPONENT_KINDS = new Set(['E', 'A', 'R', 'X', 'P']);
const COMPONENT_STATUS = new Set(['DESIGN', 'IMPLEMENTED', 'WIRED', 'VERIFIED', 'STABLE']);
const DECISIONS = new Set(['PROPOSED', 'HOLD', 'ADOPTED', 'REJECTED', 'OBSOLETE']);
const RUN_STATUS = new Set(['PROPOSED', 'HOLD', 'ADOPTED']);
const ID = /^(E|A|R|X|P)-[A-Z0-9][A-Z0-9-]*-\d{3}$/;
const RUN_ID = /^RUN-\d{2}$/;
const UI_SET_ID = /^SET-\d{2}$/;
const FORBIDDEN_RTDB = /(^|[^a-z])(?:rtdb|realtime database|firebase\/database|databaseurl)([^a-z]|$)/i;

const need = (condition, code) => { if (!condition) throw new Error(code); };
const text = value => typeof value === 'string' && value.trim() === value && value.length > 0;
const list = value => Array.isArray(value) ? value : [];

function assertNoRtdb(value) {
  need(!FORBIDDEN_RTDB.test(JSON.stringify(value)), 'RTDB_COMPONENT_FORBIDDEN');
}

export function validateRuntimeSetCatalog(catalog) {
  need(catalog?.schema_version === 'ai-core-runtime-set-catalog/v1', 'RUNTIME_CATALOG_SCHEMA_INVALID');
  need(/^[0-9a-f]{40}$/.test(catalog.observed_revision ?? ''), 'RUNTIME_CATALOG_REVISION_INVALID');
  need(Number.isFinite(Date.parse(catalog.observed_at ?? '')), 'RUNTIME_CATALOG_OBSERVED_AT_INVALID');
  need(Array.isArray(catalog.components) && catalog.components.length > 0, 'RUNTIME_COMPONENTS_REQUIRED');
  need(Array.isArray(catalog.runtime_sets) && catalog.runtime_sets.length > 0, 'RUNTIME_SETS_REQUIRED');
  assertNoRtdb(catalog);
  const candidate = catalog.candidate_record;
  need(candidate?.source_type === 'CHAT_THREAD' && text(candidate.chat_thread_id), 'RUNTIME_CANDIDATE_SOURCE_REQUIRED');
  need(Number.isFinite(Date.parse(candidate.observed_at ?? '')), 'RUNTIME_CANDIDATE_OBSERVED_AT_INVALID');
  for (const field of ['claim', 'existing_asset', 'maturity', 'decision', 'target_project', 'next_smallest_change']) {
    need(text(candidate[field]), `RUNTIME_CANDIDATE_FIELD_REQUIRED:${field}`);
  }
  need(Array.isArray(candidate.duplicate_of), 'RUNTIME_CANDIDATE_DUPLICATES_INVALID');
  need(Array.isArray(candidate.evidence) && candidate.evidence.length > 0, 'RUNTIME_CANDIDATE_EVIDENCE_REQUIRED');

  const components = new Map();
  for (const component of catalog.components) {
    need(ID.test(component.id ?? ''), `RUNTIME_COMPONENT_ID_INVALID:${component.id ?? ''}`);
    need(component.kind === component.id.slice(0, 1) && COMPONENT_KINDS.has(component.kind), `RUNTIME_COMPONENT_KIND_INVALID:${component.id}`);
    need(!components.has(component.id), `RUNTIME_COMPONENT_DUPLICATE:${component.id}`);
    need(text(component.name), `RUNTIME_COMPONENT_NAME_REQUIRED:${component.id}`);
    need(COMPONENT_STATUS.has(component.maturity), `RUNTIME_COMPONENT_MATURITY_INVALID:${component.id}`);
    need(DECISIONS.has(component.decision), `RUNTIME_COMPONENT_DECISION_INVALID:${component.id}`);
    need(['CORE', 'PROJECT'].includes(component.scope), `RUNTIME_COMPONENT_SCOPE_INVALID:${component.id}`);
    need(component.source?.repository && /^[0-9a-f]{40}$/.test(component.source.revision ?? ''), `RUNTIME_COMPONENT_SOURCE_INVALID:${component.id}`);
    need(list(component.source.paths).length > 0 && component.source.paths.every(text), `RUNTIME_COMPONENT_PATH_REQUIRED:${component.id}`);
    need(list(component.verification_commands).length > 0 && component.verification_commands.every(text), `RUNTIME_COMPONENT_VERIFICATION_REQUIRED:${component.id}`);
    need(Array.isArray(component.hold_conditions), `RUNTIME_COMPONENT_HOLDS_INVALID:${component.id}`);
    if (component.local_shadow_only === true) {
      need(component.decision === 'HOLD', `RUNTIME_LOCAL_SHADOW_MUST_HOLD:${component.id}`);
    }
    components.set(component.id, component);
  }

  const runtimeSets = new Map();
  for (const runtimeSet of catalog.runtime_sets) {
    need(RUN_ID.test(runtimeSet.id ?? ''), `RUNTIME_SET_ID_INVALID:${runtimeSet.id ?? ''}`);
    need(!runtimeSets.has(runtimeSet.id), `RUNTIME_SET_DUPLICATE:${runtimeSet.id}`);
    need(text(runtimeSet.name), `RUNTIME_SET_NAME_REQUIRED:${runtimeSet.id}`);
    need(RUN_STATUS.has(runtimeSet.status), `RUNTIME_SET_STATUS_INVALID:${runtimeSet.id}`);
    need(list(runtimeSet.component_ids).length > 0, `RUNTIME_SET_COMPONENTS_REQUIRED:${runtimeSet.id}`);
    for (const componentId of runtimeSet.component_ids) {
      need(components.has(componentId), `RUNTIME_SET_COMPONENT_UNKNOWN:${runtimeSet.id}:${componentId}`);
    }
    need(list(runtimeSet.applicable_projects).length > 0 && runtimeSet.applicable_projects.every(text), `RUNTIME_SET_PROJECTS_REQUIRED:${runtimeSet.id}`);
    need(Array.isArray(runtimeSet.hold_conditions), `RUNTIME_SET_HOLDS_INVALID:${runtimeSet.id}`);
    need(list(runtimeSet.verification_commands).length > 0 && runtimeSet.verification_commands.every(text), `RUNTIME_SET_VERIFICATION_REQUIRED:${runtimeSet.id}`);
    runtimeSets.set(runtimeSet.id, runtimeSet);
  }

  for (const required of ['RUN-01', 'RUN-02', 'RUN-03', 'RUN-04']) {
    need(runtimeSets.has(required), `RUNTIME_SET_REQUIRED:${required}`);
  }
  const recommended = runtimeSets.get('RUN-01');
  for (const required of ['E-WORKFLOW-001', 'A-FIRESTORE-PATH-001', 'R-FIRESTORE-001', 'X-GITHUB-WORK-EVIDENCE-001']) {
    need(recommended.component_ids.includes(required), `RUN_01_DEFAULT_COMPONENT_REQUIRED:${required}`);
  }

  return { status: 'VALID', component_count: components.size, runtime_set_count: runtimeSets.size };
}

export function selectRuntimeSet(catalog, phrase) {
  validateRuntimeSetCatalog(catalog);
  need(text(phrase), 'RUNTIME_SELECTION_REQUIRED');
  const runMatches = [...phrase.toUpperCase().matchAll(/\bRUN-\d{2}\b/g)].map(match => match[0]);
  const uiMatches = [...phrase.toUpperCase().matchAll(/\bSET-\d{2}\b/g)].map(match => match[0]);
  need(runMatches.length === 1, runMatches.length ? 'RUNTIME_SELECTION_AMBIGUOUS' : 'RUNTIME_SELECTION_NOT_FOUND');
  need(uiMatches.length <= 1, 'UI_SET_SELECTION_AMBIGUOUS');
  const runtimeSet = catalog.runtime_sets.find(item => item.id === runMatches[0]);
  need(runtimeSet, 'RUNTIME_SET_NOT_FOUND');
  if (uiMatches.length) need(UI_SET_ID.test(uiMatches[0]), 'UI_SET_ID_INVALID');
  return {
    status: runtimeSet.status === 'ADOPTED' ? 'SELECTED' : 'HOLD',
    ui_set_id: uiMatches[0] ?? null,
    runtime_set_id: runtimeSet.id,
    component_ids: [...runtimeSet.component_ids],
    execution_authorized: false,
    deployment_authorized: false,
    hold_conditions: [...runtimeSet.hold_conditions],
  };
}
