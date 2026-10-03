// 교훈이 «저장소에» 쌓이고, 제품 키트를 통해 다른 AI 에게 닿는지 지킨다.
//
// ★2026-10-03: 실전 교훈이 Claude 개인 메모리에만 있어 Codex·Gemini 는 볼 수 없었다.
//   operating-knowledge.json 은 9-26 이후 갱신이 없었고, 키트는 이 파일을 제품에 복사하면서도 «읽어라»를 말하지 않았다.
//   validate-operating-knowledge.mjs 는 CI 워크플로에 없어서 — 이 테스트(npm test → CI)가 그것을 돌린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 검사기 = resolve(root, 'scripts/validate-operating-knowledge.mjs');
const 정본 = JSON.parse(readFileSync(resolve(root, 'registry/operating-knowledge.json'), 'utf8'));

const 돌린다 = (파일) => {
  try {
    return { code: 0, out: JSON.parse(execFileSync(process.execPath, [검사기, 파일], { encoding: 'utf8' })) };
  } catch (오류) {
    return { code: 오류.status, out: JSON.parse(오류.stdout) };
  }
};

/** 가짜 저장소 하나: registry/ 아래 지식 파일, 그리고 ref 가 실재하는지 볼 파일들 */
const 판짜기 = (고친다) => {
  const 집 = mkdtempSync(join(tmpdir(), 'ai-core-knowledge-'));
  mkdirSync(join(집, 'registry'));
  mkdirSync(join(집, 'scripts'));
  writeFileSync(join(집, 'scripts', 'check-branch-flow.mjs'), '');
  const 사본 = structuredClone(정본);
  for (const x of [...사본.methods, ...사본.platforms]) {
    for (const r of x.canonical_refs ?? []) {
      if (!/^[\w.-]+\//.test(r)) continue;
      mkdirSync(dirname(join(집, r)), { recursive: true });
      writeFileSync(join(집, r), '');
    }
  }
  고친다?.(사본, 집);
  const 파일 = join(집, 'registry', 'operating-knowledge.json');
  writeFileSync(파일, JSON.stringify(사본, null, 2));
  return { 집, 파일 };
};

test('정본은 VALID 이고 교훈이 들어 있다', () => {
  const r = 돌린다(resolve(root, 'registry/operating-knowledge.json'));
  assert.equal(r.out.status, 'VALID', JSON.stringify(r.out.errors));
  assert.ok(정본.lessons.length >= 8);
  for (const id of ['lesson.rules-need-checkers', 'lesson.always-on-alarm-teaches-ignoring', 'lesson.kit-blocking-inputs-stale-everything']) {
    assert.ok(정본.lessons.some((l) => l.id === id), `${id} 가 없다`);
  }
});

test('★없는 파일을 가리키는 canonical_ref 는 INVALID — 사라진 것은 retired_refs 에 까닭과 함께', () => {
  const { 집, 파일 } = 판짜기((k) => { k.platforms[0].canonical_refs.push('docs/NOPE.md'); });
  try {
    assert.ok(돌린다(파일).out.errors.some((e) => e.startsWith('CANONICAL_REF_MISSING') && e.endsWith('docs/NOPE.md')));
  } finally { rmSync(집, { recursive: true, force: true }); }
  const 둘 = 판짜기((k) => { k.platforms[0].retired_refs = [{ path: 'docs/NOPE.md' }]; });
  try {
    assert.ok(돌린다(둘.파일).out.errors.some((e) => e.startsWith('RETIRED_REF_INCOMPLETE')));
  } finally { rmSync(둘.집, { recursive: true, force: true }); }
});

test('교훈은 날짜 있는 실측 근거·적용법·check 칸이 있어야 한다', () => {
  const { 집, 파일 } = 판짜기((k) => {
    k.lessons.push({ id: 'lesson.no-evidence', lesson: 'x', how_to_apply: 'y', evidence: [], check: null });
    k.lessons.push({ id: 'lesson.no-check-field', lesson: 'x', how_to_apply: 'y', evidence: [{ date: '2026-10-03', observed: 'z' }] });
    k.lessons.push({ id: 'Bad Id', lesson: 'x', how_to_apply: 'y', evidence: [{ date: '2026-10-03', observed: 'z' }], check: null });
  });
  try {
    const e = 돌린다(파일).out.errors;
    assert.ok(e.includes('LESSON_EVIDENCE_REQUIRED:lesson.no-evidence'));
    assert.ok(e.includes('LESSON_CHECK_FIELD_REQUIRED:lesson.no-check-field'));
    assert.ok(e.includes('LESSON_ID_INVALID:Bad Id'));
  } finally { rmSync(집, { recursive: true, force: true }); }
});

test('★교훈은 헌법 §5 의 채택 상태와 적용 범위·적용 안 되는 조건을 가진다 — 한 프로젝트의 성공을 전사 규칙처럼 퍼뜨리지 않는다', () => {
  const { 집, 파일 } = 판짜기((k) => {
    k.lessons[0].status = 'TRUE';
    delete k.lessons[1].not_applicable_when;
  });
  try {
    const e = 돌린다(파일).out.errors;
    assert.ok(e.includes(`LESSON_STATUS_INVALID:${정본.lessons[0].id}`));
    assert.ok(e.includes(`LESSON_SCOPE_REQUIRED:${정본.lessons[1].id}`));
  } finally { rmSync(집, { recursive: true, force: true }); }
  /** 지금 교훈은 모두 한 저장소(ai-core·카톡)에서 나왔다 — 다른 사례로 재현되기 전엔 UNIVERSAL 이 아니다 */
  assert.equal(정본.lessons.some((l) => l.status === 'ADOPTED_UNIVERSAL'), false);
});

test('check 는 읽기 전용·ai-core 루트·exit 0 계약이고 실재하는 검사기여야 한다 (Codex 상의)', () => {
  const { 집, 파일 } = 판짜기((k) => {
    k.lessons[0].check = { command: 'node scripts/check-branch-flow.mjs', cwd: 'ai-core-root', read_only: false, pass_exit_code: 0 };
    k.lessons[1].check = { command: 'node scripts/없는검사.mjs', cwd: 'ai-core-root', read_only: true, pass_exit_code: 0 };
  });
  try {
    const e = 돌린다(파일).out.errors;
    assert.ok(e.includes(`LESSON_CHECK_INVALID:${정본.lessons[0].id}`));
    assert.ok(e.includes(`LESSON_CHECK_NOT_FOUND:${정본.lessons[1].id}`));
  } finally { rmSync(집, { recursive: true, force: true }); }
});

test('교훈에 민감정보가 들어가면 INVALID — 키트로 모든 제품에 복사된다', () => {
  const { 집, 파일 } = 판짜기((k) => { k.lessons[0].evidence.push({ date: '2026-10-03', observed: '900101-1234567 고객' }); });
  try {
    assert.ok(돌린다(파일).out.errors.includes(`LESSON_SENSITIVE:${정본.lessons[0].id}`));
  } finally { rmSync(집, { recursive: true, force: true }); }
});

test('★키트가 교훈을 «읽으라고» 말한다 — START 단계와 bootstrap 경고 둘 다', () => {
  const src = readFileSync(resolve(root, 'src/academy/starter-kit.mjs'), 'utf8');
  assert.match(src, /OPERATING_KNOWLEDGE\.json\\`의 \\`confirmed_decisions\\`.*\\`lessons\\`/, 'START 단계에 교훈 읽기가 없다');
  assert.match(src, /READ_LESSONS: /, 'advisory 경고에 교훈 안내가 없다');
});
