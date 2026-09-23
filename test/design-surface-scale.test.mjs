// 면(surface) 단계가 «숫자로» 유지되는지 지킨다.
//
// ★대표(2026-09-23): 「박스 선을 걷어낼 거면 그 페이지 면색이랑 박스 색이랑 구분을 줘야 될 것 같고 ...
//   너무 짧은 휘발성으로 생각하지 말고 제대로 만들어야 된다」
// 선을 없앤 화면에서 «박스를 박스로 알아보는 일»은 면 대비가 대신한다. 그래서 대비는 취향이 아니라 측정값이고,
// 측정값은 여기서 다시 계산해 영수증과 맞춰 본다 — 토큰을 눈대중으로 고치면 이 검사가 먼저 빨개진다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { 재다, 대비, 짝들, 토큰 } from '../scripts/measure-surface-contrast.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));

test('면 단계 토큰이 정본에 있다 — 바탕 / 면 / 우묵한 면 / 선택된 면 / 가림막', () => {
  const t = 토큰();
  for (const 이름 of ['color-bg', 'color-surface', 'color-surface-sunken', 'color-selected-surface', 'color-scrim']) {
    assert.ok(t[이름], `${이름} 이 tokens.json 에 없다`);
  }
  /** 투영본(런타임 CSS)이 정본과 어긋나면 화면이 다른 값을 쓴다. */
  const css = read('design-system/tokens.runtime.css');
  for (const [k, v] of Object.entries(t)) assert.ok(css.includes(`--${k}: ${v};`), `투영 누락: --${k}`);
});

test('★면 대비가 바닥을 지킨다 — 17 짝 전부 다시 계산해서 확인한다', () => {
  const { 결과, 미달 } = 재다();
  assert.equal(미달.length, 0, `바닥 아래로 내려간 짝: ${미달.map((r) => `${r.id} ${r.ratio}<${r.min}`).join(', ')}`);
  assert.ok(결과.length >= 17, `재는 짝이 ${결과.length} 개뿐이다`);

  /** 영수증은 «잰 것»이어야 한다 — 지금 토큰으로 다시 계산한 값과 같아야 통과한다(묵은 영수증 금지). */
  const 영수증 = json('docs/evidence/SURFACE-CONTRAST.json');
  assert.equal(영수증.kind, 'MEASURED');
  assert.equal(영수증.result, 'PASS');
  const 지금 = new Map(결과.map((r) => [r.id, r.ratio]));
  for (const 짝 of 영수증.pairs) {
    assert.equal(짝.ratio, 지금.get(짝.id), `${짝.id}: 영수증 ${짝.ratio} ≠ 지금 ${지금.get(짝.id)} — 다시 재서 --write 해야 한다`);
  }
  assert.equal(영수증.pairs.length, 결과.length, '영수증이 재는 짝을 다 담지 않았다');
});

test('선을 걷어낸 자리를 «면»이 대신하고 있다 — 규칙이 새 토큰을 실제로 쓴다', () => {
  const css = read('design-system/runtime-v2.css');
  assert.match(css, /\.ui-chip \{[^}]*background: var\(--color-surface-sunken\)/, '칩 기본 면이 우묵한 면이어야 한다');
  assert.match(css, /\.ui-chip\[aria-pressed="true"\][^{]*\{[^}]*var\(--color-selected-surface\)/, '선택된 칩이 선택 면을 써야 한다');
  assert.match(css, /\.ui-select-card:has\(input:checked\) \{[^}]*var\(--color-selected-surface\)/, '선택된 카드가 선택 면을 써야 한다');
  assert.match(css, /::backdrop[\s\S]{0,80}var\(--color-scrim\)/, '겹친 면은 가림막으로 갈라야 한다');
  /** 선택을 «색만으로» 말하지 않는다 — 면 차이가 작은 짝이므로 굵기와 루시드 체크가 함께 바뀌어야 한다. */
  const 선택칩 = css.match(/\.ui-chip\[aria-pressed="true"\], \.ui-chip\[aria-selected="true"\] \{[^}]*\}/)?.[0] ?? '';
  assert.match(선택칩, /font-weight: 700/, '선택된 칩은 굵기도 바뀌어야 한다');
  const 얇은짝 = 짝들.find((p) => p.id === 'selected_on_rest');
  assert.ok(얇은짝.min < 1.12, '이 짝은 면만으로는 약하다는 전제가 규격에 남아 있어야 한다');
  assert.match(얇은짝.why, /굵기|체크/, '약한 면 차이를 무엇이 받치는지 규격에 적혀 있어야 한다');
});

test('포커스 링은 어떤 면 위에서도 3:1 을 넘는다 (WCAG 1.4.11)', () => {
  const t = 토큰();
  for (const 면 of ['color-bg', 'color-surface', 'color-surface-sunken', 'color-selected-surface', 'color-disabled-surface', 'color-info-surface', 'color-error-surface']) {
    const 값 = 대비(t['color-focus'], t[면]);
    assert.ok(값 >= 3, `포커스 링이 ${면}(${t[면]}) 위에서 ${값} 이다 — 3:1 아래로 내려가면 안 된다`);
  }
});

test('포커스 링은 한 가지 토큰만 쓴다 — 부품마다 제 색을 쓰면 잰 값이 거짓말이 된다', () => {
  /** ★2026-09-23 실측에서 잡혔다: 전역 :focus-visible 은 --color-focus 인데 칩·구간선택·선택카드는
   *  각자 --color-primary 로 그리고 있었다. 그러면 「포커스 링 대비 3:1」이라는 측정이 화면과 어긋난다. */
  const css = read('design-system/runtime-v2.css') + read('design-system/tokens.runtime.css');
  for (const 줄 of css.split('\n').filter((l) => /focus-visible/.test(l) && /outline:/.test(l))) {
    assert.match(줄, /var\(--color-focus\)|Highlight/, `포커스 링이 정본 색을 안 쓴다: ${줄.trim().slice(0, 80)}`);
  }
});

test('★못 쓰는 상태를 «색 하나»로 말하지 않는다 — 상태 규칙은 신호를 둘 이상 바꾼다', () => {
  /** ★2026-09-23 자기점검에서 잡혔다: 칩·구간선택의 disabled 가 글자색만 바꾸고 있었다.
   *  선을 없앤 화면에서 색만 바꾸면 색각·저대비 환경에서 「못 쓰는 것」이 사라진다. */
  const css = read('design-system/runtime-v2.css');
  const 규칙 = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .map((덩어리) => ({ 선택자: (덩어리.split('{')[0] ?? '').trim(), 본문: 덩어리.split('{').slice(1).join('{') }))
    /** `:not(:disabled)` 는 «못 쓰는 상태»가 아니라 그 반대다 — 판정 전에 떼어 낸다. */
    .map((덩어리) => ({ ...덩어리, 판정: 덩어리.선택자.replaceAll(':not(:disabled)', '') }))
    .filter(({ 판정, 본문 }) => /\.ui-/.test(판정) && /:disabled|aria-disabled="true"/.test(판정) && 본문.trim())
    .filter(({ 선택자 }) => !/forced-colors/.test(선택자));
  assert.ok(규칙.length >= 3, `disabled 규칙이 ${규칙.length} 개뿐이다`);
  for (const { 선택자, 본문 } of 규칙) {
    const 신호 = ['background', 'color:', 'opacity', 'font-weight', 'content'].filter((k) => 본문.includes(k));
    assert.ok(신호.length >= 2, `${선택자.slice(0, 70)} — 신호가 ${신호.join(',') || '없음'} 뿐이다`);
  }
});

test('밖의 기준과 대조한 기록이 정본 옆에 남아 있다 — 「우리가 그렇게 정했다」는 근거가 아니다', () => {
  const 문서 = read('docs/design/TREND_AND_CONCEPT_REVIEW_2026-09-23.md');
  for (const 근거 of ['m3.material.io', 'developer.apple.com', 'fluentui', 'primer.style', 'w3.org/WAI/WCAG22', 'lucide.dev']) {
    assert.ok(문서.includes(근거), `대조 근거가 빠졌다: ${근거}`);
  }
  assert.match(문서, /UNVERIFIED/, '확인 못 한 것을 「없다」로 적지 않았는지');
  assert.match(read('docs/SCREEN_DESIGN_STANDARD.md'), /TREND_AND_CONCEPT_REVIEW/, '정본 문서가 대조 기록을 가리켜야 한다');

  /** 상태 층 불투명도는 M3 수치(hover .08 / pressed .10)에 맞춰 두었다 — 눈대중으로 되돌아가지 않게 고정한다. */
  const t = 토큰();
  assert.equal(t['color-hover-layer'], 'rgba(23, 32, 51, 0.08)');
  assert.equal(t['color-pressed-layer'], 'rgba(23, 32, 51, 0.10)');

  /** 보조 버튼은 흰 면 위의 흰 버튼이 아니다 — 우묵한 면(tonal)으로 읽힌다. */
  assert.match(
    read('design-system/runtime-v2.css'),
    /\.ui-button\.secondary \{[^}]*background: var\(--color-surface-sunken\)/,
    '보조 버튼이 제 면을 가져야 한다'
  );
});

test('★같은 면 위에 같은 면을 올리지 않는다 — 패널 «안»의 카드가 사라지면 안 된다', () => {
  /** ★2026-09-23 대표 실사용 지적: 「가운데 박스는 이렇게 있을 때는 저게 박스인지 뭔지 전혀 모르는데?」
   *  흰 패널 안의 흰 카드는 대비 1.00 이다. 바탕 위(1.16)에서만 읽히던 규칙이 패널 안에서 무너졌다. */
  const css = read('design-system/runtime-v2.css');
  assert.match(
    css,
    /:where\(\.ui-panel, \.ui-card\) \.ui-select-card \{[^}]*var\(--color-surface-sunken\)/,
    '패널 안의 카드는 면을 한 단 내려야 한다'
  );
  for (const 안쪽 of ['input:checked', 'input:disabled']) {
    assert.ok(
      css.includes(`:where(.ui-panel, .ui-card) .ui-select-card:has(${안쪽})`),
      `패널 안에서도 ${안쪽} 상태가 제 면을 가져야 한다`
    );
  }
  /** 한 단 내린 면이 실제로 바닥선을 넘는지 — 숫자로 확인한다. */
  const t = 토큰();
  assert.ok(대비(t['color-surface-sunken'], t['color-surface']) >= 1.12, '패널 안 카드가 패널과 안 갈라진다');
  assert.ok(대비(t['color-selected-surface'], t['color-surface']) >= 1.12, '선택된 카드가 패널과 안 갈라진다');
});
