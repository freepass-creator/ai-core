import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('common AI entrypoints point to the current working standard', async () => {
  for (const path of ['WORK_READ_FIRST.md', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'README.md']) {
    const body = await read(path);
    assert.match(body, /AI_WORKING_STANDARD\.md/, `${path} must point to the current working standard`);
  }
});

test('working standard preserves the start, result, handoff, learning and completion contract', async () => {
  const body = await read('docs/AI_WORKING_STANDARD.md');
  assert.match(body, /^# AI 사관학교 헌법/m);
  assert.match(body, /USER-DIRECTED \/ CONSTITUTION/);
  for (const heading of ['## 1. 시작 규격', '## 2. 작업 규격', '## 3. 결과 규격', '## 4. 인계 규격', '## 5. 노하우 축적 규격', '## 6. 완료 판단']) {
    assert.ok(body.includes(heading), `missing required section: ${heading}`);
  }
  for (const field of ['목적:', '대상:', '변경:', '검증:', '남음:', 'next_start_here:']) {
    assert.ok(body.includes(field), `missing result field: ${field}`);
  }
  assert.match(body, /일반 업무를 위해 order ID, work ID, claim 또는 중앙 서버 연결을 만들지 않는다/);
});
