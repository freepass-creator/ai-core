#!/usr/bin/env node
// AI Core 기본 업무 스킬(skills/<id>/SKILL.md)을 이 PC 의 Claude Code 사용자 스킬로 깐다.
//
// ★대표 2026-10-03: 「AI 코어에 노하우를 넣어서 세션들이 메일 보내기 같은 건 학습해서 할 수 있어야지, 시작할 때마다 신생아처럼 그러냐」
//   사용자 스킬은 세션마다 이름+설명이 자동으로 보이고, 필요할 때 본문을 읽는다 = 태어날 때부터 아는 것.
//
//   npm run skills:sync                  미리보기(기본) — 무엇을 깔고·바꾸고·지울지만 찍는다
//   npm run skills:sync -- --apply       실제로 쓴다(~/.claude/skills · ~/.codex/AGENTS.md 표식 블록)
//   [--claude-dir <경로>] [--codex-agents <경로>]   시험·다른 PC 용
//
// 안전(GPT 상의 MODIFY): 기본은 미리보기 · 우리가 깐 것(설치 매니페스트에 적힌 id + 폴더의 표식 파일)만 바꾸고 지운다 ·
//   계정 동기 폴더(synced/)·다른 스킬·표식 없는 같은 이름 폴더는 건드리지 않고 «충돌»로 알린다 ·
//   Codex 지침은 표식 블록 안만 다시 쓴다.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, copyFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MARKER = '.ai-core-skill';
export const MANIFEST = '.ai-core-skills.json';
export const BLOCK_START = '<!-- ai-core-skills:start (npm run skills:sync 가 쓴다 — 손으로 고치지 않는다) -->';
export const BLOCK_END = '<!-- ai-core-skills:end -->';
export const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** id 가 스킬 이름 꼴이고, claudeDir 바로 아래 폴더를 가리킬 때만 true. */
export function safeTarget(claudeDir, id) {
  if (typeof id !== 'string' || !NAME_RE.test(id) || id.length > 64) return false;
  const base = resolve(claudeDir);
  const target = resolve(base, id);
  return dirname(target) === base;
}

/** SKILL.md 의 frontmatter 를 읽는다. 꼴이 틀리면 이유를 돌려준다. */
export function parseSkill(text) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { error: 'FRONTMATTER_MISSING' };
  const field = (k) => m[1].match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? null;
  return { name: field('name'), description: field('description'), body: text.slice(m[0].length) };
}

/** 저장소의 스킬 목록(허용 목록). 폴더 이름 = name. */
export function readSkills(dir) {
  const out = [];
  for (const id of readdirSync(dir).sort()) {
    const p = join(dir, id, 'SKILL.md');
    if (!existsSync(p)) continue;
    const s = parseSkill(readFileSync(p, 'utf8'));
    out.push({ id, dir: join(dir, id), ...s });
  }
  return out;
}

/** 무엇을 할지 계획만 세운다(쓰지 않는다). */
export function planSync({ skills, claudeDir, revision }) {
  const prev = (() => { try { return JSON.parse(readFileSync(join(claudeDir, MANIFEST), 'utf8')).installed ?? []; } catch { return []; } })();
  const ids = new Set(skills.map((s) => s.id));
  const actions = [];
  for (const s of skills) {
    const target = join(claudeDir, s.id);
    if (!existsSync(target)) { actions.push({ op: 'install', id: s.id }); continue; }
    if (!existsSync(join(target, MARKER))) { actions.push({ op: 'conflict', id: s.id, why: '같은 이름의 스킬 폴더가 있는데 AI Core 가 깐 것이 아니다 — 건드리지 않는다' }); continue; }
    const same = readdirSync(s.dir).every((f) => existsSync(join(target, f)) && readFileSync(join(target, f), 'utf8') === readFileSync(join(s.dir, f), 'utf8'));
    actions.push({ op: same ? 'same' : 'update', id: s.id });
  }
  for (const id of prev) {
    if (ids.has(id)) continue;
    /** ★Codex 검토: 매니페스트가 손상돼 `../victim` 같은 값이 들어오면 스킬 폴더 밖을 지울 수 있다 → 이름 꼴·하위 경로가 아니면 손대지 않는다 */
    if (!safeTarget(claudeDir, id)) { actions.push({ op: 'skip-unsafe', id: String(id), why: '설치 매니페스트의 이름이 스킬 이름 꼴이 아니다 — 지우지 않는다' }); continue; }
    const target = join(claudeDir, id);
    if (existsSync(target) && existsSync(join(target, MARKER))) actions.push({ op: 'remove', id, why: '저장소에서 빠진 AI Core 스킬' });
  }
  return { revision, actions };
}

/** Codex 지침 파일의 표식 블록을 다시 쓴 전문을 돌려준다(블록 밖은 그대로). */
export function renderCodexBlock(existing, skills, claudeDir) {
  const lines = [BLOCK_START, '## AI Core 기본 업무 스킬 — 필요할 때 본문을 읽고 그대로 한다', ''];
  for (const s of skills) lines.push(`- **${s.id}** — ${s.description} → \`${join(claudeDir, s.id, 'SKILL.md').replaceAll('\\', '/')}\``);
  lines.push('', BLOCK_END);
  const block = lines.join('\n');
  const text = existing ?? '';
  const a = text.indexOf(BLOCK_START);
  const b = text.indexOf(BLOCK_END);
  if (a >= 0 && b > a) return text.slice(0, a) + block + text.slice(b + BLOCK_END.length);
  return `${text.replace(/\s*$/, '')}${text.trim() ? '\n\n' : ''}${block}\n`;
}

export function applySync({ plan, skills, claudeDir, codexAgents }) {
  mkdirSync(claudeDir, { recursive: true });
  const byId = new Map(skills.map((s) => [s.id, s]));
  for (const a of plan.actions) {
    if (!['install', 'update', 'remove'].includes(a.op)) continue;
    if (!safeTarget(claudeDir, a.id)) throw new Error(`안전하지 않은 스킬 이름: ${a.id}`);
    const target = join(claudeDir, a.id);
    if (a.op === 'install' || a.op === 'update') {
      mkdirSync(target, { recursive: true });
      for (const f of readdirSync(byId.get(a.id).dir)) {
        if (statSync(join(byId.get(a.id).dir, f)).isFile()) copyFileSync(join(byId.get(a.id).dir, f), join(target, f));
      }
      writeFileSync(join(target, MARKER), `${JSON.stringify({ source: 'freepass-creator/ai-core', path: `skills/${a.id}`, revision: plan.revision }, null, 2)}\n`);
    } else if (a.op === 'remove') {
      rmSync(target, { recursive: true, force: true });
    }
  }
  const installed = skills.filter((s) => !plan.actions.some((a) => a.id === s.id && a.op === 'conflict')).map((s) => s.id);
  writeFileSync(join(claudeDir, MANIFEST), `${JSON.stringify({ source: 'freepass-creator/ai-core', revision: plan.revision, installed }, null, 2)}\n`);
  if (codexAgents) {
    const before = existsSync(codexAgents) ? readFileSync(codexAgents, 'utf8') : null;
    mkdirSync(dirname(codexAgents), { recursive: true });
    writeFileSync(codexAgents, renderCodexBlock(before, skills.filter((s) => installed.includes(s.id)), claudeDir));
  }
  return installed;
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
  const claudeDir = resolve(opt('claude-dir') ?? join(homedir(), '.claude', 'skills'));
  const codexAgents = opt('codex-agents') === 'none' ? null : resolve(opt('codex-agents') ?? join(homedir(), '.codex', 'AGENTS.md'));
  const skills = readSkills(join(coreRoot, 'skills'));
  const bad = skills.filter((s) => s.error || s.name !== s.id || !NAME_RE.test(s.id) || !s.description);
  if (bad.length) { console.error(`FAIL: 스킬 꼴이 틀렸다 — ${bad.map((s) => s.id).join(', ')}`); process.exit(1); }
  let revision = null;
  try { revision = execFileSync('git', ['-C', coreRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
  const plan = planSync({ skills, claudeDir, revision });
  for (const a of plan.actions) console.log(`${a.op.padEnd(8)} ${a.id}${a.why ? ` — ${a.why}` : ''}`);
  if (!argv.includes('--apply')) {
    console.log(`\n미리보기다(쓰지 않았다). 대상: ${claudeDir}${codexAgents ? ` · ${codexAgents}(표식 블록)` : ''}\n실제로 깔려면: npm run skills:sync -- --apply`);
    return;
  }
  const installed = applySync({ plan, skills, claudeDir, codexAgents });
  console.log(`\nAPPLIED: ${installed.length}개 스킬 · ${claudeDir}${codexAgents ? ` · ${codexAgents}` : ''} · revision ${revision?.slice(0, 8)}`);
  if (plan.actions.some((a) => a.op === 'conflict')) process.exitCode = 3;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
