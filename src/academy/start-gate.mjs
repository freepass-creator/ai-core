import { createHash } from 'node:crypto';

const TRACK_DOCS = {
  development: ['docs/AI_ACADEMY_CURRICULUM.md', 'docs/DEVELOPMENT_CONTINUITY_STANDARD.md', 'docs/DEVELOPMENT_RUNTIME.md', 'docs/shared-services/SHARED_RELEASE_GATE.md'],
  design: ['docs/AI_ACADEMY_CURRICULUM.md', 'docs/UI_UX_CONSTITUTION.md', 'docs/SCREEN_DESIGN_STANDARD.md', 'docs/RESPONSIVE_STANDARD.md', 'docs/ACCESSIBILITY_STANDARD.md'],
  data: ['docs/AI_ACADEMY_CURRICULUM.md', 'docs/CORE_CONTRACT_STANDARD.md', 'docs/workflow/WORKFLOW_CONSTITUTION.md'],
  operations: ['docs/AI_ACADEMY_CURRICULUM.md', 'docs/AI_CORE_OPERATING_PLAYBOOK.md', 'docs/EMERGENCY_RUNBOOK.md'],
  document: ['docs/AI_ACADEMY_CURRICULUM.md'],
};

const hash = value => createHash('sha256').update(value).digest('hex');
const isPinnedRevision = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);

/** 기본 가지에서 등록부 pin 과 HEAD 가 다를 때의 판정.
 *
 *  ★2026-10-03: 등록부 head_revision 은 «최신성 pin»이 아니라 «등록부 스냅샷»이다. 프로젝트 main 은 계속 움직이고
 *  등록부는 registry-refresh PR 이 병합돼야 따라오므로, 예전 판정(다르면 HOLD)은 main 에서 시작하는 모든 세션을
 *  구조적으로 HOLD 시켰다(ai-core main · ai-ops master 실측). 늘 HOLD 면 AI 는 HOLD 를 무시하도록 배운다.
 *  그래서 «원격 기본 가지와 같고, pin 이 그 조상»이면 비차단 경고로 낮춘다. 나머지는 전부 닫힌 채로 둔다.
 *  (Codex 상의 2026-10-03 MODIFY: 저장소 불일치·조상 확인 불가·원격 미관측은 HOLD, 원격 관측값을 영수증에 남긴다)
 *
 *  remoteHead = { ref, revision|null, observed_at, pin_is_ancestor: true|false|null(확인 불가) } */
export function judgeDefaultBranchHead({ project, repository, revision, remoteHead }) {
  const pin = project.head_revision;
  if (revision === pin) return { blockers: [], warnings: [] };
  const 같은저장소 = typeof project.repository === 'string' && project.repository.toLowerCase() === String(repository ?? '').toLowerCase();
  if (!같은저장소 || !isPinnedRevision(remoteHead?.revision)) return { blockers: ['DEFAULT_BRANCH_REVISION_MISMATCH'], warnings: [] };
  if (remoteHead.pin_is_ancestor === null || remoteHead.pin_is_ancestor === undefined) return { blockers: ['REGISTRY_PIN_NOT_VERIFIABLE'], warnings: [] };
  if (remoteHead.pin_is_ancestor === false) return { blockers: ['DEFAULT_BRANCH_REVISION_MISMATCH'], warnings: [] };
  if (revision !== remoteHead.revision) return { blockers: ['LOCAL_BRANCH_NOT_CURRENT'], warnings: [] };
  return { blockers: [], warnings: ['REGISTRY_HEAD_STALE'] };
}

export function buildAcademyStartReceipt({ task, track, project, repository, branch, revision, dirty, instructions, readings, reuse = null, remoteHead = null, observedAt }) {
  const blockers = [];
  const warnings = [];
  if (!task?.trim()) blockers.push('TASK_REQUIRED');
  if (!TRACK_DOCS[track]) blockers.push('TRACK_UNSUPPORTED');
  if (!project) blockers.push('PROJECT_NOT_REGISTERED');
  if (!isPinnedRevision(revision)) blockers.push('REVISION_NOT_PINNED');
  if (project && branch === project.default_branch) {
    if (!isPinnedRevision(project.head_revision)) blockers.push('REGISTRY_REVISION_NOT_PINNED');
    else if (isPinnedRevision(revision)) {
      const 판 = judgeDefaultBranchHead({ project, repository, revision, remoteHead });
      blockers.push(...판.blockers);
      warnings.push(...판.warnings);
    }
  }
  if (dirty) blockers.push('DIRTY_WORKTREE_REVIEW_REQUIRED');
  if (!instructions.length) blockers.push('PROJECT_INSTRUCTIONS_MISSING');
  if (reuse && reuse.verdict?.status !== 'PASS') blockers.push('REUSE_DECISION_REQUIRED');
  return {
    schema: 'ai-core-academy-start/v1',
    status: blockers.length ? 'HOLD' : 'READY',
    task: task?.trim() ?? '', track,
    target: project ? { project_id: project.project_id, repository, branch, revision, registry_revision: project.head_revision } : null,
    /** target 밖에 둔다 — target 은 키트(kit.json)에 실리므로, 매번 바뀌는 관측 시각이 들어가면 키트가 매번 달라진다. */
    remote_head: remoteHead ? { ref: remoteHead.ref, revision: remoteHead.revision, observed_at: remoteHead.observed_at, registry_pin_is_ancestor: remoteHead.pin_is_ancestor } : null,
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
    warnings,
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

/** `git ls-remote origin <ref>` 출력에서 sha 만 꺼낸다(「<sha>\t<ref>」). 꼴이 아니면 null — 판정이 닫힌다. */
export function parseLsRemoteHead(text) {
  const sha = String(text ?? '').trim().split(/\s+/)[0];
  return isPinnedRevision(sha) ? sha : null;
}
