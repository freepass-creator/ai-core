// 헌법의 규칙마다 «무엇이 그것을 막는가»를 적은 표(registry/rule-enforcement.json)가 거짓말하지 않게 한다.
//
// ★2026-10-03 교훈 lesson.rules-need-checkers — 글로만 있는 규칙은 지켜지지 않았다.
//   이 표는 막는 것이 없는 규칙을 NONE 으로 «드러내는» 것이 목적이다. 그래서 세 가지를 지킨다:
//   ① 표의 quote 가 헌법 원문에 그대로 있다(헌법이 바뀌면 표도 고쳐야 한다)
//   ② 헌법의 절마다 적어도 하나의 규칙이 표에 있다(전수 덮임 — lesson.classification-no-gaps)
//   ③ «CI 에서 막는다»고 적은 것은 실제로 CI 가 돈다
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 표 = JSON.parse(readFileSync(resolve(root, 'registry/rule-enforcement.json'), 'utf8'));
const 헌법 = readFileSync(resolve(root, 'docs/AI_WORKING_STANDARD.md'), 'utf8');
const 워크플로 = readdirSync(resolve(root, '.github/workflows')).map((f) => readFileSync(join(root, '.github/workflows', f), 'utf8')).join('\n');
const 스크립트 = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts;

test('quote 는 헌법 원문에 그대로 있다 — 헌법이 바뀌면 이 표도 같이 고친다', () => {
  for (const r of 표.rules) assert.ok(헌법.includes(r.quote), `${r.id}: 헌법에 없는 문장 — ${r.quote}`);
});

test('★헌법의 절마다 표에 규칙이 있다 — 빠진 절은 공백이다', () => {
  const 절들 = [...헌법.matchAll(/^## (\d+(?:\.\d+)?)\.? /gm)].map((m) => m[1]);
  if (헌법.includes('\n## 협업 AI 정책')) 절들.push('협업 AI 정책');
  const 덮인 = new Set(표.rules.map((r) => r.section));
  for (const 절 of 절들) assert.ok(덮인.has(절), `헌법 ${절} 절의 규칙이 표에 없다`);
  for (const 절 of 덮인) assert.ok(절들.includes(절), `표의 절 ${절} 이 헌법에 없다`);
});

test('★규칙 목록인 절(1.1·2)은 «항목마다» 표에 규칙이 있다 — 절 단위로만 세면 빠진 항목을 못 본다 (Codex 검토)', () => {
  for (const 절 of ['1.1', '2']) {
    const 본문 = 헌법.split(/\n## /).find((s) => s.startsWith(`${절} `) || s.startsWith(`${절}. `));
    assert.ok(본문, `헌법에 ${절} 절이 없다`);
    const 항목들 = 본문.split('\n').filter((l) => l.startsWith('- '));
    assert.ok(항목들.length, `${절} 절에 항목이 없다`);
    for (const 항목 of 항목들) {
      assert.ok(표.rules.some((r) => r.section === 절 && 항목.includes(r.quote)), `헌법 ${절} 항목이 표에 없다: ${항목.slice(0, 60)}`);
    }
  }
});

test('꼴: id 유일 · kind/where 는 정한 것만 · ref 는 실재 · NONE 이나 빈틈은 gap 으로 말한다', () => {
  const ids = 표.rules.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const r of 표.rules) {
    assert.match(r.id, /^rule\.[a-z0-9-]+$/);
    assert.ok(r.enforcement.length, r.id);
    for (const e of r.enforcement) {
      assert.ok(e.kind in 표.kinds, `${r.id}: kind ${e.kind}`);
      if (e.kind === 'NONE') continue;
      assert.ok(e.where in 표.where, `${r.id}: where ${e.where}`);
      assert.ok(existsSync(resolve(root, e.ref)), `${r.id}: ${e.ref} 가 없다`);
    }
    const 막는다 = r.enforcement.some((e) => e.kind === 'CHECKER' && e.where === 'CI' && !e.report_only);
    if (!막는다) assert.ok(r.gap, `${r.id}: CI 에서 막지 않는데 gap 이 비었다 — 빈틈을 숨기지 않는다`);
  }
});

test('★«CI» 라고 적은 것은 실제로 CI 가 돈다 — 검사기는 워크플로에, 테스트는 npm test 에', () => {
  for (const r of 표.rules) {
    for (const e of r.enforcement.filter((x) => x.where === 'CI')) {
      if (e.ref.startsWith('test/')) {
        assert.match(스크립트.test, /test\/\*\.test\.mjs/, 'npm test 가 test/*.test.mjs 를 안 돈다');
        assert.match(워크플로, /npm test/, 'CI 가 npm test 를 안 돈다');
        continue;
      }
      const 이름 = e.ref.split('/').pop();
      const npm이름들 = Object.entries(스크립트).filter(([, v]) => v.includes(이름)).map(([k]) => k);
      const 돈다 = 워크플로.includes(이름) || npm이름들.some((k) => 워크플로.includes(`npm run ${k}`));
      assert.ok(돈다, `${r.id}: ${e.ref} 를 CI 라고 했지만 워크플로에 없다`);
    }
  }
});

test('report_only 라고 적은 CI 검사기는 정말로 막지 않는다 — continuity:audit 에 --gate 가 없다', () => {
  const b = 표.rules.find((r) => r.id === 'rule.branch-budget');
  assert.ok(b.enforcement.some((e) => e.report_only));
  const 줄들 = 워크플로.split('\n').filter((l) => l.includes('continuity:audit'));
  assert.ok(줄들.length);
  assert.ok(줄들.every((l) => !l.includes('--gate')), 'CI 가 --gate 로 돌기 시작했다 — report_only 를 지우고 이 테스트를 고친다');
});
