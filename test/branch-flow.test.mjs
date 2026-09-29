// 가지가 «main 한 방향»으로만 흐르게 한다.
//
// ★대표 2026-09-29: 「브랜치 이런 거 메인에 다 병합되게 «한 방향»으로 잘 가게 해줘야 돼」
//
//   정책(registry/development-continuity-policy.json)은 2026-09-26 부터 이미 다 적어 두었다 —
//   hard_max 3, 수명 72시간, actor 접두사 금지, stale 목표 0.
//   **강제하는 것이 없어서** 원격 가지가 126개가 됐다. 이 검사가 그 자리다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { 흐르나, 활성한도, 전수판정 } from '../src/governance/branch-flow.mjs';
import { 정책읽기, 원격가지, 열린PR들 } from '../scripts/check-branch-flow.mjs';

const 정책 = 정책읽기();
const 지금 = new Date('2026-09-29T12:00:00+09:00');
const 가지 = (ref, 일전, 덮을것 = {}) => ({
  ref, 마지막커밋: new Date(지금.getTime() - 일전 * 86400000).toISOString(), 열린PR: null, ...덮을것
});

test('열린 PR 이 있으면 흐르는 중이다 — 오래됐어도', () => {
  assert.equal(흐르나(가지('work/ai-core/X-001', 30, { 열린PR: 331 }), 정책, 지금).흐름, '흐름');
});

test('어리면 아직 괜찮다 — 72시간까지', () => {
  assert.equal(흐르나(가지('work/ai-core/X-001', 2), 정책, 지금).흐름, '흐름');
  assert.equal(흐르나(가지('work/ai-core/X-001', 4), 정책, 지금).흐름, '위반');
});

test('★멈춘 가지는 위반이다 — «지금 무엇을 해야 하는지»까지 말한다', () => {
  const 판 = 흐르나(가지('docs/무언가', 9), 정책, 지금);
  assert.equal(판.흐름, '위반');
  assert.match(판.까닭, /STALLED/);
  assert.ok(판.고치는법, '고치는 법이 없는 FAIL 은 고칠 수 없다');
});

test('★actor 이름은 PR 이 있어도 위반이다 — 정책의 actor_prefixed_unique_target 이 0 이다', () => {
  /** 가지는 «일»의 것이지 AI 의 것이 아니다. 흐르고 있어도 이름은 고쳐야 한다. */
  for (const p of ['gpt/', 'claude/', 'codex/', 'work/gpt/']) {
    assert.equal(흐르나(가지(`${p}무언가`, 0, { 열린PR: 1 }), 정책, 지금).흐름, '위반', p);
  }
});

test('아카이브는 면제다 — 지우면 닫아 둔 가지들의 보존이 깨진다', () => {
  assert.equal(흐르나(가지('work/ai-core/archive-gpt-lanes-20260929', 30), 정책, 지금).흐름, '면제');
  assert.equal(흐르나(가지('main', 30), 정책, 지금).흐름, '면제');
});

test('★통이 셋뿐이고 공백이 없다 — 모든 가지가 면제·흐름·위반 중 하나', () => {
  const 것들 = [가지('main', 1), 가지('gpt/x', 1), 가지('work/ai-core/y', 1), 가지('docs/z', 9)];
  const 판 = 전수판정(것들, 정책, 지금);
  assert.equal(판.면제.length + 판.흐름.length + 판.위반.length, 것들.length);
});

test('활성 작업선 한도는 프로필에서 온다 — 지어내지 않는다', () => {
  const 것들 = Array.from({ length: 5 }, (_, i) => 가지(`work/ai-core/W-00${i}`, 0));
  const h = 활성한도(것들, 정책, 지금);
  assert.equal(h.프로필, 'ai-core' in 정책.project_profiles ? 정책.project_profiles['ai-core'] : null);
  assert.equal(h.한도, 정책.profiles[h.프로필].hard_max_active_work_branches);
  assert.equal(h.넘음, 5 - h.한도);
});

test('★실제 저장소가 기준선을 넘지 않는다 — 이 수는 내려가기만 한다', () => {
  /** 2026-09-29 정리 직후 실측 16. 올리는 것은 「한 방향」을 깨는 것이다.
   *  새 가지를 actor 이름으로 만들거나 멈춘 채 두면 이 검사가 먼저 빨개진다. */
  const pr = 열린PR들();
  const 가지들 = 원격가지().map((b) => ({ ...b, 열린PR: pr?.get(b.ref) ?? null }));
  const { 위반 } = 전수판정(가지들, 정책, new Date());
  assert.ok(
    위반.length <= 정책.flow_enforcement.max_violations_allowed,
    `흐르지 않는 가지가 ${위반.length}개 — 기준선 ${정책.flow_enforcement.max_violations_allowed} 을 넘었다:\n  ` +
      위반.slice(0, 10).map((b) => `${b.ref} — ${b.까닭}`).join('\n  ')
  );
});
