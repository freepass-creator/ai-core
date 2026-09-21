import { createHash } from 'node:crypto';

const TRACK_DOCS = {
  development: ['docs/AI_ACADEMY_CURRICULUM.md', 'docs/DEVELOPMENT_RUNTIME.md', 'docs/shared-services/SHARED_RELEASE_GATE.md'],
  design: ['docs/AI_ACADEMY_CURRICULUM.md', 'docs/UI_UX_CONSTITUTION.md', 'docs/SCREEN_DESIGN_STANDARD.md', 'docs/RESPONSIVE_STANDARD.md', 'docs/ACCESSIBILITY_STANDARD.md'],
  data: ['docs/AI_ACADEMY_CURRICULUM.md', 'docs/CORE_CONTRACT_STANDARD.md', 'docs/workflow/WORKFLOW_CONSTITUTION.md'],
  operations: ['docs/AI_ACADEMY_CURRICULUM.md', 'docs/AI_CORE_OPERATING_PLAYBOOK.md', 'docs/EMERGENCY_RUNBOOK.md'],
  document: ['docs/AI_ACADEMY_CURRICULUM.md'],
};

const hash = value => createHash('sha256').update(value).digest('hex');

export function buildAcademyStartReceipt({ task, track, project, repository, branch, revision, dirty, instructions, readings, reuse = null, observedAt }) {
  const blockers = [];
  if (!task?.trim()) blockers.push('TASK_REQUIRED');
  if (!TRACK_DOCS[track]) blockers.push('TRACK_UNSUPPORTED');
  if (!project) blockers.push('PROJECT_NOT_REGISTERED');
  if (!revision || !/^[0-9a-f]{40}$/.test(revision)) blockers.push('REVISION_NOT_PINNED');
  if (dirty) blockers.push('DIRTY_WORKTREE_REVIEW_REQUIRED');
  if (!instructions.length) blockers.push('PROJECT_INSTRUCTIONS_MISSING');
  if (reuse && reuse.verdict?.status !== 'PASS') blockers.push('REUSE_DECISION_REQUIRED');
  return {
    schema: 'ai-core-academy-start/v1',
    status: blockers.length ? 'HOLD' : 'READY',
    task: task?.trim() ?? '', track,
    target: project ? { project_id: project.project_id, repository, branch, revision, registry_revision: project.head_revision } : null,
    learned: readings.map(item => ({ path: item.path, sha256: hash(item.body), purpose: item.purpose })),
    project_instructions: instructions.map(item => ({ path: item.path, sha256: hash(item.body) })),
    precheck: {
      purpose: task?.trim() ?? null,
      canonical_source: project ? `${repository}@${revision}` : null,
      applicable_rules: readings.map(item => item.path),
      reusable_knowledge: reuse ? { verdict: reuse.verdict, candidates: reuse.candidates?.slice(0, 5) ?? [] } : { verdict: { status: 'NOT_REQUIRED', reason: 'NO_NEW_ASSET_DECLARED' }, candidates: [] },
      completion_verification: project?.commands ?? null,
    },
    blockers,
    start_contract: blockers.length ? null : {
      preserve_revision: revision,
      inspect_before_edit: true,
      create_only_after_reuse_decision: true,
      completion_record: ['목적', '대상 revision', '변경', '검증', '남음', 'next_start_here'],
    },
    observed_at: observedAt,
  };
}

export { TRACK_DOCS };
