// 「둘이 상의한다」가 말로만 남지 않게 한다.
//
// ★대표 2026-09-27 직접 지시: 「AI 코어에 1순위로, 코덱스랑 상의하는 거 — 코덱스 입장에선 클로드랑 상의하는 거 — 바로 남겨놔」
//
// 실측으로 드러난 것: 연동(`npm run claude:review`)은 살아 있는데 2026-09-21 한도로 막힌 뒤
// 09-22 새벽에 풀렸고, 그 뒤 6일간 호출이 없었다. 호출 이력이 없어 「안 불렀다」와 「부르다 실패했다」도 구별 못 했다.
// 그래서 규칙을 두 진입점의 «맨 앞»에 두고, 기록부를 만들고, 그 둘이 서로 가리키는지를 여기서 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

const 진입점 = ['AGENTS.md', 'CLAUDE.md'];

test('★상의 규칙이 두 진입점의 «맨 앞»에 있다 — 뒤에 있으면 1순위가 아니다', () => {
  for (const 길 of 진입점) {
    const 글 = read(길);
    const 위치 = 글.indexOf('1순위 — 둘이 상의한다');
    assert.notEqual(위치, -1, `${길} 에 1순위 규칙이 없다`);

    /** 다른 어떤 절(##)보다 먼저 와야 한다. */
    const 첫절 = 글.indexOf('\n## ');
    assert.equal(위치 - 3, 첫절 + 1, `${길} 에서 상의 규칙이 첫 절이 아니다`);
  }
});

test('부르는 «방법»이 양방향 다 적혀 있다 — 방법 없는 규칙은 안 지켜진다', () => {
  for (const 길 of 진입점) {
    const 글 = read(길);
    assert.match(글, /npm run claude:status/, `${길}: Codex 가 열렸는지 보는 법이 없다`);
    assert.match(글, /npm run claude:review/, `${길}: Codex 가 Claude 를 부르는 법이 없다`);
    assert.match(글, /codex exec/, `${길}: Claude 가 Codex 를 부르는 법이 없다`);
    assert.match(글, /codex exec -s read-only/, `${길}: GPT\/Codex 검토가 read-only 로 잠기지 않았다`);
    assert.doesNotMatch(글, /codex exec -s workspace-write/, `${길}: 검토 호출에 쓰기 권한이 남아 있다`);
    assert.match(글, /npm run duo -- ask --to codex\|claude/, `${길}: 모든 세션 공용 호출법이 없다`);
  }
});

test('★막힘을 통과로 세지 않는다는 문장이 있다', () => {
  for (const 길 of 진입점) {
    assert.match(read(길), /막힘을 통과로 세지 않는다/, `${길}: 막힘 처리 규칙이 없다`);
  }
});

test('기록부가 있고, 규칙이 그 자리를 정확히 가리킨다', () => {
  const 기록 = read('docs/coordination/CROSS_AI_LOG.md');
  for (const 길 of 진입점) {
    assert.match(read(길), /docs\/coordination\/CROSS_AI_LOG\.md/, `${길}: 기록부 자리를 가리키지 않는다`);
  }
  for (const 말 of ['ANSWERED', 'BLOCKED', 'FAILED']) {
    assert.ok(기록.includes(말), `기록부에 ${말} 갈래가 없다`);
  }
  assert.match(기록, /기록이 없으면/, '기록 없음을 어떻게 볼지가 적혀 있어야 한다');
});

test('★6일 공백이 기록에 남아 있다 — 숨기면 같은 일이 또 난다', () => {
  const 기록 = read('docs/coordination/CROSS_AI_LOG.md');
  assert.match(기록, /09-21/, '막힌 날이 없다');
  assert.match(기록, /기록 없음/, '공백이 지워졌다');
  assert.match(기록, /09-26/, '코덱스 요청이 방치된 사실이 없다');
  assert.match(기록, /상시 대기하지 않는다/, '채널의 한계가 적혀 있어야 한다');
});
