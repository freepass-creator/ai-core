/** ★일하다 이상한 걸 보면 한 줄 남긴다. 고치려 들지 말고.
 *
 *  대표(2026-08-26): 「그리고 **하면서 오류를 너한테 남길 수 있어야지**」
 *
 *  ── 왜 필요한가
 *  AI 가 일하다 이상한 것을 본다 — 숫자가 두 곳에서 다르다, 매뉴얼대로 했는데 안 된다,
 *  자료가 있어야 할 자리에 없다. 그때 **고치려 들면 하던 일이 멈추고**, 그냥 넘어가면 **아무도 모른다.**
 *  ★한 줄 남기고 하던 일을 계속하는 것이 맞다.
 *
 *  ── 특히 «내가 틀린 것» 을 남겨라
 *  다음 AI 가 같은 실수를 안 하는 유일한 방법이다.
 *  2026-08-25 에 미수를 1억5천만원 많게 말했고, 2026-08-26 에 그 까닭을 알았다 —
 *  그 사이 아무 데도 안 적혀 있어서 하루를 잃었다.
 *
 *    node scripts/오류.mjs "무엇이 이상한가"
 *    node scripts/오류.mjs "…" --차=12가3456 --어디=수납탭 --누가=codex
 *    node scripts/오류.mjs                      쌓인 것 보기
 *    node scripts/오류.mjs --닫기=3 --왜="고침"   해결된 것 닫기
 */
import fs from 'node:fs';

const 인자 = process.argv.slice(2);
const 말 = 인자.filter((x) => !x.startsWith('--')).join(' ').trim();
const 값 = (k) => { const a = 인자.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : ''; };
const 이제 = () => new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 16).replace('T', ' ');

const 길 = 'docs/오류.md';
const 머리 = `# 오류 · 이상한 것 — AI 가 일하다 남긴 것

> 대표(2026-08-26): 「하면서 **오류를 너한테 남길 수 있어야지**」
>
> ★**일 시작 전에 한 번 훑어라.** 여기 있는 것을 또 겪지 마라.
> 고쳤으면 \`node scripts/오류.mjs --닫기=<번호> --왜="어떻게 고쳤나"\`
>
> 남기는 법: \`node scripts/오류.mjs "무엇이 이상한가" --차=… --어디=…\`

| # | 언제 | 누가 | 어디 | 무엇이 이상한가 | 상태 |
|---|---|---|---|---|---|
`;

if (!fs.existsSync(길)) fs.writeFileSync(길, 머리, 'utf8');
let 글 = fs.readFileSync(길, 'utf8');

// ── 닫기 ──
const 닫을것 = 값('닫기');
if (닫을것) {
  const 줄들 = 글.split('\n');
  let 됐나 = false;
  for (let i = 0; i < 줄들.length; i++) {
    if (!줄들[i].startsWith(`| ${닫을것} |`)) continue;
    const 칸 = 줄들[i].split('|');
    칸[6] = ` ★닫힘 ${이제().slice(0, 10)}${값('왜') ? ` — ${값('왜')}` : ''} `;
    줄들[i] = 칸.join('|');
    됐나 = true;
    break;
  }
  if (!됐나) { console.log(`${닫을것}번이 없다`); process.exit(1); }
  fs.writeFileSync(길, 줄들.join('\n'), 'utf8');
  console.log(`   ${닫을것}번 닫았다`);
  process.exit(0);
}

// ── 보기 ──
if (!말) {
  const 줄들 = 글.split('\n').filter((l) => /^\| \d+ \|/.test(l));
  const 열림 = 줄들.filter((l) => !/★닫힘/.test(l));
  console.log(`\n════ 오류 ${줄들.length}건 · ★안 닫힌 것 ${열림.length}건 ════\n`);
  if (!줄들.length) { console.log('   아직 없다'); process.exit(0); }
  for (const l of (열림.length ? 열림 : 줄들).slice(-15)) {
    const c = l.split('|').map((x) => x.trim());
    console.log(`   ${c[1].padStart(3)}  ${c[2]}  ${(c[3] || '?').padEnd(8)}${(c[4] || '').padEnd(12)}${c[5]}`);
  }
  console.log(`\n  → ${길}`);
  process.exit(0);
}

// ── 남기기 ──
const 번호 = (글.match(/^\| (\d+) \|/gm) ?? []).reduce((a, l) => Math.max(a, Number(l.match(/\d+/)[0])), 0) + 1;
const 줄 = `| ${번호} | ${이제()} | ${값('누가') || 'AI'} | ${값('어디') ||값('차') || ''} | ${말.replace(/\|/g, '·')}${값('차') && 값('어디') ? ` (${값('차')})` : ''} | 열림 |`;
fs.writeFileSync(길, 글.trimEnd() + '\n' + 줄 + '\n', 'utf8');
console.log(`   ${번호}번으로 남겼다 — ${길}`);
console.log('   ★고치려 들지 말고 하던 일을 계속해라');
