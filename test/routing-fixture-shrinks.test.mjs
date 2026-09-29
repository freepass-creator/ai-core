// 고정 fixture 가 «임시»로 남아 있게 강제한다.
//
// ★2026-09-27 · Codex 와 상의해 넣음.
//   실패 35건을 고치며 test/fixtures/routing-registry.mjs 로 실행 준비 상태를 고정했다.
//   그 고정은 «자동 갱신이 프로젝트를 HOLD 로 내렸는데 검사는 ACTIVE 를 전제로 쓰였다»는
//   과도기 때문이다. 재검증을 거쳐 실제 등록부가 ACTIVE 로 돌아오면 고정은 «거짓말»이 된다 —
//   실제로는 ACTIVE 인데 fixture 가 ACTIVE 로 덮고 있으니 아무것도 증명하지 않는 자리가 된다.
//
//   Codex 제안 그대로: **fixture ACTIVE ∩ 실제 ACTIVE = ∅** 을 불변식으로 둔다.
//   실제가 ACTIVE 로 돌아오면 이 검사가 빨개지고, 고치는 법은 «fixture 목록에서 그 이름을 지우는 것»이다.
//   그래서 고정은 스스로 줄어든다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 고정ACTIVE, 고정등록부 } from './fixtures/routing-registry.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 실제 = JSON.parse(readFileSync(resolve(root, 'registry/projects.json'), 'utf8'));

test('★고정한 프로젝트가 실제로 ACTIVE 가 되면 고정을 지워야 한다', () => {
  const 실제ACTIVE = new Set(
    실제.projects.filter((p) => p.execution_readiness_status === 'ACTIVE').map((p) => p.project_id)
  );
  const 겹침 = 고정ACTIVE.filter((id) => 실제ACTIVE.has(id));
  assert.deepEqual(
    겹침,
    [],
    `실제 등록부가 이미 ACTIVE 다 — test/fixtures/routing-registry.mjs 의 고정ACTIVE 에서 지워라: ${겹침.join(', ')}`
  );
});

test('고정 목록의 이름은 실제 등록부에 있는 프로젝트여야 한다 — 오타로 조용히 무력해지지 않게', () => {
  const 있는것 = new Set(실제.projects.map((p) => p.project_id));
  for (const id of 고정ACTIVE) {
    assert.ok(있는것.has(id), `등록부에 없는 프로젝트를 고정하고 있다: ${id}`);
  }
});

test('고정은 «실행 준비 상태»만 바꾼다 — 다른 값을 흔들면 검사가 정본을 안 보는 셈이다', () => {
  const 사본 = 고정등록부().projectRegistry;
  assert.equal(사본.projects.length, 실제.projects.length);
  for (const 원본 of 실제.projects) {
    const 바뀐 = 사본.projects.find((p) => p.project_id === 원본.project_id);
    for (const [키, 값] of Object.entries(원본)) {
      if (키 === 'execution_readiness_status') continue;
      assert.deepEqual(바뀐[키], 값, `${원본.project_id}.${키} 가 고정 과정에서 바뀌었다`);
    }
  }
});

test('고정된 것은 ACTIVE 로, 나머지는 실제 값 그대로', () => {
  const 사본 = 고정등록부().projectRegistry;
  const 고정 = new Set(고정ACTIVE);
  for (const 원본 of 실제.projects) {
    const 바뀐 = 사본.projects.find((p) => p.project_id === 원본.project_id);
    assert.equal(
      바뀐.execution_readiness_status,
      고정.has(원본.project_id) ? 'ACTIVE' : 원본.execution_readiness_status,
      원본.project_id
    );
  }
});
