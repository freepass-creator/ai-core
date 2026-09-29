#!/usr/bin/env node
// 일몰 구역이 «줄고 있나»를 잰다. 늘면 FAIL 한다.
//
// ★대표 2026-09-29: 「삭제할 수 있는 준비를 하자고」
//   지우려면 ①보존 ②참조 0 이 필요하다. 이 검사는 ②를 세고, 늘어나면 막는다.
//   통합이 «멈춘» 것과 «되는 중»인 것을 숫자로 구별하려는 것이다 — 말로는 늘 되는 중이다.
//
//   node scripts/check-sunset-progress.mjs              본다
//   node scripts/check-sunset-progress.mjs --baseline   지금 값을 기준선으로 «내려» 적는다(올리지는 못한다)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 준비도 } from '../src/governance/sunset.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const 설정읽기 = () => JSON.parse(readFileSync(resolve(root, 'registry/sunset.json'), 'utf8'));

/** ★읽기 실패를 빈 값으로 돌려주지 않는다 — 그러면 「참조 0」이라는 거짓 합격이 난다. */
const git = (...인자) => {
  try { return execFileSync('git', ['-c', 'core.quotepath=false', ...인자], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }); }
  catch (오류) { throw new Error(`GIT_UNREADABLE: ${String(오류.message).split('\n')[0]}`); }
};

export function 저장소파일() {
  const 목록 = git('ls-files').trim().split('\n').filter(Boolean);
  const 본문 = [];
  for (const path of 목록) {
    if (!/\.(mjs|js|cjs|ts|mts|tsx|jsx|json|md|ps1|cmd|sh|py|yml|yaml|txt)$/i.test(path)) continue;
    try { 본문.push({ path, text: readFileSync(resolve(root, path), 'utf8') }); } catch { /* 이진·권한 */ }
  }
  return { 목록, 본문 };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const 설정 = 설정읽기();
  const { 목록, 본문 } = 저장소파일();
  const 모든구역 = 설정.areas.map((a) => a.path);
  const 결과 = 설정.areas.map((a) => 준비도(a, 본문, 목록.filter((f) => f.startsWith(a.path)).length, 모든구역, 설정.self?.files ?? [], 설정.self?.record_prefixes ?? []));

  console.log('일몰 구역 — 참조가 0 이 되고 보존이 끝나야 지울 수 있다\n');
  for (const r of 결과) {
    const 설명 = 설정.areas.find((a) => a.path === r.구역);
    console.log(`  ${r.구역.padEnd(22)} 파일 ${String(r.파일수).padStart(4)} · 끌어씀 ${String(r.끌어씀).padStart(3)}/${r.기준선.끌어씀} · 언급 ${String(r.언급).padStart(3)}/${r.기준선.언급} · 일몰끼리 ${String(r.일몰끼리).padStart(2)} · 보존 ${설명.preserved ? 'O' : '★X'} · ${r.지울수있나 ? '지울 수 있다' : '아직'}`);
    for (const f of r.막는것) console.log(`        ↳ ${f}`);
  }

  if (process.argv.includes('--baseline')) {
    let 내림 = 0;
    for (const r of 결과) {
      const a = 설정.areas.find((x) => x.path === r.구역);
      for (const k of ['끌어씀', '언급']) {
        if (r[k] < a.baseline[k]) { a.baseline[k] = r[k]; 내림 += 1; }
      }
    }
    writeFileSync(resolve(root, 'registry/sunset.json'), `${JSON.stringify(설정, null, 2)}\n`);
    console.log(`\n기준선 ${내림}개 내림 (올리지는 않는다)`);
  }

  const 넘은것 = 결과.filter((r) => r.넘음.끌어씀 || r.넘음.언급);
  if (넘은것.length) {
    console.error('');
    for (const r of 넘은것) console.error(`FAIL: ${r.구역} 참조가 기준선보다 늘었다 — 끌어씀 +${r.넘음.끌어씀} · 언급 +${r.넘음.언급}`);
    console.error('일몰 구역은 «줄어들기만» 해야 한다. 새로 끌어 쓰지 말고, 옮겨 갈 자리에 쓴다.');
    process.exit(1);
  }
  console.log('\nPASS: 늘어난 구역 없음');
}
