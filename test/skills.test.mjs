// AI Core 기본 업무 스킬이 «꼴이 맞고, 공개해도 되고, 깔 때 남의 것을 건드리지 않는지» 지킨다.
//
// ★대표 2026-10-03: 「시작할 때마다 신생아처럼 그러냐」 — 기본 업무 능력을 Claude Code 사용자 스킬로 둔다.
//   GPT 상의(MODIFY): 미리보기가 기본 · 우리가 깐 것만 바꾸고 지운다 · 보내기/쓰기 스킬은 승인 문구를 강제 · 공개 저장소라 민감값 금지.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSkills, planSync, applySync, renderCodexBlock, NAME_RE, MARKER, BLOCK_START, BLOCK_END } from '../scripts/skills-sync.mjs';
import { scanText } from '../src/security/secret-scan.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skills = readSkills(join(root, 'skills'));

test('첫 묶음이 다 있다 — 메일·시트·드라이브·정본 숫자·화면·상의·막힘·카톡', () => {
  const ids = skills.map((s) => s.id);
  for (const id of ['mail-send', 'mail-read', 'google-sheets', 'drive-find', 'canon-numbers', 'pc-screen', 'gpt-consult', 'blocked-escalate', 'kakao-send']) assert.ok(ids.includes(id), id);
});

test('꼴: name = 폴더 이름 · 소문자 ASCII-하이픈 · description 은 «언제 쓰나»를 말한다', () => {
  for (const s of skills) {
    assert.equal(s.error, undefined, `${s.id}: ${s.error}`);
    assert.equal(s.name, s.id, `${s.id}: name 이 폴더 이름과 다르다`);
    assert.match(s.id, NAME_RE);
    assert.ok(s.id.length <= 64);
    assert.ok(s.description.length >= 30 && s.description.length <= 1024, `${s.id}: description 길이`);
    assert.match(s.description, /때/, `${s.id}: description 이 언제 쓰는지 말하지 않는다`);
  }
});

test('★공개 저장소다 — 비밀·주민번호·긴 ID(시트 ID 등)를 담지 않는다', () => {
  for (const s of skills) {
    const text = readFileSync(join(s.dir, 'SKILL.md'), 'utf8');
    assert.deepEqual(scanText(`skills/${s.id}/SKILL.md`, text), [], `${s.id}: 비밀 패턴`);
    assert.doesNotMatch(text, /[A-Za-z0-9_-]{40,}/, `${s.id}: 시트 ID 같은 긴 식별자`);
    assert.doesNotMatch(text, /APP_PASSWORD=|FIREBASE_ADMIN_KEY=/, `${s.id}: 열쇠 값`);
  }
});

test('★보내기·쓰기 스킬은 승인 규칙을 본문에 박는다', () => {
  const body = (id) => readFileSync(join(root, 'skills', id, 'SKILL.md'), 'utf8');
  assert.match(body('mail-send'), /승인한 뒤에만/);
  assert.match(body('mail-send'), /--dry-run/);
  assert.match(body('google-sheets'), /쓰기 전에 같은 범위를 읽어/);
  assert.match(body('google-sheets'), /다시 읽어/);
  assert.match(body('kakao-send'), /fail-closed/);
  assert.match(body('pc-screen'), /다른 세션·사람이 쓰는 창이면 손대지 않는다/);
  assert.match(body('canon-numbers'), /모른다/);
});

function 판() {
  const 집 = mkdtempSync(join(tmpdir(), 'ai-core-skills-'));
  const claudeDir = join(집, 'claude', 'skills');
  mkdirSync(join(claudeDir, 'synced', 'bucket'), { recursive: true });
  writeFileSync(join(claudeDir, 'synced', 'bucket', 'x'), 'account sync');
  return { 집, claudeDir, codexAgents: join(집, 'codex', 'AGENTS.md') };
}

test('★깔기: 미리보기는 아무것도 안 쓴다 · apply 는 우리 것만 · 계정 동기 폴더는 그대로', () => {
  const { 집, claudeDir, codexAgents } = 판();
  try {
    const plan = planSync({ skills, claudeDir, revision: 'r1' });
    assert.ok(plan.actions.every((a) => a.op === 'install'));
    assert.equal(existsSync(join(claudeDir, 'mail-send')), false, '미리보기가 썼다');
    applySync({ plan, skills, claudeDir, codexAgents });
    for (const s of skills) {
      assert.ok(existsSync(join(claudeDir, s.id, 'SKILL.md')));
      assert.ok(existsSync(join(claudeDir, s.id, MARKER)));
    }
    assert.equal(readFileSync(join(claudeDir, 'synced', 'bucket', 'x'), 'utf8'), 'account sync');
    /** 두 번째는 바뀐 것 없음 */
    assert.ok(planSync({ skills, claudeDir, revision: 'r1' }).actions.every((a) => a.op === 'same'));
  } finally { rmSync(집, { recursive: true, force: true }); }
});

test('★표식 없는 같은 이름 폴더는 충돌로 두고 안 건드린다 · 저장소에서 빠진 우리 스킬만 지운다', () => {
  const { 집, claudeDir, codexAgents } = 판();
  try {
    mkdirSync(join(claudeDir, 'mail-send'), { recursive: true });
    writeFileSync(join(claudeDir, 'mail-send', 'SKILL.md'), '사용자가 직접 만든 것');
    const plan = planSync({ skills, claudeDir, revision: 'r1' });
    assert.equal(plan.actions.find((a) => a.id === 'mail-send').op, 'conflict');
    applySync({ plan, skills, claudeDir, codexAgents });
    assert.equal(readFileSync(join(claudeDir, 'mail-send', 'SKILL.md'), 'utf8'), '사용자가 직접 만든 것');

    /** 예전에 우리가 깐 스킬이 저장소에서 빠졌다 → 지운다. 매니페스트에 없는 남의 폴더는 그대로 */
    mkdirSync(join(claudeDir, 'old-skill'), { recursive: true });
    writeFileSync(join(claudeDir, 'old-skill', MARKER), '{}');
    mkdirSync(join(claudeDir, 'someone-else'), { recursive: true });
    writeFileSync(join(claudeDir, 'someone-else', MARKER), '{}');
    const m = JSON.parse(readFileSync(join(claudeDir, '.ai-core-skills.json'), 'utf8'));
    m.installed.push('old-skill');
    writeFileSync(join(claudeDir, '.ai-core-skills.json'), JSON.stringify(m));
    const plan2 = planSync({ skills, claudeDir, revision: 'r2' });
    assert.ok(plan2.actions.some((a) => a.op === 'remove' && a.id === 'old-skill'));
    assert.ok(!plan2.actions.some((a) => a.id === 'someone-else'));
    applySync({ plan: plan2, skills, claudeDir, codexAgents });
    assert.equal(existsSync(join(claudeDir, 'old-skill')), false);
    assert.equal(existsSync(join(claudeDir, 'someone-else')), true);
  } finally { rmSync(집, { recursive: true, force: true }); }
});

test('Codex 지침은 표식 블록만 다시 쓴다 — 블록 밖 글은 그대로, 두 번 써도 하나', () => {
  const before = '# 내 지침\n\n손대면 안 되는 글\n';
  const once = renderCodexBlock(before, skills, '/x/skills');
  const twice = renderCodexBlock(once, skills, '/x/skills');
  assert.ok(once.startsWith(before.trimEnd()));
  assert.equal(once, twice);
  assert.equal(once.split(BLOCK_START).length, 2);
  assert.ok(once.includes(BLOCK_END));
  assert.match(once, /\*\*mail-send\*\*/);
});

test('★손상된 설치 매니페스트(../ 등)로는 스킬 폴더 밖을 지우지 않는다 (Codex 검토)', async () => {
  const { safeTarget } = await import('../scripts/skills-sync.mjs');
  const { 집, claudeDir, codexAgents } = 판();
  try {
    applySync({ plan: planSync({ skills, claudeDir, revision: 'r1' }), skills, claudeDir, codexAgents });
    /** 스킬 폴더 밖 «피해자» — 표식까지 달아 둔다 */
    const victim = join(집, 'claude', 'victim');
    mkdirSync(victim, { recursive: true });
    writeFileSync(join(victim, MARKER), '{}');
    const m = JSON.parse(readFileSync(join(claudeDir, '.ai-core-skills.json'), 'utf8'));
    m.installed.push('../victim', '..\\victim', 'C:/x', '', 'A_B');
    writeFileSync(join(claudeDir, '.ai-core-skills.json'), JSON.stringify(m));
    const plan = planSync({ skills, claudeDir, revision: 'r2' });
    assert.ok(!plan.actions.some((a) => a.op === 'remove'));
    assert.ok(plan.actions.some((a) => a.op === 'skip-unsafe' && a.id === '../victim'));
    applySync({ plan, skills, claudeDir, codexAgents });
    assert.equal(existsSync(victim), true, '스킬 폴더 밖이 지워졌다');
    for (const bad of ['../x', '..\\x', 'a/b', 'A', '', 'x'.repeat(65)]) assert.equal(safeTarget(claudeDir, bad), false, bad);
    assert.equal(safeTarget(claudeDir, 'mail-send'), true);
  } finally { rmSync(집, { recursive: true, force: true }); }
});
