#!/usr/bin/env node
/**
 * ★저장소 — `C:\dev` 를 한 번에 훑어 «무엇이 살아 있나» 를 낸다.
 *
 * 대표(2026-08-30): 「내가 너한테 AI로 하는 모든 업무를 여기서 관장할 수 있게끔 만들어 놔야 돼」
 *
 * ── 왜 도구인가
 * `docs/저장소지도.md` 는 «센 때» 가 박힌 종이다. 종이는 낡는다.
 * 이 도구가 매번 다시 세고, 지도와 어긋나면 그때 지도를 고친다.
 *
 * ── ★읽기만 한다
 * git 상태를 «읽을» 뿐, 커밋·푸시·체크아웃을 하지 않는다. 아무것도 바꾸지 않는다.
 *
 *   node scripts/저장소.mjs              살아 있는 것만 (14일 안에 손댄 것)
 *   node scripts/저장소.mjs --전부        43폴더 다
 *   node scripts/저장소.mjs --위험        ★미커밋·개인정보·중복만
 *   node scripts/저장소.mjs --json       기계가 읽게
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const 뿌리 = process.env.DEV_ROOT || 'C:/dev';
const 산것 = 14;                       // ★며칠 안에 손댔으면 「살아 있다」 로 보나
const 미커밋많다 = 20;                  // 이보다 많으면 짚는다

const 결 = process.argv.includes('--json');
const 전부 = process.argv.includes('--전부');
const 위험만 = process.argv.includes('--위험');

/** git 명령. 실패하면 null — 저장소가 아니거나 깨진 것이다 */
function git(경로, ...말) {
  try {
    return execFileSync('git', ['-C', 경로, ...말], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000,
    }).trim();
  } catch { return null; }
}

/** README 첫 제목 한 줄 — 「이게 무엇인가」 */
function 제목(경로) {
  for (const 이름 of ['README.md', 'readme.md']) {
    const p = join(경로, 이름);
    if (!existsSync(p)) continue;
    try {
      const 줄 = readFileSync(p, 'utf8').split('\n', 12);
      const h = 줄.find((l) => l.startsWith('# '));
      if (h) return h.slice(2).trim().slice(0, 70);
    } catch { /* 못 읽으면 넘어간다 */ }
  }
  return null;
}

function 이름표(경로) {
  const p = join(경로, 'package.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')).name ?? null; } catch { return null; }
}

function 배포(경로) {
  const 목 = [];
  if (existsSync(join(경로, '.vercel'))) 목.push('Vercel');
  else if (existsSync(join(경로, 'vercel.json'))) 목.push('vercel?');
  if (existsSync(join(경로, 'firebase.json'))) 목.push('Firebase');
  return 목;
}

/**
 * ★계약서 «양식» 에 박힌 예시값을 걸러낸다 — `123456-1234567` 같은 것.
 *
 *  이걸 안 걸러내면 양식 파일 여덟 벌이 매번 뜬다. 진짜 유출이 그 사이에 묻힌다.
 *  ★애매하면 «진짜» 로 본다 — 놓치는 것보다 한 번 더 보는 게 낫다.
 */
function 진짜같나(주민) {
  const [앞, 뒤] = 주민.split('-');
  if (/^(\d)\1{5}$/.test(앞) || /^(\d)\1{6}$/.test(뒤)) return false;   // 000000 · 1111111
  if (앞 === '123456' || 뒤 === '1234567') return false;                 // 대놓고 예시
  const 오름 = (s) => [...s].every((c, i) => i === 0 || +c === (+s[i - 1] + 1) % 10);
  if (오름(앞) || 오름(뒤)) return false;                                 // 2345678 꼴
  const 월 = +앞.slice(2, 4); const 일 = +앞.slice(4, 6);
  if (월 < 1 || 월 > 12 || 일 < 1 || 일 > 31) return false;              // 생일이 아니다
  return true;
}

/** 훑지 않는 곳 — 남의 코드거나 빌드물이다 */
const 건너뛴다 = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.vercel', 'out', 'coverage']);

/** 저장소 안을 «두 겹까지» 훑어 파일을 모은다. tmp/ 같은 데에 개인정보가 앉는다 */
function 파일들(경로, 깊이 = 2, 뿌리길 = '') {
  const 모음 = [];
  let 목록;
  try { 목록 = readdirSync(경로, { withFileTypes: true }); } catch { return 모음; }
  for (const e of 목록) {
    const 길 = 뿌리길 ? `${뿌리길}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (깊이 <= 0 || 건너뛴다.has(e.name) || e.name.startsWith('.')) continue;
      모음.push(...파일들(join(경로, e.name), 깊이 - 1, 길));
    } else if (e.isFile() && /\.(html|csv|json|txt|md)$/i.test(e.name)) {
      모음.push(길);
    }
  }
  return 모음;
}

/**
 * ★주민번호가 든 파일을 찾는다.
 *
 *  ★★핵심은 «몇 개 있나» 가 아니라 «깃이 막고 있나» 다.
 *  막힌 것(tmp/ 같은 곳)은 일하려면 있어야 한다 — 지우라는 뜻이 아니다.
 *  ★안 막힌 것만이 사고다. `git add .` 한 번이면 GitHub 로 가고, 되돌릴 수 없다.
 */
function 개인정보(경로) {
  const 짚 = [];
  for (const 길 of 파일들(경로)) {
    const p = join(경로, 길);
    let 크기;
    try { 크기 = statSync(p).size; } catch { continue; }
    if (크기 < 2000 || 크기 > 80 * 1024 * 1024) continue;
    let 글;
    try { 글 = readFileSync(p, 'utf8'); } catch { continue; }
    /** 주민번호 꼴 — 뒤 첫 자리는 1~4(내국인)·5~8(외국인) 만. 날짜·전화와 헷갈리지 않게 */
    const 딴 = (글.match(/\b\d{6}-[1-8]\d{6}\b/g) ?? []).filter(진짜같나);
    const 수 = new Set(딴).size;   // ★같은 사람이 여러 번 나와도 한 명이다
    if (수 < 3) continue;
    /** check-ignore 는 막으면 0, 안 막으면 1 로 끝난다 — git() 이 실패를 null 로 돌려준다 */
    const 막히나 = git(경로, 'check-ignore', '-q', 길) !== null;
    짚.push({ 파일: 길, 주민번호: 수, 깃이막나: 막히나 });
  }
  return 짚.sort((a, b) => Number(a.깃이막나) - Number(b.깃이막나) || b.주민번호 - a.주민번호);
}

const 폴더들 = readdirSync(뿌리, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== '-' && !e.name.startsWith('.'))
  .map((e) => e.name)
  .sort();

const 지금 = Date.now();
const 목 = [];

for (const 이름 of 폴더들) {
  const 경로 = join(뿌리, 이름);
  const 깃 = existsSync(join(경로, '.git'));
  const 마지막 = 깃 ? git(경로, 'log', '-1', '--format=%cI') : null;
  const 날 = 마지막 ? 마지막.slice(0, 10) : null;
  const 지난날 = 마지막 ? Math.floor((지금 - Date.parse(마지막)) / 86_400_000) : null;
  const 상태 = 깃 ? git(경로, 'status', '--porcelain') : null;

  목.push({
    이름,
    깃,
    가지: 깃 ? git(경로, 'rev-parse', '--abbrev-ref', 'HEAD') : null,
    마지막: 날,
    지난날,
    미커밋: 상태 ? (상태 ? 상태.split('\n').filter(Boolean).length : 0) : null,
    배포: 배포(경로),
    제목: 제목(경로),
    이름표: 이름표(경로),
    개인정보: 개인정보(경로),
    삶: 지난날 === null ? '깃아님' : 지난날 <= 산것 ? '산것' : '잠김',
  });
}

/** ★같은 제품이 여러 폴더에 있나 — 제목이나 package name 이 겹치면 짚는다 */
const 겹침 = new Map();
for (const r of 목) {
  for (const 키 of [r.이름표, r.제목].filter(Boolean)) {
    if (!겹침.has(키)) 겹침.set(키, []);
    겹침.get(키).push(r.이름);
  }
}
const 갈린것 = [...겹침].filter(([, v]) => v.length > 1).map(([키, v]) => ({ 같은것: 키, 폴더: v }));

const 위험 = {
  미커밋많음: 목.filter((r) => (r.미커밋 ?? 0) >= 미커밋많다)
    .sort((a, b) => b.미커밋 - a.미커밋)
    .map((r) => ({ 이름: r.이름, 미커밋: r.미커밋 })),
  개인정보: 목.flatMap((r) => r.개인정보.map((x) => ({ 이름: r.이름, ...x }))),
  같은것이여러폴더: 갈린것,
  깃아님: 목.filter((r) => !r.깃).map((r) => r.이름),
};

if (결) {
  console.log(JSON.stringify({ 센때: new Date().toISOString(), 뿌리, 목, 위험 }, null, 2));
  process.exit(0);
}

const 칸 = (s, n) => String(s ?? '').padEnd(n).slice(0, n);

if (!위험만) {
  const 볼것 = 전부 ? 목 : 목.filter((r) => r.삶 === '산것');
  console.log(`\n★ ${뿌리} — 폴더 ${목.length} · 산 것 ${목.filter((r) => r.삶 === '산것').length} (${산것}일 안)\n`);
  console.log(`  ${칸('저장소', 24)} ${칸('마지막', 11)} ${칸('미커밋', 7)} ${칸('배포', 18)} 무엇`);
  console.log(`  ${'─'.repeat(96)}`);
  for (const r of [...볼것].sort((a, b) => String(b.마지막 ?? '').localeCompare(String(a.마지막 ?? '')))) {
    const 미 = r.미커밋 === null ? '—' : r.미커밋 >= 미커밋많다 ? `★${r.미커밋}` : String(r.미커밋);
    console.log(`  ${칸(r.이름, 24)} ${칸(r.마지막 ?? '(깃아님)', 11)} ${칸(미, 7)} ${칸(r.배포.join('+'), 18)} ${r.제목 ?? ''}`);
  }
  if (!전부) console.log(`\n  (잠긴 것 ${목.filter((r) => r.삶 !== '산것').length}개는 --전부 로 본다)`);
}

console.log('\n★★짚을 것\n');
let 짚은게있나 = false;

const 샌다 = 위험.개인정보.filter((x) => !x.깃이막나);
const 막혔다 = 위험.개인정보.filter((x) => x.깃이막나);

if (샌다.length) {
  짚은게있나 = true;
  console.log('  ① ★★주민번호가 든 파일인데 깃이 «안 막는다»');
  for (const x of 샌다) console.log(`     ★★ ${x.이름}/${x.파일} — 주민번호 ${x.주민번호}`);
  console.log('     `git add .` 한 번이면 GitHub 로 간다. ★올라가면 되돌릴 수 없다');
  console.log('     → .gitignore 에 넣거나 tmp/ 로 옮긴다\n');
}
if (막혔다.length) {
  console.log(`  ○ 주민번호가 든 파일 ${막혔다.length}개는 ★깃이 막고 있다 (일하려면 있어야 하는 것 — 그대로 둔다)`);
  for (const x of 막혔다) console.log(`       ${x.이름}/${x.파일} — ${x.주민번호}`);
  console.log('');
}

if (위험.미커밋많음.length) {
  짚은게있나 = true;
  console.log(`  ② 미커밋이 ${미커밋많다} 넘는 저장소 — 사고 나면 그대로 날아간다`);
  for (const x of 위험.미커밋많음) console.log(`     ${칸(x.이름, 24)} ${x.미커밋}`);
  console.log('');
}

if (위험.같은것이여러폴더.length) {
  짚은게있나 = true;
  console.log('  ③ 같은 것이 여러 폴더에 있다 — ★어느 것이 정본인가');
  for (const x of 위험.같은것이여러폴더) console.log(`     「${x.같은것}」 → ${x.폴더.join(' · ')}`);
  console.log('');
}

if (!짚은게있나) console.log('  없다.\n');

console.log(`  지도: docs/저장소지도.md — 이 결과와 어긋나면 ★지도를 고친다\n`);
