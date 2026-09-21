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
  assert.match(body, /## 0\. 모든 업무는 AI Core를 거친다/);
  for (const checkpoint of ['목적:', '정본:', '규격:', '노하우:', '검증:']) {
    assert.ok(body.includes(checkpoint), `missing AI Core precheck: ${checkpoint}`);
  }
  for (const heading of ['## 1. 시작 규격', '## 2. 작업 규격', '## 3. 결과 규격', '## 4. 인계 규격', '## 5. 노하우 축적 규격', '## 6. 완료 판단']) {
    assert.ok(body.includes(heading), `missing required section: ${heading}`);
  }
  for (const field of ['목적:', '대상:', '변경:', '검증:', '남음:', 'next_start_here:']) {
    assert.ok(body.includes(field), `missing result field: ${field}`);
  }
  assert.match(body, /일반 업무를 위해 order ID, work ID, claim 또는 중앙 서버 연결을 만들지 않는다/);
  assert.match(body, /기본 협업은 \*\*Codex \+ Claude Code\*\*만 사용한다/);
  assert.match(body, /Cursor Agent와 Gemini CLI는 기본 협업 풀에서 제외한다/);
  assert.match(body, /npm run reuse:check/);
  assert.match(body, /CREATE_NEW_JUSTIFIED/);
});

test('academy curriculum separates document classes and covers real work tracks', async () => {
  const body = await read('docs/AI_ACADEMY_CURRICULUM.md');
  for (const heading of ['## 2. 문서 계급', '## 3. 공통 기초과정', '## 4. 개발 과정', '## 5. 디자인·UI/UX 과정', '## 6. 데이터·API·업무 흐름 과정', '## 7. 일반 회사 업무 과정', '## 8. AI 협업과 인계 과정', '## 9. 노하우 축적 과정', '## 10. 업무별 최소 독서 경로', '## 11. 사관학교의 성과 기준']) {
    assert.ok(body.includes(heading), `missing curriculum section: ${heading}`);
  }
  assert.match(body, /연구 후보[\s\S]*자동 적용 금지/);
  assert.match(body, /문서 수, AI 호출 수, 테스트 개수만 늘어나는 것은 성과가 아니다/);
});
