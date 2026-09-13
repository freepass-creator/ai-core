import { createHash } from 'node:crypto';

const norm = v => String(v ?? '').trim().replace(/\s+/g, ' ');
const hash = v => createHash('sha256').update(v).digest('hex');

export function requirementDigest(requirements = []) {
  const active = requirements
    .filter(r => r.status === 'ACTIVE')
    .map(r => ({
      id: r.id,
      statement: norm(r.statement),
      acceptance: [...(r.acceptance ?? [])].map(norm).sort(),
      non_goals: [...(r.non_goals ?? [])].map(norm).sort(),
      version: r.version ?? 1
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return hash(JSON.stringify(active));
}

export function applyRequirementUpdate(requirements = [], update) {
  if (!update?.id || !update?.statement) throw new Error('id and statement required');
  const current = [...requirements]
    .filter(r => r.id === update.id && r.status === 'ACTIVE')
    .sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0];

  if (current && norm(current.statement) === norm(update.statement)
      && JSON.stringify(current.acceptance ?? []) === JSON.stringify(update.acceptance ?? current.acceptance ?? [])
      && JSON.stringify(current.non_goals ?? []) === JSON.stringify(update.non_goals ?? current.non_goals ?? [])) {
    return requirements;
  }

  const next = requirements.map(r => r === current ? { ...r, status: 'SUPERSEDED' } : r);
  next.push({
    ...update,
    provenance: update.provenance ?? 'AI_INFERRED',
    status: 'ACTIVE',
    version: current ? (current.version ?? 1) + 1 : (update.version ?? 1),
    depends_on: update.depends_on ?? current?.depends_on ?? [],
    acceptance: update.acceptance ?? current?.acceptance ?? [],
    non_goals: update.non_goals ?? current?.non_goals ?? [],
    supersedes: current ? `${current.id}@${current.version ?? 1}` : null
  });
  return next;
}

export function currentRequirements(requirements = []) {
  return requirements.filter(r => r.status === 'ACTIVE');
}

export function minimalPlanSlice(requirements = [], selectedIds = []) {
  const active = new Map(currentRequirements(requirements).map(r => [r.id, r]));
  const needed = new Set(selectedIds);
  const visit = id => {
    const r = active.get(id);
    if (!r) return;
    for (const dep of r.depends_on ?? []) {
      if (!needed.has(dep)) { needed.add(dep); visit(dep); }
    }
  };
  for (const id of [...needed]) visit(id);
  return [...needed].map(id => active.get(id)).filter(Boolean);
}

export function staleReasons(packet, current) {
  const reasons = [];
  if (packet.requirement_set_digest !== current.requirement_set_digest) reasons.push('REQUIREMENTS_CHANGED');
  if (packet.source_revision !== current.source_revision) reasons.push('SOURCE_REVISION_CHANGED');
  if (packet.policy_revision && current.policy_revision && packet.policy_revision !== current.policy_revision) reasons.push('POLICY_CHANGED');
  return reasons;
}

export function proofIsCurrent(proof, episode) {
  return proof?.requirement_set_digest === episode.requirement_set_digest
    && proof?.subject_revision === episode.source_revision;
}

export function detectWriteConflicts(assignments = []) {
  const conflicts = [];
  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const a = assignments[i], b = assignments[j];
      if (a.branch && b.branch && a.branch !== b.branch) continue;
      const overlap = (a.write_scope ?? []).filter(p => (b.write_scope ?? []).some(q => p === q || p.startsWith(q + '/') || q.startsWith(p + '/')));
      if (overlap.length) conflicts.push({ a: a.owner, b: b.owner, overlap });
    }
  }
  return conflicts;
}

const transitions = {
  DISCOVERING:['FRAMED','BLOCKED','ABORTED'], FRAMED:['READY','BLOCKED','STALE','ABORTED'],
  READY:['IMPLEMENTING','STALE','ABORTED'], IMPLEMENTING:['VERIFYING','BLOCKED','STALE','ABORTED'],
  VERIFYING:['PREVIEW_READY','IMPLEMENTING','BLOCKED','STALE','ABORTED'], PREVIEW_READY:['USER_REVIEW','IMPLEMENTING','STALE','ABORTED'],
  USER_REVIEW:['RELEASE_READY','IMPLEMENTING','STALE','ABORTED'], RELEASE_READY:['RELEASED','IMPLEMENTING','STALE','ABORTED'],
  RELEASED:['OBSERVING','ABORTED'], OBSERVING:['CLOSED','IMPLEMENTING','BLOCKED'],
  BLOCKED:['DISCOVERING','FRAMED','READY','IMPLEMENTING','VERIFYING','ABORTED'], STALE:['FRAMED','READY','ABORTED'], CLOSED:[], ABORTED:[]
};

export function transitionEpisode(state, next) {
  if (!(transitions[state] ?? []).includes(next)) throw new Error(`invalid transition: ${state} -> ${next}`);
  return next;
}
