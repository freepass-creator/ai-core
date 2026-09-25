#!/usr/bin/env node
// 면(surface) 단계를 «재는» 도구다. 선을 걷어냈으면 면 차이가 규격이어야 하고, 규격이면 숫자여야 한다.
//
// ★대표(2026-09-23): 「박스 선을 걷어낼 거면 그 페이지 면색이랑 박스 색이랑 구분을 줘야 될 것 같고,
//   지금 UI UX 기본 틀을 잡는 건데 너무 짧은 휘발성으로 생각하지 말고 제대로 만들어야 된다」
//
// 재는 값: WCAG 2.2 상대 명도 대비(1.4.3 글자 4.5:1 · 1.4.11 비문자 3:1).
//   node scripts/measure-surface-contrast.mjs           — 재서 표로 보여 주고, 미달이면 1 로 끝난다
//   node scripts/measure-surface-contrast.mjs --write   — 실측 영수증(docs/evidence/SURFACE-CONTRAST.json)을 다시 쓴다
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const 토큰 = () => JSON.parse(readFileSync(resolve(root, 'design-system/tokens.json'), 'utf8')).css_variables;

/** WCAG 2.2 relative luminance. 16진 색만 받는다 — 반투명(scrim)은 아래 색에 얹어서 따로 잰다. */
export const 명도 = (hex) => {
  const 값 = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * 값[0] + 0.7152 * 값[1] + 0.0722 * 값[2];
};

export const 대비 = (a, b) => {
  const [밝음, 어둠] = [명도(a), 명도(b)].sort((x, y) => y - x);
  return Number(((밝음 + 0.05) / (어둠 + 0.05)).toFixed(3));
};

/** 반투명 층(호버·누름)을 아래 면에 얹었을 때 «실제로 보이는» 색. 상태 사다리는 이 색으로 재야 한다. */
export const 겹침 = (아래, 층) => {
  const [r, g, b, a] = 층.replace(/rgba?\(|\)/g, '').split(',').map((v) => Number(v.trim()));
  const 밑 = 아래.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
  return '#' + [r, g, b].map((v, i) => Math.round(밑[i] * (1 - a) + v * a).toString(16).padStart(2, '0')).join('');
};

/** 상태 사다리 — 일반 → 호버 → 선택 → 선택+호버. 각 칸이 «앞 칸과 다르게» 보여야 한다.
 *  대표 2026-09-23: 「살짝만 이게 박스구나 할 정도, 선택되면 확실하게 더 은은하게,
 *  호버로 선택됐을 때와 커서 갔다 됐을 때랑 좀 달라야 한다」 */
export const 사다리 = (변수 = 토큰()) => {
  const 일반 = 변수['color-surface-subtle'];
  const 선택 = 변수['color-selected-surface'];
  return [
    { id: 'rest_hint_on_surface', a: 일반, b: 변수['color-surface'], min: 1.05,
      why: '흰 면 위에서 「아, 박스구나」 정도만 — 회색으로 내리지 않는다. v1.1(대표 2026-09-25 「v1.1로 하나로」) 면 #F7F9FC 는 1.055 — 한 톤 낮은 면만으로 가른다' },
    { id: 'hover_over_rest', a: 겹침(일반, 변수['color-hover-layer']), b: 일반, min: 1.1,
      why: '커서를 올리면 일반보다 또렷해진다' },
    { id: 'selected_over_rest', a: 선택, b: 일반, min: 1.07,
      why: '선택은 확실하되 은은하게 — 그리고 호버와 «다른 축»(중립 층 vs 파란 면)이다. v1.1 면 차이는 1.075 로 작으므로 굵기 · 체크(또는 Primary 글자)가 반드시 함께 바뀐다(색 하나로 말하지 않는다)' },
    { id: 'selected_hover_over_selected', a: 겹침(선택, 변수['color-hover-layer']), b: 선택, min: 1.1,
      why: '이미 선택된 것에 커서를 올린 것과 그냥 선택된 것이 달라야 한다' },
    { id: 'selected_text', a: 변수['color-primary-hover'], b: 선택, min: 4.5,
      why: '선택된 카드의 글자 (WCAG 1.4.3)' },
    { id: 'disabled_over_rest', a: 변수['color-disabled-surface'], b: 일반, min: 1.04,
      why: '못 쓰는 것은 면과 글자 둘 다로 말한다(면 차이만으로는 약하다)' }
  ];
};

/** 재는 짝. min 은 «무엇 때문에» 필요한지까지 적는다 — 숫자만 있으면 다음 사람이 못 고친다. */
export const 짝들 = [
  { id: 'surface_on_canvas', a: 'color-surface', b: 'color-bg', min: 1.08,
    why: '선이 없으니 카드·패널이 바탕에서 떨어져 보여야 한다 (박스를 박스로 알아본다). v1.1(대표 2026-09-25) 바탕 #F2F6FC 는 1.085 — 면 차이는 옅게, 경계는 기본 그림자(shadow-sm = erp elevation-base)가 함께 진다. 그림자가 빠지면 이 값으로는 모자란다' },
  { id: 'sunken_on_surface', a: 'color-surface-sunken', b: 'color-surface', min: 1.12,
    why: '면 위의 우묵한 자리(칩 기본·표 머리·트랙)가 면과 갈라져야 한다' },
  { id: 'selected_on_surface', a: 'color-selected-surface', b: 'color-surface', min: 1.12,
    why: '선택된 것이 면 위에서 보여야 한다' },
  { id: 'selected_on_rest', a: 'color-selected-surface', b: 'color-surface-sunken', min: 1.03,
    why: '선택과 비선택의 면 차이. 작으므로 굵기·루시드 체크가 반드시 함께 바뀐다(색 하나로 말하지 않는다)' },
  { id: 'text_on_canvas', a: 'color-text', b: 'color-bg', min: 4.5, why: 'WCAG 1.4.3 본문' },
  { id: 'text_on_surface', a: 'color-text', b: 'color-surface', min: 4.5, why: 'WCAG 1.4.3 본문' },
  { id: 'text_on_sunken', a: 'color-text', b: 'color-surface-sunken', min: 4.5, why: 'WCAG 1.4.3 본문' },
  { id: 'muted_on_canvas', a: 'color-muted', b: 'color-bg', min: 4.5, why: '보조 글자도 본문 기준을 지킨다' },
  { id: 'muted_on_surface', a: 'color-muted', b: 'color-surface', min: 4.5, why: '보조 글자도 본문 기준을 지킨다' },
  { id: 'muted_on_sunken', a: 'color-muted', b: 'color-surface-sunken', min: 4.5, why: '보조 글자도 본문 기준을 지킨다' },
  { id: 'primary_text_on_selected', a: 'color-primary-hover', b: 'color-selected-surface', min: 4.5,
    why: '선택된 칩·카드의 글자 — 선택 면이 깊어지면 기본 파랑(4.40)으로는 모자라 한 단 진한 파랑을 쓴다' },
  { id: 'focus_on_canvas', a: 'color-focus', b: 'color-bg', min: 3, why: 'WCAG 1.4.11 — 포커스 링은 어디에 놓여도 보여야 한다' },
  { id: 'focus_on_surface', a: 'color-focus', b: 'color-surface', min: 3, why: 'WCAG 1.4.11' },
  { id: 'focus_on_sunken', a: 'color-focus', b: 'color-surface-sunken', min: 3, why: 'WCAG 1.4.11' },
  { id: 'focus_on_selected', a: 'color-focus', b: 'color-selected-surface', min: 3, why: 'WCAG 1.4.11' },
  { id: 'primary_action_on_surface', a: 'color-primary', b: 'color-surface', min: 3,
    why: 'WCAG 1.4.11 — 테두리 없는 기본 버튼은 제 면으로 «컨트롤임»을 말한다' },
  { id: 'primary_action_on_canvas', a: 'color-primary', b: 'color-bg', min: 3, why: 'WCAG 1.4.11' }
];

export function 재다(변수 = 토큰()) {
  /** 토큰 이름으로 적힌 짝과, 이미 «색»으로 계산된 사다리 칸을 한 표에서 잰다. */
  const 전부 = [...짝들, ...사다리(변수).map((칸) => ({ ...칸, 색직접: true }))];
  const 결과 = 전부.map((짝) => {
    const [앞, 뒤] = 짝.색직접 ? [짝.a, 짝.b] : [변수[짝.a], 변수[짝.b]];
    if (!앞 || !뒤) return { ...짝, ratio: null, pass: false, note: 'TOKEN_MISSING' };
    const ratio = 대비(앞, 뒤);
    return { ...짝, colors: [앞, 뒤], ratio, pass: ratio >= 짝.min };
  });
  return { 결과, 미달: 결과.filter((r) => !r.pass) };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const { 결과, 미달 } = 재다();
  for (const r of 결과) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id.padEnd(26)} ${String(r.ratio).padStart(7)} (>= ${r.min})  ${(r.colors ?? []).join(' / ')}`);
  }
  if (process.argv.includes('--write')) {
    const 영수증 = {
      receipt_id: 'SURFACE-CONTRAST-001',
      contract: 'ai-core-measured-evidence/v1',
      kind: 'MEASURED',
      measured_at: new Date().toISOString(),
      method: 'WCAG 2.2 relative luminance contrast computed from design-system/tokens.json by scripts/measure-surface-contrast.mjs',
      source: 'design-system/tokens.json',
      pairs: 결과.map(({ id, a, b, colors, ratio, min, pass, why }) => ({ id, a, b, colors, ratio, min, pass, why })),
      result: 미달.length ? 'FAIL' : 'PASS'
    };
    writeFileSync(resolve(root, 'docs/evidence/SURFACE-CONTRAST.json'), JSON.stringify(영수증, null, 2) + '\n');
    console.log('wrote docs/evidence/SURFACE-CONTRAST.json');
  }
  console.log(미달.length ? `FAIL: ${미달.length} pair(s) below the floor` : `PASS: ${결과.length} measured pairs`);
  process.exit(미달.length ? 1 : 0);
}
