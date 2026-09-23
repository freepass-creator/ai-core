#!/usr/bin/env node
// Claude v1 규격 검사기 — «임기응변이 아니라 규격»임을 기계가 증명한다.
//
// ★대표 2026-09-23: 「너무 막 만든 거 같다, 규격도 없이... 그냥 임기응변으로 한 거 같아.
//   어떤 규격과 컨셉이 있어야 하는데」 — 맞는 지적이었다. 그래서 순서를 뒤집었다:
//   값의 정본은 design/claude-v1/tokens.json 이고, CSS·화면은 «그 값만» 쓸 수 있다.
//   이 검사기가 어긋남을 잡는다. 통과하지 못하면 그건 규격이 아니라 취향이다.
//
//   node scripts/check-claude-v1.mjs
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const 토큰 = JSON.parse(read('design/claude-v1/tokens.json'));
// 정본 위에 얹는 화면 틀 CSS 도 같은 규격을 지켜야 한다 — 인자로 더 받는다.
//   node scripts/check-claude-v1.mjs examples/claude/startup-erp/erp-templates.css
const css = ['examples/claude/claude-v1.css', ...process.argv.slice(2)].map(read).join('\n');

const 탈락 = [];
const 통과 = [];
const 본다 = (조건, 이름, 메모 = '') => (조건 ? 통과 : 탈락).push(이름 + (메모 ? ` — ${메모}` : ''));

/** 주석을 뺀 CSS 를 규칙 덩어리로 읽는다 — 주석 속 문장은 규격이 아니다. */
const 본문 = css.replace(/\/\*[\s\S]*?\*\//g, '');
const 규칙들 = 본문.split('}').map((덩어리) => ({
  선택자: (덩어리.split('{')[0] ?? '').trim().replace(/\s+/g, ' '),
  선언: 덩어리.split('{').slice(1).join('{')
})).filter((r) => r.선언.trim());

/* ── 1. 글자 크기: 토큰 밖 값이 없어야 한다 ─────────────────────────────── */
const 허용크기 = new Set(토큰.type.scale.map((s) => `var(--${s.token})`));
const 쓰인크기 = [...본문.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
const 나쁜크기 = [...new Set(쓰인크기.filter((v) => !허용크기.has(v) && v !== 'inherit'))];
본다(나쁜크기.length === 0, '글자 크기는 일곱 단뿐', 나쁜크기.join(' / '));

/* ── 2. 모서리: 네 값뿐 ─────────────────────────────────────────────────── */
const 허용모서리 = new Set([...토큰.radius.values.map((r) => `var(--${r.token})`), '0', 'inherit']);
const 쓰인모서리 = [...본문.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim());
const 나쁜모서리 = [...new Set(쓰인모서리.filter((v) => !허용모서리.has(v)))];
본다(나쁜모서리.length === 0, '모서리는 네 값뿐', 나쁜모서리.join(' / '));

/* ── 3. 선: 값 넣는 자리와 읽기 위한 줄에만 ─────────────────────────────── */
const 선허용 = [
  '.c-input', '.c-select', '.c-area', '.c-search', '.c-drop',     // 값을 넣거나 떨구는 자리
  '.c-table th', '.c-table td', '.spec-table th', '.spec-table td' // 데이터를 읽기 위한 줄
];
const 선위반 = [];
for (const { 선택자, 선언 } of 규칙들) {
  const 선 = [...선언.matchAll(/border(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?(?:-(?:color|width|style))?\s*:\s*([^;]+);/g)]
    .map((m) => m[1].trim())
    .filter((v) => !/^0\b|transparent|none/.test(v));
  if (!선.length) continue;
  if (/forced-colors|prefers-contrast|::-webkit/.test(선택자)) continue;          // 접근성 예외
  if (선허용.some((s) => 선택자.includes(s))) continue;
  선위반.push(`${선택자.slice(0, 60)} { ${선.join(' ')} }`);
}
본다(선위반.length === 0, '선은 허용된 자리에만', 선위반.join(' | '));

/* ── 4. 그림자: 포커스 말고는 쓰지 않는다 ───────────────────────────────── */
const 그림자위반 = 규칙들
  .filter(({ 선택자, 선언 }) => /box-shadow:\s*(?!none)/.test(선언) && !/focus|forced-colors/.test(선택자))
  .map(({ 선택자, 선언 }) => `${선택자.slice(0, 50)} :: ${(선언.match(/box-shadow:\s*([^;]+);/) ?? [])[1] ?? ''}`);
본다(그림자위반.length === 0, '그림자 없음', 그림자위반.join(' | '));

/* ── 5. 색: 토큰 밖 색을 CSS 가 만들지 않는다 ───────────────────────────── */
const 색선언 = [...본문.matchAll(/(?:^|\s)(?:background|background-color|color|fill|stroke)\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
const 날색 = [...new Set(색선언.filter((v) => /#[0-9a-f]{3,8}\b|\brgba?\(/i.test(v) && !/var\(/.test(v)))];
본다(날색.length === 0, '색은 토큰만', 날색.join(' / '));

/* ── 6. 상태를 «색 하나»로 말하지 않는다 ────────────────────────────────── */
const 상태규칙 = 규칙들.filter(({ 선택자 }) =>
  /\[aria-(pressed|selected|current)="true"\]|:checked|:disabled/.test(선택자.replace(/:not\([^)]*\)/g, '')) &&
  !/forced-colors/.test(선택자));
/** ★검사기 자신의 허술함도 규격이다: 한 상태를 여러 규칙이 나눠 쓰면(면은 여기, 표시는 저기)
 *  규칙 하나만 보고 「신호가 하나뿐」이라 잡는 건 거짓 경보다. «부품 + 상태» 로 묶어서 센다. */
const 묶음키 = (sel) => sel
  .replace(/:has\((input:[a-z-]+)\)/g, ' $1')   // .c-pick:has(input:disabled) 과 .c-pick input:disabled 는 같은 상태다
  .replace(/::(before|after)/g, '')
  .replace(/\s*\+\s*\.[a-z-]+/g, '')
  .split(',')[0]
  .replace(/\s+\.[a-z-]+$/, '')
  .trim();
const 묶은상태 = new Map();
for (const r of 상태규칙) {
  const k = 묶음키(r.선택자);
  묶은상태.set(k, (묶은상태.get(k) ?? '') + r.선언);
}
const 한신호 = [...묶은상태.entries()]
  .map(([k, 선언]) => ({ k, 신호: ['background', 'color:', 'opacity', 'font-weight', 'mask', 'content', 'translate'].filter((s) => 선언.includes(s)) }))
  .filter((r) => r.신호.length < 2);
본다(한신호.length === 0, '상태는 신호 둘 이상', 한신호.map((r) => `${r.k} (${r.신호.join(',') || '없음'})`).join(' | '));

/* ── 7. 잰다: 대비 바닥선 ───────────────────────────────────────────────── */
const 값 = (이름, 모드 = 'light') => {
  for (const 묶음 of [토큰.color.surface, 토큰.color.text, 토큰.color.accent.tokens, 토큰.color.status.tokens, 토큰.color.status.wash, 토큰.color.line.tokens]) {
    const 찾음 = 묶음.find((t) => t.token === 이름);
    if (찾음) return 찾음[모드];
  }
  if (이름 === 'c-focus') return 토큰.color.focus[모드];
  return null;
};
const 명도 = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const 대비 = (a, b) => {
  const [밝, 어] = [명도(a), 명도(b)].sort((x, y) => y - x);
  return Number(((밝 + 0.05) / (어 + 0.05)).toFixed(2));
};
const 바닥 = 토큰.contrast_floors;
const 면들 = ['c-canvas', 'c-surface', 'c-row', 'c-row-selected', 'c-subtle'];
const 잰값 = [];
for (const 모드 of ['light', 'dark']) {
  for (const 면 of 면들) {
    for (const 글 of ['c-text', 'c-muted']) {
      const r = 대비(값(글, 모드), 값(면, 모드));
      잰값.push({ 모드, 짝: `${글} on ${면}`, r, 바닥: 바닥.text_on_any_surface });
    }
    const f = 대비(값('c-focus', 모드), 값(면, 모드));
    잰값.push({ 모드, 짝: `focus on ${면}`, r: f, 바닥: 바닥.focus_ring_on_any_surface });
    const p = 대비(값('c-accent', 모드), 값(면, 모드));
    잰값.push({ 모드, 짝: `accent on ${면}`, r: p, 바닥: 바닥.primary_action_on_any_surface });
  }
  잰값.push({ 모드, 짝: '목록 박스 on surface', r: 대비(값('c-row', 모드), 값('c-surface', 모드)), 바닥: 바닥.box_on_surface });
  잰값.push({ 모드, 짝: '고른 건 on 목록 박스', r: 대비(값('c-row-selected', 모드), 값('c-row', 모드)), 바닥: 바닥.state_step });
}
const 미달 = 잰값.filter((m) => m.r < m.바닥);
본다(미달.length === 0, `대비 ${잰값.length} 짝이 바닥선을 넘는다`, 미달.map((m) => `${m.모드} ${m.짝} ${m.r}<${m.바닥}`).join(' | '));

/* ── 8. 금지 목록이 문서에 살아 있는지 ──────────────────────────────────── */
본다(토큰.prohibited.length >= 5, '금지 목록이 규격에 적혀 있다');
본다(/Pretendard/.test(css) && /@import|@font-face/.test(css), '활자를 실제로 불러온다');

/* ── 결과 ───────────────────────────────────────────────────────────────── */
for (const 줄 of 통과) console.log('PASS ' + 줄);
for (const 줄 of 탈락) console.log('FAIL ' + 줄);
console.log(탈락.length ? `\nFAIL: ${탈락.length}개 항목이 규격을 벗어났다` : `\nPASS: ${통과.length}개 항목 전부 규격대로다`);
process.exit(탈락.length ? 1 : 0);
