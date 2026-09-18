import { validateCapabilityRegistryReferences } from './capability-registry.mjs';

const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

function projectTerms(project) {
  const repoTail = String(project.repository ?? '').split('/').pop();
  return [...new Set([project.project_id, project.name, repoTail].filter(Boolean).map(normalize))];
}

export function resolveProject({ text, projectHint = null, projectRegistry }) {
  const source = normalize(text);
  const projects = projectRegistry.projects ?? [];
  if (projectHint) {
    const hint = normalize(projectHint);
    const matches = projects.filter(project => projectTerms(project).includes(hint));
    if (matches.length === 1) return { status: 'RESOLVED', project: structuredClone(matches[0]), source: 'HINT' };
    if (matches.length > 1) return { status: 'AMBIGUOUS', candidates: matches.map(p => p.project_id) };
    return { status: 'UNKNOWN', candidates: [] };
  }
  const scored = projects.map(project => {
    const matched = projectTerms(project).filter(term => term.length > 1 && source.includes(term));
    return { project, matched, score: matched.reduce((sum, term) => sum + Math.max(2, Math.min(8, term.length)), 0) };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return { status: 'UNRESOLVED', project: null, source: null };
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    return { status: 'AMBIGUOUS', candidates: scored.filter(x => x.score === scored[0].score).map(x => x.project.project_id) };
  }
  return { status: 'RESOLVED', project: structuredClone(scored[0].project), source: 'TEXT', matched: scored[0].matched };
}

function matchCapability(capability, text, resolvedProject) {
  if (capability.status !== 'ACTIVE') return null;
  const normalized = normalize(text);
  const none = (capability.match.none ?? []).map(normalize);
  if (none.some(term => normalized.includes(term))) return null;
  const all = (capability.match.all ?? []).map(normalize);
  if (all.length && !all.every(term => normalized.includes(term))) return null;
  const any = capability.match.any.map(normalize);
  const matched = any.filter(term => normalized.includes(term));
  if (!matched.length) return null;

  const projectId = resolvedProject?.project_id ?? null;
  if (projectId && !capability.projects.includes('*') && !capability.projects.includes(projectId)) return null;

  const termScore = matched.reduce((sum, term) => sum + (term.length >= 6 ? 3 : 2), 0);
  const allScore = all.length ? all.length * 3 : 0;
  const projectScore = projectId
    ? (capability.projects.includes(projectId) ? 5 : capability.projects.includes('*') ? 1 : 0)
    : 0;
  const score = termScore + allScore + projectScore;
  if (score < capability.match.min_score) return null;
  return { capability, score, matched_terms: matched, project_score: projectScore };
}

export function routeCapability({ text, projectHint = null, capabilityRegistry, projectRegistry }) {
  validateCapabilityRegistryReferences(capabilityRegistry, projectRegistry);
  const value = normalize(text);
  if (!value) return { status: 'NO_MATCH', reason: 'EMPTY_REQUEST', candidates: [] };

  const projectResolution = resolveProject({ text: value, projectHint, projectRegistry });
  if (projectResolution.status === 'AMBIGUOUS') {
    return { status: 'AMBIGUOUS_PROJECT', candidates: projectResolution.candidates };
  }
  if (projectHint && projectResolution.status === 'UNKNOWN') {
    return { status: 'UNKNOWN_PROJECT', candidates: [] };
  }
  const resolvedProject = projectResolution.project ?? null;
  const candidates = capabilityRegistry.capabilities
    .map(capability => matchCapability(capability, value, resolvedProject))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.capability.priority - a.capability.priority || a.capability.id.localeCompare(b.capability.id));

  if (!candidates.length) return {
    status: 'NO_MATCH',
    reason: 'NO_CAPABILITY_MATCH',
    project_id: resolvedProject?.project_id ?? null,
    candidates: [],
  };

  const best = candidates[0];
  const tied = candidates.filter(item => item.score === best.score && item.capability.priority === best.capability.priority);
  if (tied.length > 1) return {
    status: 'AMBIGUOUS_CAPABILITY',
    project_id: resolvedProject?.project_id ?? null,
    candidates: tied.map(item => item.capability.id),
  };

  const fixedProjects = best.capability.projects.filter(id => id !== '*');
  const projectId = resolvedProject?.project_id ?? (fixedProjects.length === 1 ? fixedProjects[0] : null);
  if (!projectId && best.capability.projects.includes('*')) {
    return { status: 'PROJECT_REQUIRED', capability_id: best.capability.id, candidates: [] };
  }
  return {
    status: 'ROUTED',
    capability_id: best.capability.id,
    project_id: projectId,
    mode: best.capability.mode,
    score: best.score,
    matched_terms: best.matched_terms,
    project_source: projectResolution.source ?? (fixedProjects.length === 1 ? 'CAPABILITY' : null),
  };
}
