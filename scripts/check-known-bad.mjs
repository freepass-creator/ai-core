// 「검사기가 초록」과 「검사기가 무언가를 잡는다」는 다른 주장이다. 이 자는 뒤쪽을 기계로 증명한다.
//
// 원본: freepasserp4 scripts/check-known-bad.mts (2026-09-16 — 초록인데 아무것도 못 잡던 검사기 다섯의 교훈).
// registry/checker-known-bad.json 의 검사기마다:
//   ㉠ 기준선 — 자가진단을 그대로 돌린다 → 초록이어야 한다
//   ㉡ 무력화 — 봉쇄 «하나만» 끈 사본을 제자리에 쓰고 돌린다 → 빨개져야 한다
//   ㉢ 분간   — 빨개진 이유가 marker 글귀인지 본다(엉뚱한 데서 죽은 것과 가른다)
// 끄는 글귀가 소스에 정확히 한 번 나오지 않으면 그 자리에서 실패한다 — 표본이 코드에서 떨어져 나간 것을 통과로 넘기지 않는다.
// 무력화 사본은 늘 원래대로 되돌린다(finally).
//
//   node scripts/check-known-bad.mjs              전부 잰다
//   node scripts/check-known-bad.mjs --self-test  이 기계장치 자신을 가짜 검사기 넷으로 잰다
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(base, args) {
  const r = spawnSync(process.execPath, args, { cwd: base, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } });
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/** 한 검사기를 판정한다. 통과하면 빈 배열. 실제 검사기와 자가진단의 가짜 검사기가 «같은» 판정을 탄다. */
export function judge(name, entry, base = root) {
  const fails = [];
  const baseline = run(base, entry.run);
  if (baseline.code !== 0) return [`${name}: baseline is already red (exit ${baseline.code}) — the mutation test cannot stand`];
  if (!entry.blockades?.length) return [`${name}: no blockades listed — an empty list proves nothing`];
  for (const blockade of entry.blockades) {
    const file = join(base, blockade.file);
    const original = readFileSync(file, 'utf8');
    const [find, replace] = blockade.disable;
    const count = original.split(find).length - 1;
    if (count !== 1) { fails.push(`${name} · ${blockade.name}: disable text appears ${count} times in ${blockade.file} (must be exactly 1)`); continue; }
    try {
      writeFileSync(file, original.split(find).join(replace));
      const mutant = run(base, entry.run);
      if (mutant.code === 0) fails.push(`${name} · ${blockade.name}: still GREEN with this blockade off — its sample does not test it`);
      else if (!mutant.out.includes(entry.marker)) fails.push(`${name} · ${blockade.name}: red, but not for "${entry.marker}" — it died somewhere else`);
    } finally {
      writeFileSync(file, original);
    }
  }
  return fails;
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--self-test')) {
  const fixtures = join(root, 'test/fixtures/known-bad');
  const make = script => ({ run: [script], marker: 'CHECKER BROKEN', blockades: [{ name: 'detector', file: script, disable: ['const DETECT = /forbidden/;', 'const DETECT = /(?!)/;'] }] });
  const cases = [['honest', 'honest.mjs', true], ['blind', 'blind.mjs', false], ['false green', 'false-green.mjs', false], ['wrong reason', 'wrong-reason.mjs', false]];
  const wrong = [];
  for (const [label, script, shouldPass] of cases) {
    const passed = judge(label, make(script), fixtures).length === 0;
    if (passed !== shouldPass) wrong.push(`${label} checker: expected ${shouldPass ? 'PASS' : 'FAIL'}`);
  }
  if (wrong.length) { console.error(`HARNESS BROKEN: ${wrong.join(' · ')}`); process.exit(1); }
  console.log('PASS: harness self-test — honest checker passes, blind / false-green / wrong-reason checkers fail');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const registry = JSON.parse(readFileSync(join(root, 'registry/checker-known-bad.json'), 'utf8'));
  const fails = [];
  let proven = 0;
  for (const [name, entry] of Object.entries(registry.checkers)) {
    const result = judge(name, entry);
    if (result.length) fails.push(...result); else { proven += 1; console.log(`  ✓ ${name} — ${entry.blockades.length} blockades each turn it red`); }
  }
  if (fails.length) { for (const f of fails) console.error(`FAIL: ${f}`); process.exit(1); }
  console.log(`PASS: ${proven} checkers proven to catch what they claim`);
}
