import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAcademyStartReceipt, parseLsRemoteHead } from '../src/academy/start-gate.mjs';

const base = {
  task: '고객 조회 화면을 개선한다', track: 'development',
  project: { project_id: 'sales', default_branch: 'main', head_revision: 'a'.repeat(40), commands: { test: 'npm test', build: 'npm run build' } },
  repository: 'org/sales', branch: 'main', revision: 'a'.repeat(40), dirty: false,
  instructions: [{ path: 'AGENTS.md', body: 'rules' }],
  readings: [{ path: 'docs/AI_WORKING_STANDARD.md', body: 'constitution', purpose: 'constitution' }],
  observedAt: '2026-09-22T00:00:00Z',
};

test('academy start seals a revision-bound learning receipt before work', () => {
  const result = buildAcademyStartReceipt(base);
  assert.equal(result.status, 'READY');
  assert.equal(result.target.revision, 'a'.repeat(40));
  assert.equal(result.learned[0].sha256.length, 64);
  assert.equal(result.start_contract.create_only_after_reuse_decision, true);
});

test('academy start fails closed when default-branch checkout and registry revision disagree', () => {
  const result = buildAcademyStartReceipt({
    ...base,
    project: { ...base.project, head_revision: 'b'.repeat(40) },
  });
  assert.equal(result.status, 'HOLD');
  assert.deepEqual(result.blockers, ['DEFAULT_BRANCH_REVISION_MISMATCH']);
  assert.equal(result.target.revision, 'a'.repeat(40));
  assert.equal(result.target.registry_revision, 'b'.repeat(40));
  assert.equal(result.start_contract, null);
});

test('academy start keeps feature-branch work usable while preserving the registry revision', () => {
  const result = buildAcademyStartReceipt({
    ...base,
    branch: 'feature/customer-search',
    project: { ...base.project, head_revision: 'b'.repeat(40) },
  });
  assert.equal(result.status, 'READY');
  assert.equal(result.target.registry_revision, 'b'.repeat(40));
});

test('academy start holds dirty, unknown, or unjustified creation work', () => {
  const result = buildAcademyStartReceipt({ ...base, dirty: true, project: null, reuse: { verdict: { status: 'HOLD' }, candidates: [] } });
  assert.deepEqual(result.blockers, ['PROJECT_NOT_REGISTERED', 'DIRTY_WORKTREE_REVIEW_REQUIRED', 'REUSE_DECISION_REQUIRED']);
  assert.equal(result.start_contract, null);
});

// ★2026-10-03 — 등록부 head_revision 은 스냅샷이다. main 이 움직이면 등록부가 따라올 때까지
//   main 에서 시작하는 모든 세션이 HOLD 였다(ai-core main · ai-ops master 실측). 늘 HOLD 면 HOLD 를 무시하게 된다.
//   원격 기본 가지와 같고 pin 이 그 조상이면 «경고»로 낮추고, 나머지는 닫힌 채로 둔다(Codex 상의 MODIFY 반영).
const 기본가지 = (remoteHead, 덮을것 = {}) => buildAcademyStartReceipt({
  ...base,
  project: { ...base.project, repository: 'org/sales', head_revision: 'b'.repeat(40) },
  remoteHead: { ref: 'refs/heads/main', observed_at: '2026-10-03T00:00:00Z', ...remoteHead },
  ...덮을것,
});

test('★등록부만 낡았으면 READY + REGISTRY_HEAD_STALE 경고 — HEAD 가 원격과 같고 pin 이 조상', () => {
  const r = 기본가지({ revision: 'a'.repeat(40), pin_is_ancestor: true });
  assert.equal(r.status, 'READY');
  assert.deepEqual(r.blockers, []);
  assert.deepEqual(r.warnings, ['REGISTRY_HEAD_STALE']);
  assert.equal(r.remote_head.revision, 'a'.repeat(40));
  assert.equal(r.target.registry_revision, 'b'.repeat(40));
  assert.equal('remote_revision' in r.target, false, 'target 은 키트에 실린다 — 관측값을 넣으면 키트가 매번 바뀐다');
});

test('로컬이 원격보다 뒤(또는 앞)면 HOLD LOCAL_BRANCH_NOT_CURRENT', () => {
  const r = 기본가지({ revision: 'c'.repeat(40), pin_is_ancestor: true });
  assert.deepEqual(r.blockers, ['LOCAL_BRANCH_NOT_CURRENT']);
});

test('pin 이 HEAD 의 조상이 아니면(갈라짐·되감김) 지금처럼 HOLD', () => {
  assert.deepEqual(기본가지({ revision: 'a'.repeat(40), pin_is_ancestor: false }).blockers, ['DEFAULT_BRANCH_REVISION_MISMATCH']);
});

test('조상 여부를 확인할 수 없으면(얕은 클론·객체 없음) REGISTRY_PIN_NOT_VERIFIABLE 로 HOLD', () => {
  assert.deepEqual(기본가지({ revision: 'a'.repeat(40), pin_is_ancestor: null }).blockers, ['REGISTRY_PIN_NOT_VERIFIABLE']);
});

test('원격을 못 읽었거나 origin 이 등록된 저장소가 아니면 지금처럼 HOLD', () => {
  assert.deepEqual(기본가지({ revision: null, pin_is_ancestor: true }).blockers, ['DEFAULT_BRANCH_REVISION_MISMATCH']);
  assert.deepEqual(기본가지({ revision: 'a'.repeat(40), pin_is_ancestor: true }, { repository: 'someone/fork' }).blockers, ['DEFAULT_BRANCH_REVISION_MISMATCH']);
  assert.deepEqual(buildAcademyStartReceipt({ ...base, project: { ...base.project, repository: 'org/sales', head_revision: 'b'.repeat(40) } }).blockers, ['DEFAULT_BRANCH_REVISION_MISMATCH'], '원격 관측이 없으면 닫힌다');
});

test('경고로 낮춰도 dirty·재사용 판정은 그대로 막는다', () => {
  const r = 기본가지({ revision: 'a'.repeat(40), pin_is_ancestor: true }, { dirty: true });
  assert.deepEqual(r.blockers, ['DIRTY_WORKTREE_REVIEW_REQUIRED']);
  assert.deepEqual(r.warnings, ['REGISTRY_HEAD_STALE']);
});

test('ls-remote 출력에서 sha 만 꺼낸다 — 탭 뒤 ref 가 붙어 나오고, 꼴이 아니면 null', () => {
  assert.equal(parseLsRemoteHead(`${'a'.repeat(40)}\trefs/heads/main\n`), 'a'.repeat(40));
  assert.equal(parseLsRemoteHead(''), null);
  assert.equal(parseLsRemoteHead('fatal: could not read'), null);
});
