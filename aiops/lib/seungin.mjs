/** ★★승인 — «누가 봐야 지나가나».
 *
 *  OPS-20260831-110 (대표 2026-08-31):
 *    「과태료 발송전 PDF 생성의 승인 구조를 **Claude 단일 필수** 구조에서
 *      **다중 검증 대체** 구조로 바꿔 주세요」
 *
 *  ── ★왜 바꾸나 — 한 사람이 막으면 일이 통째로 선다
 *  전에는 D등급이 「Claude DESIGN + FINAL + 대표 직전 승인」 이었다.
 *  ★Claude 가 한도를 넘거나 로그인이 풀리면 «아무것도 못 나간다».
 *  2026-08-20 에 Codex lease 가 만료돼 일이 멈춘 것과 같은 꼴이다 — 단일 지점이다.
 *
 *  ── ★★가르는 것은 «등급» 이 아니라 «행위» 다
 *  전에는 「Drive 를 건드리나」 하나로 D 를 갈랐다. 그래서 «새 파일 하나 얹는 것» 과
 *  «정본을 지우는 것» 이 같은 문턱을 넘어야 했다. 위험이 다른데 문턱이 같으면
 *  ★사람은 낮은 쪽에 맞춰 문턱을 낮춘다. 그래서 행위로 가른다.
 *
 *      local        로컬 PDF 생성·형식 검증          → ★Codex 단독. 승인 없다
 *      drive-add    Drive 발송전 폴더에 «새 파일만»   → 대표 직전 승인 + Codex + ★독립 검토자 1
 *      protected    삭제·영구이동·권한변경·관청 실제 발송·정본 대량삭제
 *                                                  → ★사람 직전 승인 «필수». 긴급 우회도 못 한다
 *
 *  ── ★검토자는 갈아 끼울 수 있다
 *      claude   기본 검토자
 *      cursor   대체
 *      gemini   대체
 *  ★«한 명이면 된다». 다만 실행자는 자기 일을 자기가 검토할 수 없다.
 *
 *  ── ★★검토를 «지어낼» 수 없게 — 이 파일의 핵심이다
 *  검토는 «무엇을» 봤는지에 묶인다: 계획SHA · 양식SHA · 대상해시.
 *  ★셋 중 하나라도 달라지면 그 검토는 «없는 것» 이 된다.
 *    계획을 고치고 옛 검토를 재활용하는 길을 막는다.
 *  ★기록은 append-only 다. 지우거나 고쳐 쓰면 사슬해시가 어긋나 드러난다.
 *
 *  ── 긴급 우회 (대표 2026-08-31 추가 지시)
 *  「대표가 대상·건수·계획SHA·양식SHA 를 확인하고 «긴급 실행 승인» 하면
 *    Claude/Cursor/Gemini 검토가 없어도 실행할 수 있게」
 *  ★허용은 local 과 drive-add 까지다. protected 는 긴급으로도 못 연다.
 *  ★유효시간은 짧다(기본 15분). 승인 문구·시각·명령해시·대상해시가 다 남는다.
 */
import { createHash, randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { coordinationDir, appendAudit } from './lease.mjs';

/** ── 행위 등급 */
export const 행위등급 = Object.freeze({
  local: {
    이름: 'local',
    무엇: '로컬 PDF 생성·형식 검증 — 바깥에 아무것도 안 나간다',
    검토자수: 0,
    대표승인: false,
    긴급우회: true,
  },
  'drive-add': {
    이름: 'drive-add',
    무엇: 'Drive 발송전 폴더에 «새 파일만» 얹는다 — 지우지도 옮기지도 않는다',
    검토자수: 1,
    대표승인: true,
    긴급우회: true,
  },
  /** ★★★2026-09-03 대표 판단 — 「잠금만 쥐고 돈다」
   *
   *  ── ★무엇이 어긋나 있었나
   *  CLAUDE.md (대표 2026-08-30 「쓰기 이런 거 이제 다 권한 풀어 · 승인 절차도 없이」) 는
   *  막히는 것을 「★관청 실제 발송 · 정본 대량 삭제」 «둘» 로 적는데,
   *  여기 protected 는 「삭제 · 영구이동 · 권한변경」 까지 «다섯» 이었다.
   *  ★과태료 엔진은 파일을 옮기고(⑧′·⑧‴) 겹친 옛 판을 휴지통에 보낸다(⑦′).
   *    어느 문서를 읽느냐로 「승인이 필요한가」 가 갈렸다. 코덱스와 내가 이 자리에서 갈렸다.
   *
   *  ── ★대표가 정한 것: «우리 드라이브 안» 의 이동·휴지통은 잠금만 쥐고 돈다
   *  · 되돌릴 수 있다 — 휴지통이지 삭제가 아니고, 원본은 「원본공문(줄이기전)」 에 남는다
   *  · 관청에는 못 나간다 — 발송전까지가 기계 몫이고 문서24 는 사람이 올린다
   *  · 잠금은 권한이 아니라 «차례» 다. 누가·언제·무엇을 는 audit.ndjson 에 그대로 남는다
   *
   *  ★그대로 남는 것 — 관청 실제 발송 · 정본 대량삭제 · 권한변경. 여기는 긴급으로도 못 연다.
   */
  protected: {
    이름: 'protected',
    무엇: '★관청 실제 발송 · 정본 대량삭제 · 권한변경  (우리 드라이브 안 이동·휴지통은 잠금만)',
    검토자수: 1,
    대표승인: true,
    긴급우회: false,
  },
});

/** ── 검토자 — claude 가 기본, 없으면 cursor·gemini 가 대신한다 */
export const 검토자들 = Object.freeze(['claude', 'cursor', 'gemini']);
export const 기본검토자 = 'claude';
/** ★실행자는 자기 일을 자기가 검토할 수 없다 */
export const 실행자들 = Object.freeze(['codex', 'claude']);

const 긴급기본TTL = 15 * 60 * 1000;
const 검토기본TTL = 24 * 60 * 60 * 1000;

const 씻 = (v, 이름, 최대 = 300) => {
  const t = String(v ?? '').trim();
  if (!t || t.length > 최대 || /[\r\n\0]/.test(t)) throw new Error(`${이름}은 한 줄 ${최대}자 이하여야 한다`);
  return t;
};
const 이제 = () => new Date().toISOString();
export const 해시 = (v) => createHash('sha256').update(String(v)).digest('hex');

/** ★파일 하나의 해시 — 양식이 바뀌면 검토가 무효가 되어야 한다 */
export async function 파일해시(경로) {
  return new Promise((맞다, 틀렸다) => {
    const h = createHash('sha256');
    createReadStream(경로).on('data', (d) => h.update(d)).on('end', () => 맞다(h.digest('hex'))).on('error', 틀렸다);
  });
}

/** ★여러 파일을 «한 값» 으로 — 순서가 달라도 같은 값이 나와야 한다 */
export async function 양식해시(경로들) {
  const 것 = [...new Set((경로들 ?? []).filter(Boolean))].sort();
  if (!것.length) throw new Error('양식 경로가 없다');
  const 낱개 = [];
  for (const p of 것) 낱개.push(`${p}:${await 파일해시(p)}`);
  return 해시(낱개.join('|'));
}

/** ★대상 해시 — 「무엇을 건드리나」. 파일 id 를 정렬해 잇는다 */
export function 대상해시(대상들) {
  const 것 = [...new Set((대상들 ?? []).map((x) => String(x ?? '').trim()).filter(Boolean))].sort();
  if (!것.length) throw new Error('대상이 없다');
  return { 해시: 해시(것.join('|')), 건수: 것.length };
}

/** ★계획 해시 — 「무엇을 하겠다」. 객체를 안정된 꼴로 굳혀 해시한다 */
export function 계획해시(계획) {
  const 굳히기 = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(굳히기);
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, 굳히기(v[k])]));
  };
  return 해시(JSON.stringify(굳히기(계획)));
}

/** 묶음 — 검토·승인이 «무엇에» 묶이나 */
export function 묶음(등급, { 계획SHA, 양식SHA, 대상SHA, 건수 }) {
  const g = 행위등급[등급];
  if (!g) throw new Error(`모르는 행위등급: ${등급}`);
  return {
    행위등급: g.이름,
    계획SHA: 씻(계획SHA, '계획SHA', 64),
    양식SHA: 씻(양식SHA, '양식SHA', 64),
    대상SHA: 씻(대상SHA, '대상SHA', 64),
    건수: Number(건수) || 0,
  };
}
export const 묶음키 = (b) => 해시([b.행위등급, b.계획SHA, b.양식SHA, b.대상SHA].join('|'));

/** ── 기록 자리 (append-only) */
const 기록길 = () => join(coordinationDir(), 'seungin.ndjson');

async function 다읽는다() {
  try {
    const 글 = await readFile(기록길(), 'utf8');
    return 글.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) { if (e?.code === 'ENOENT') return []; throw e; }
}

async function 마지막사슬() {
  const 줄 = await 다읽는다();
  return 줄.length ? String(줄[줄.length - 1].chain ?? '') : 'GENESIS';
}

async function 적는다(줄) {
  const root = coordinationDir();
  await mkdir(root, { recursive: true });
  /** ★사슬해시 — 지우거나 고쳐 쓰면 다음 줄과 어긋나 드러난다 */
  const 앞 = await 마지막사슬();
  const 본 = { at: 이제(), id: randomUUID(), ...줄 };
  const 것 = { ...본, prev: 앞, chain: 해시(`${앞}|${JSON.stringify(본)}`) };
  await appendFile(기록길(), `${JSON.stringify(것)}\n`, 'utf8');
  return 것;
}

/** ★사슬이 안 끊겼나 — 누가 줄을 지웠거나 고쳐 썼는지 본다 */
export async function 사슬검사() {
  const 줄 = await 다읽는다();
  let 앞 = 'GENESIS';
  for (const [i, r] of 줄.entries()) {
    const { prev, chain, ...본 } = r;
    if (prev !== 앞) return { 성하다: false, 어디: i, 왜: '앞 사슬이 어긋난다 — 줄이 지워졌거나 끼워졌다' };
    if (chain !== 해시(`${앞}|${JSON.stringify(본)}`)) return { 성하다: false, 어디: i, 왜: '줄 내용이 고쳐졌다' };
    앞 = chain;
  }
  return { 성하다: true, 줄수: 줄.length };
}

/** ★★사슬만으로는 «통째로 다시 쓰는 것» 을 못 잡는다.
 *
 *  사슬은 스스로를 검증한다 — 그래서 파일을 통째로 지우고 GENESIS 부터 새로 이으면 성해 보인다.
 *  ★그래서 «다른 파일» 에도 남긴다. `검토기록`·`대표승인` 은 `.coordination/audit.ndjson` 에도
 *    같은 묶음키를 적는다(`appendAudit`). 숨기려면 «두 파일을 다 고쳐야» 한다.
 *
 *  ★대조에서 어긋나면 그 자체가 신호다 — 「없어야 할 것이 있다」 보다
 *    「있어야 할 것이 없다」 가 더 위험하다(검토를 생략한 것이니).
 */
export async function 대조검사() {
  const 줄 = await 다읽는다();
  let 감사 = [];
  try {
    const 글 = await readFile(join(coordinationDir(), 'audit.ndjson'), 'utf8');
    감사 = 글.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch (e) { if (e?.code !== 'ENOENT') throw e; }

  const 감사키 = new Set(감사.filter((r) => String(r.type ?? '').startsWith('seungin-')).map((r) => `${r.type}|${r.묶음키}`));
  const 이름 = { 검토: 'seungin-review', 대표승인: 'seungin-owner', 긴급승인: 'seungin-emergency' };
  const 빠진것 = [];
  for (const r of 줄) {
    const t = 이름[r.type];
    if (!t) continue;
    if (!감사키.has(`${t}|${r.묶음키}`)) 빠진것.push({ type: r.type, 검토자: r.검토자 ?? null, 묶음키: r.묶음키, 언제: r.at });
  }
  /** ★감사에는 있는데 승인장부에 없는 것 — 승인 줄이 «지워졌다» 는 뜻이다 */
  const 장부키 = new Set(줄.map((r) => `${이름[r.type] ?? r.type}|${r.묶음키}`));
  const 지워진것 = 감사
    .filter((r) => String(r.type ?? '').startsWith('seungin-'))
    .filter((r) => !장부키.has(`${r.type}|${r.묶음키}`))
    .map((r) => ({ type: r.type, 검토자: r.검토자 ?? null, 묶음키: r.묶음키, 언제: r.at }));

  return {
    성하다: !빠진것.length && !지워진것.length,
    감사에없다: 빠진것,
    ['★장부에서 지워졌다']: 지워진것,
  };
}

/** ── ★검토 기록 — 검토자가 «무엇을 보고» 어떻게 판정했나 */
export async function 검토기록({ 검토자, 판정, 근거, 등급, 계획SHA, 양식SHA, 대상SHA, 건수, ttlMs = 검토기본TTL }) {
  const 누 = 씻(검토자, '검토자', 24).toLowerCase();
  if (!검토자들.includes(누)) throw new Error(`검토자는 ${검토자들.join('·')} 중 하나여야 한다: ${검토자}`);
  const 판 = 씻(판정, '판정', 24).toUpperCase();
  if (!['APPROVE', 'BLOCK'].includes(판)) throw new Error('판정은 APPROVE 또는 BLOCK 이어야 한다');
  const b = 묶음(등급, { 계획SHA, 양식SHA, 대상SHA, 건수 });
  const 키 = 묶음키(b);
  const 것 = await 적는다({
    type: '검토', 검토자: 누, 판정: 판, 근거: 씻(근거, '근거', 500),
    ...b, 묶음키: 키, 만료: new Date(Date.now() + Number(ttlMs)).toISOString(),
  });
  await appendAudit({ type: 'seungin-review', 검토자: 누, 판정: 판, 행위등급: b.행위등급, 묶음키: 키 });
  return 것;
}

/** ── ★대표 직전 승인 (긴급이면 긴급=true) */
export async function 대표승인({ 문구, 등급, 계획SHA, 양식SHA, 대상SHA, 건수, 명령, ttlMs = 긴급기본TTL, 긴급 = false }) {
  const b = 묶음(등급, { 계획SHA, 양식SHA, 대상SHA, 건수 });
  const g = 행위등급[b.행위등급];
  if (긴급 && !g.긴급우회) throw new Error(`「${b.행위등급}」 은 긴급 우회로 열 수 없다 — ${g.무엇}`);
  const 키 = 묶음키(b);
  const 것 = await 적는다({
    type: 긴급 ? '긴급승인' : '대표승인',
    문구: 씻(문구, '승인 문구', 200),
    명령해시: 명령 ? 해시(Array.isArray(명령) ? 명령.join(' ') : String(명령)) : null,
    ...b, 묶음키: 키,
    만료: new Date(Date.now() + Number(ttlMs)).toISOString(),
  });
  await appendAudit({ type: 긴급 ? 'seungin-emergency' : 'seungin-owner', 행위등급: b.행위등급, 건수: b.건수, 묶음키: 키 });
  return 것;
}

const 살았나 = (r, 지금 = Date.now()) => !r.만료 || Date.parse(r.만료) > 지금;
const 명령맞나 = (r, 명령) => !r.명령해시 || !명령 || r.명령해시 === 해시(Array.isArray(명령) ? 명령.join(' ') : String(명령));

/**
 * ★★실행 문턱 — 이 묶음을 지나가도 되나.
 *
 *  돌려주는 것 : { 된다, 왜, 길, 검토, 승인 }
 *    길 = 'codex단독' | '검토+대표' | '긴급'
 */
export async function 지나가도되나({ 등급, 계획SHA, 양식SHA, 대상SHA, 건수, 실행자, 명령 }) {
  const b = 묶음(등급, { 계획SHA, 양식SHA, 대상SHA, 건수 });
  const g = 행위등급[b.행위등급];
  const 키 = 묶음키(b);
  const 실 = 씻(실행자, '실행자', 24).toLowerCase();
  if (!실행자들.includes(실)) return { 된다: false, 왜: `실행자는 ${실행자들.join('·')} 중 하나여야 한다` };

  /** ★① 로컬은 그냥 지나간다 — 바깥에 아무것도 안 나간다 */
  if (!g.대표승인 && !g.검토자수) return { 된다: true, 길: 'codex단독', 왜: g.무엇 };

  const 줄 = (await 다읽는다()).filter((r) => r.묶음키 === 키 && 살았나(r));

  /** ★② 긴급 우회 — 대표가 직접 열었나 */
  const 긴급 = 줄.filter((r) => r.type === '긴급승인').filter((r) => 명령맞나(r, 명령)).at(-1);
  if (긴급) {
    if (!g.긴급우회) return { 된다: false, 왜: `「${b.행위등급}」 은 긴급 우회로 열 수 없다` };
    return { 된다: true, 길: '긴급', 왜: `대표 긴급 승인 「${긴급.문구}」 (${긴급.at})`, 승인: 긴급 };
  }

  /** ★③ 검토자 — 한 명이면 된다. 실행자 자신은 안 된다 */
  const 검토 = 줄.filter((r) => r.type === '검토');
  const 막은것 = 검토.filter((r) => r.판정 === 'BLOCK');
  if (막은것.length) return { 된다: false, 왜: `★${막은것.at(-1).검토자} 가 막았다: ${막은것.at(-1).근거}` };
  const 통과 = 검토.filter((r) => r.판정 === 'APPROVE' && r.검토자 !== 실);
  if (통과.length < g.검토자수) {
    return {
      된다: false,
      왜: `독립 검토자 ${g.검토자수}명이 필요한데 ${통과.length}명이다`
        + ` — ${검토자들.filter((x) => x !== 실).join('·')} 중 하나가 이 묶음(${키.slice(0, 12)})을 보아야 한다`,
    };
  }

  /** ★④ 대표 직전 승인 */
  const 승인 = 줄.filter((r) => r.type === '대표승인').filter((r) => 명령맞나(r, 명령)).at(-1);
  if (g.대표승인 && !승인) return { 된다: false, 왜: '대표 직전 승인이 없다 (또는 만료됐다)' };

  return { 된다: true, 길: '검토+대표', 왜: `${통과.map((r) => r.검토자).join('·')} 검토 + 대표 승인`, 검토: 통과, 승인 };
}

/** ★실행 전후를 남긴다 — 무엇이 있었고 무엇이 생겼나 */
export async function 실행기록({ 등급, 계획SHA, 양식SHA, 대상SHA, 건수, 실행자, 길, 명령, 언제, 전, 후, 결과 }) {
  const b = 묶음(등급, { 계획SHA, 양식SHA, 대상SHA, 건수 });
  return 적는다({
    type: 언제 === '전' ? '실행전' : '실행후',
    실행자: 씻(실행자, '실행자', 24).toLowerCase(), 길: 길 ?? null,
    명령해시: 명령 ? 해시(Array.isArray(명령) ? 명령.join(' ') : String(명령)) : null,
    ...b, 묶음키: 묶음키(b),
    전: 전 ?? null, 후: 후 ?? null, 결과: 결과 ?? null,
  });
}

/** 사람이 보는 화면용 — 이 묶음에 무엇이 쌓였나 */
export async function 묶음현황(b) {
  const 키 = 묶음키(b);
  const 줄 = (await 다읽는다()).filter((r) => r.묶음키 === 키);
  return {
    묶음키: 키,
    검토: 줄.filter((r) => r.type === '검토').map((r) => ({ 검토자: r.검토자, 판정: r.판정, 언제: r.at, 살았나: 살았나(r) })),
    대표승인: 줄.filter((r) => r.type === '대표승인').map((r) => ({ 문구: r.문구, 언제: r.at, 살았나: 살았나(r) })),
    긴급승인: 줄.filter((r) => r.type === '긴급승인').map((r) => ({ 문구: r.문구, 언제: r.at, 살았나: 살았나(r) })),
    실행: 줄.filter((r) => r.type === '실행전' || r.type === '실행후').map((r) => ({ type: r.type, 실행자: r.실행자, 길: r.길, 언제: r.at, 결과: r.결과 })),
  };
}
