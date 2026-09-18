import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { capabilityIndex, capabilitySupportsProject } from '../engine/capability-registry.mjs';

const schema = JSON.parse(readFileSync(new URL('../../contracts/work-map.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

export function normalizeWorkQuery(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function aliasScore(query, alias) {
  const a = normalizeWorkQuery(alias);
  if (!a || !query) return 0;
  if (query === a) return 10000 + a.length;
  if (query.includes(a)) return 1000 + a.length * 10;
  const words = a.split(' ').filter(Boolean);
  if (words.length > 1 && words.every((word) => query.includes(word))) return 100 + a.length;
  return 0;
}

export function validateWorkMap(workMap, projectRegistry, capabilityRegistry) {
  const errors = [];
  if (!validateSchema(workMap)) {
    errors.push(...validateSchema.errors.map((error) => ({
      code: `SCHEMA_${error.keyword.toUpperCase()}`,
      path: error.instancePath || '$',
    })));
    return { status: 'INVALID', errors };
  }

  const projects = new Map((projectRegistry?.projects ?? []).map((project) => [project.project_id, project]));
  let capabilities;
  try { capabilities = capabilityIndex(capabilityRegistry); }
  catch { return { status:'INVALID', errors:[{code:'CAPABILITY_REGISTRY_INVALID',path:'$'}] }; }

  const ids = new Set();
  for (const [index, work] of workMap.work_types.entries()) {
    const path = `work_types/${index}`;
    if (ids.has(work.work_type_id)) errors.push({ code: 'WORK_TYPE_ID_DUPLICATE', path: `${path}/work_type_id` });
    ids.add(work.work_type_id);
    if (!projects.has(work.target_project_id)) errors.push({ code: 'TARGET_PROJECT_NOT_REGISTERED', path: `${path}/target_project_id` });
    const capability = capabilities.get(work.capability_id);
    if (!capability) errors.push({ code: 'CAPABILITY_NOT_REGISTERED', path: `${path}/capability_id` });
    else if (!capabilitySupportsProject(capability, work.target_project_id)) errors.push({ code: 'CAPABILITY_PROJECT_MISMATCH', path: `${path}/capability_id` });
  }

  return { status: errors.length ? 'INVALID' : 'VALID', errors };
}

export function routeWork(queryValue, { workMap, projectRegistry, capabilityRegistry }) {
  const query = normalizeWorkQuery(queryValue);
  if (!query) return { status: 'UNKNOWN', reason: 'EMPTY_QUERY', query };

  const scored = workMap.work_types
    .map((work) => {
      const matches = work.aliases
        .map((alias) => ({ alias, score: aliasScore(query, alias) }))
        .filter((match) => match.score > 0)
        .sort((a, b) => b.score - a.score || b.alias.length - a.alias.length);
      return { work, score: matches[0]?.score ?? 0, matched_alias: matches[0]?.alias ?? null };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.work.work_type_id.localeCompare(b.work.work_type_id));

  if (!scored.length) return { status: 'UNKNOWN', reason: 'NO_WORK_TYPE_MATCH', query };

  const bestScore = scored[0].score;
  const tied = scored.filter((row) => row.score === bestScore);
  if (tied.length > 1) {
    return {
      status: 'AMBIGUOUS', reason: 'MULTIPLE_WORK_TYPES_MATCH', query,
      candidates: tied.map((row) => ({
        work_type_id: row.work.work_type_id, name: row.work.name,
        target_project_id: row.work.target_project_id, capability_id: row.work.capability_id,
        matched_alias: row.matched_alias,
      })),
    };
  }

  const { work, matched_alias } = scored[0];
  const project = (projectRegistry.projects ?? []).find((item) => item.project_id === work.target_project_id);
  const capability = (capabilityRegistry.capabilities ?? []).find((item) => item.id === work.capability_id);

  if (!project) {
    return { status:'HOLD_PROJECT_UNKNOWN', reason:'TARGET_PROJECT_NOT_REGISTERED', query,
      work_type_id:work.work_type_id, target_project_id:work.target_project_id, capability_id:work.capability_id };
  }
  if (!capability) {
    return { status:'HOLD_CAPABILITY_UNKNOWN', reason:'CAPABILITY_NOT_REGISTERED', query,
      work_type_id:work.work_type_id, target_project_id:work.target_project_id, capability_id:work.capability_id };
  }

  const base = {
    query, work_type_id: work.work_type_id, name: work.name, domain: work.domain, matched_alias,
    target_project_id: work.target_project_id, target_repository: project.repository,
    target_revision: project.head_revision, project_status: project.status,
    capability_id: capability.id, capability_status: capability.status, capability_mode: capability.mode,
    work_id_prefix: capability.work_id_prefix ?? 'WORK',
    approval_boundary: work.approval_boundary, completion_condition: work.completion_condition,
    source_pointers: work.source_pointers,
  };

  if (project.status !== 'ACTIVE') {
    return { status:`HOLD_PROJECT_${project.status}`, reason:'TARGET_PROJECT_NOT_ACTIVE', ...base, blockers:project.known_blockers ?? [] };
  }
  if (capability.status !== 'ACTIVE') {
    return { status:`HOLD_CAPABILITY_${capability.status}`, reason:'CAPABILITY_NOT_ACTIVE', ...base, blockers:[capability.hold_reason] };
  }
  return { status:'RESOLVED', ...base, blockers:[] };
}
