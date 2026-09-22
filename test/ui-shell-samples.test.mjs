// 기본 골격 샘플(모바일·웹)과 선택·눌림 상태 규격이 서로 어긋나지 못하게 한다.
//
// ★대표(2026-09-22): 「디자인 샘플이 없다 보니까 여기저기서 다 헤매고 그래 · 여기다가 디자인 정본 규격을
//   만들어 놓고 모바일은 이렇게 웹은 이렇게 기본 골격을 좀 만들어 놓으려고」
// ★샘플은 «보여 주는 사본» 이다. 값·규칙의 정본은 registry/ui-ux-features.json 과 design-system/ 이다.
//   그래서 샘플이 정본과 달라지면 여기서 빨강이 된다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));

const features = json('registry/ui-ux-features.json');
const byId = new Map(features.features.map((f) => [f.id, f]));
const mobile = read('examples/ui-shell-mobile.html');
const web = read('examples/ui-shell-web.html');
const css = read('design-system/runtime-v2.css');

/** CSS 를 «규칙 덩어리» 로 읽는다 — 한 규칙이 여러 줄에 걸쳐도 같은 답이 나오게. */
const 규칙들 = (본문) => 본문
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('}')
  .map((덩어리) => ({ 선택자: 덩어리.split('{')[0] ?? '', 본문: 덩어리.split('{').slice(1).join('{') }))
  .filter(({ 본문 }) => 본문.trim());

/** 이 선택자가 «자기 이름으로» 들어 있는 규칙만 고른다(.ui-input 이 .ui-input-x 를 물지 않게). */
const 규칙찾기 = (본문, 이름) => 규칙들(본문).filter(({ 선택자 }) => 선택자
  .split(',')
  .map((s) => s.trim())
  .some((s) => s === 이름 || s.startsWith(`${이름} `) || s.startsWith(`${이름}:`) || s.startsWith(`${이름}[`) || s.startsWith(`${이름}.`)));

test('선택·눌림 상태 넷이 정본 등록부에 있다 — 없으면 화면마다 새로 지어낸다', () => {
  for (const id of ['form.chip', 'action.toggle', 'navigation.segmented', 'data.select-card']) {
    const f = byId.get(id);
    assert.ok(f, `${id} 가 등록부에 없다`);
    assert.ok(f.required_states.includes('disabled') && f.required_states.includes('focus-visible'), `${id}: disabled·focus-visible 필수`);
    assert.ok(f.rules.some((r) => /colour|color/i.test(r)), `${id}: 「색만으로 말하지 않는다」 규칙이 있어야 한다`);
    assert.ok(f.adoption === 'REQUIRED');
  }
});

test('상호작용 계약이 색만으로 상태를 말하지 못하게 한다', () => {
  const rule = json('design-system/interaction.contract.json').rules.selection_state;
  assert.ok(rule, 'selection_state 규칙이 없다');
  assert.ok(rule.invariants.some((i) => /aria-pressed/.test(i) && /never by colour|colour or weight alone/i.test(i)));
  assert.ok(rule.verification.includes('state-not-colour-only'));
  for (const id of ['form.chip', 'action.toggle', 'navigation.segmented', 'data.select-card']) {
    assert.ok(rule.feature_refs.includes(id), `${id} 가 규칙에 안 걸려 있다`);
  }
  /** 계약 스키마도 이 규칙을 요구해야 한다 — 아니면 조용히 빠져도 아무도 모른다. */
  const schema = json('contracts/ui-interaction-contract.schema.json');
  assert.ok(schema.properties.rules.required.includes('selection_state'));
});

test('★샘플이 상태를 «색만으로» 말하지 않는다 — 모든 선택 요소에 상태 속성이 있다', () => {
  for (const [이름, html] of [['모바일', mobile], ['웹', web]]) {
    const chips = html.match(/<button[^>]*class="ui-chip"[^>]*>/g) ?? [];
    assert.ok(chips.length >= 3, `${이름}: 칩 샘플이 있어야 한다`);
    for (const chip of chips) assert.match(chip, /aria-pressed="(true|false)"/, `${이름}: 칩에 aria-pressed 가 없다 — ${chip}`);
    assert.ok(chips.some((c) => /aria-pressed="true"/.test(c)) && chips.some((c) => /aria-pressed="false"/.test(c)),
      `${이름}: 선택됨·선택 안 됨 두 상태를 같이 보여 줘야 한다`);
    const toggle = html.match(/<button[^>]*class="ui-button[^"]*"[^>]*aria-pressed[^>]*>/g) ?? [];
    assert.ok(toggle.length >= 1, `${이름}: 눌림 토글 샘플이 있어야 한다`);
    const segmented = html.match(/class="ui-segmented"[\s\S]*?<\/div>/)?.[0] ?? '';
    assert.match(segmented, /<input type="radio"[^>]*checked/, `${이름}: 구간 선택은 라디오로 상태를 말해야 한다`);
    const cards = html.match(/class="ui-select-card"[\s\S]*?<\/label>/g) ?? [];
    assert.ok(cards.length >= 2, `${이름}: 선택 카드 샘플이 있어야 한다`);
    for (const card of cards) assert.match(card, /<input type="(radio|checkbox)"/, `${이름}: 카드가 실제 선택 컨트롤을 품어야 한다`);
    assert.ok(cards.some((c) => /disabled/.test(c)), `${이름}: 고를 수 없는 상태도 보여 줘야 한다`);
  }
});

test('모바일 골격이 적응형 웹 표준 0절 그대로다 — 위 맥락 · 가운데 내용 · 아래 동작(3:7 · 3:3:4)', () => {
  assert.match(mobile, /class="ui-shell ui-shell-mobile"/);
  assert.match(mobile, /class="ui-appbar"/, '위: 제목·맥락');
  assert.match(mobile, /class="ui-shell-body"/, '가운데: 일 내용');
  assert.match(mobile, /class="ui-bottom-actions" data-actions="2"/, '아래: 동작 막대');
  assert.match(mobile, /data-actions="3"/, '동작 3개(3:3:4) 예시도 같이 둔다');
  assert.doesNotMatch(mobile.split('<main')[0], /class="ui-button"[^>]*>(?:(?!뒤로)[^<])*저장/, '머리에 작업 버튼을 두지 않는다');
  assert.match(css, /\.ui-bottom-actions\[data-actions="2"\][^}]*3fr 7fr/, 'CSS 3:7');
  assert.match(css, /\.ui-bottom-actions\[data-actions="3"\][^}]*3fr 3fr 4fr/, 'CSS 3:3:4');
  assert.match(css, /env\(safe-area-inset-bottom\)/, 'safe-area');
});

test('웹 골격이 같은 업무를 폭에 맞춰 편 것이다 — 패널 구성과 같은 명령', () => {
  assert.match(web, /class="ui-shell ui-shell-web"/);
  assert.match(web, /class="ui-toolbar"/, '데스크톱 유틸리티 도구줄');
  assert.match(web, /class="ui-shell-panels" data-panels="3"/, '목록 + 상세 + 보조');
  assert.equal((web.match(/class="ui-panel"/g) ?? []).length + (web.match(/class="ui-panel" aria-labelledby/g) ?? []).length >= 2, true);
  for (const 명령 of ['임시 저장', '검토 완료']) {
    assert.ok(mobile.includes(명령.replace('임시 저장', '임시 저장')) || mobile.includes(명령), `모바일에도 같은 명령(${명령})이 있어야 한다`);
    assert.ok(web.includes(명령), `웹에도 같은 명령(${명령})이 있어야 한다`);
  }
  assert.match(css, /@media \(max-width: 900px\)[^}]*\.ui-shell-panels/, '좁아지면 한 줄로 접힌다');
});

test('골격 화면 명세의 기능 id 는 전부 등록부에 있다 — 지어낸 id 를 못 쓴다', () => {
  for (const p of ['examples/ui-shell-mobile.manifest.json', 'examples/ui-shell-web.manifest.json']) {
    const m = json(p);
    assert.equal(m.contract, 'ai-core-ui-screen-manifest/v1');
    assert.ok(m.feature_ids.length >= 5, `${p}: 기능 id 가 너무 적다`);
    for (const id of m.feature_ids) assert.ok(byId.has(id), `${p}: 등록부에 없는 id ${id}`);
  }
});

test('골격은 값을 따로 정하지 않는다 — 샘플 안에 색·치수 하드코딩이 없다', () => {
  for (const [이름, html] of [['모바일', mobile], ['웹', web]]) {
    assert.doesNotMatch(html, /<style[\s>]/, `${이름}: 샘플 안에서 스타일을 새로 정의하지 않는다`);
    assert.doesNotMatch(html, /style="/, `${이름}: 인라인 스타일 금지`);
    assert.doesNotMatch(html, /#[0-9a-fA-F]{6}\b/, `${이름}: 색 하드코딩 금지 — 토큰을 쓴다`);
    assert.match(html, /design-system\/tokens\.css/, `${이름}: 토큰 정본을 읽어야 한다`);
    assert.match(html, /design-system\/components\.css/, `${이름}: 부품 정본을 읽어야 한다`);
    assert.match(html, /design-system\/runtime-v2\.css/, `${이름}: 골격·상태 스타일(runtime v2)을 읽어야 한다`);
  }
});

test('★테두리 없는 컨트롤 — 상태를 테두리·그림자로 말하지 않는다 (FreePass 제품 프로필 4절)', () => {
  /** 상태 선택자(선택됨·눌림)에서 border/box-shadow 를 «상태 언어» 로 쓰면 빨강.
   *  focus-visible 윤곽선(outline)은 예외이고, 입력창·카드의 구조 테두리는 이 규칙 밖이다. */
  const 상태규칙 = 규칙들(css).filter(({ 선택자 }) =>
    /\.ui-(chip|button|segmented|select-card)/.test(선택자) &&
    /(aria-pressed="true"|aria-selected="true"|input:checked)/.test(선택자));
  assert.ok(상태규칙.length >= 4, `상태 선택자를 찾지 못했다 (${상태규칙.length})`);
  for (const { 선택자, 본문 } of 상태규칙) {
    assert.doesNotMatch(본문, /border(-[a-z]+)?\s*:/, `상태를 테두리로 말한다: ${선택자.trim().slice(0, 90)}`);
    assert.doesNotMatch(본문, /box-shadow\s*:/, `상태를 그림자로 말한다: ${선택자.trim().slice(0, 90)}`);
    /** ::before/::after 는 «표시» 규칙이다 — 루시드 마스크로 그린다(글자가 아니다). */
    if (/::(before|after)/.test(선택자)) {
      assert.match(본문, /content\s*:/, `표시 규칙이 비었다: ${선택자.trim().slice(0, 90)}`);
      assert.match(본문, /mask\s*:/, `표시를 루시드 마스크로 그려야 한다: ${선택자.trim().slice(0, 90)}`);
      continue;
    }
    assert.match(본문, /background\s*:|color\s*:|font-weight\s*:/, `상태를 면·글자로 말해야 한다: ${선택자.trim().slice(0, 90)}`);
  }
  /** 예외는 살아 있어야 한다 — 키보드 포커스 윤곽선. */
  for (const sel of ['.ui-chip:focus-visible', '.ui-segmented > label:has(input:focus-visible)', '.ui-select-card:has(input:focus-visible)']) {
    assert.ok(css.includes(sel), `${sel} 의 focus-visible 윤곽선이 없다`);
  }
  /** 눌린 버튼이 보이는 이름에 글자를 덧붙이지 않는다(접근 이름 유지) — 표시는 그림이지 낱말이 아니다. */
  const 눌림 = 규칙들(css).find(({ 선택자 }) => 선택자.includes('.ui-button[aria-pressed="true"]::before'));
  assert.ok(눌림, '눌림 표시 규칙이 없다');
  const 표시 = 눌림.본문.match(/content:\s*"([^"]*)"/)?.[1] ?? null;
  assert.equal(표시, '', '눌림 표시는 빈 content + 루시드 마스크다');
  assert.match(눌림.본문, /var\(--icon-check\)/, '눌림 표시가 루시드 체크를 쓰지 않는다');
});

test('★테두리 정책 — 값 넣는 자리만 선을 갖는다 (interaction.contract#border_policy)', () => {
  const rule = json('design-system/interaction.contract.json').rules.border_policy;
  assert.ok(rule, 'border_policy 규칙이 없다');
  assert.ok(json('contracts/ui-interaction-contract.schema.json').properties.rules.required.includes('border_policy'));
  assert.ok(rule.invariants.some((i) => /focus-visible/.test(i)), '포커스 윤곽선 예외가 규칙에 있어야 한다');
  assert.ok(rule.invariants.some((i) => /forced-colors/i.test(i)), '고대비 예외가 규칙에 있어야 한다');

  /** 최종 cascade 는 components.css + runtime-v2.css 다. 정책은 뒤에 실리는 runtime-v2 가 못 박는다. */
  const 선없음 = ['.ui-button', '.ui-icon-button', '.ui-link', '.ui-card', '.ui-panel', '.ui-alert', '.ui-dialog', '.ui-toast'];
  const 지움 = css.match(/^[^{@]*\{\s*\n?\s*border:\s*0;?\s*\}/m) ? css : css;
  for (const sel of 선없음) {
    const 규칙 = 지움.split('\n').find((line) => line.startsWith(sel + ',') || line.includes(sel + ',') || line.startsWith(sel + ' ') || line.startsWith(sel + ' {'));
    assert.ok(규칙, `${sel} 에 대한 정책 줄이 없다`);
  }
  assert.match(css, /\.ui-button[^{]*\{\s*$|\.ui-button[^}]*border:\s*0/m, '버튼의 테두리를 0 으로 못 박아야 한다');
  const 정책블록 = css.slice(css.indexOf('★테두리 정책'), css.indexOf('선택·눌림 상태와 기본 골격'));
  for (const sel of 선없음) assert.ok(정책블록.includes(sel), `${sel} 이 「테두리 없음」 목록에 없다`);
  /** 값을 넣는 자리의 선은 지우지 않는다 — 그것 말고는 「여기에 쓴다」를 말할 수단이 없다. */
  const 부품 = read('design-system/components.css');
  for (const sel of ['.ui-input', '.ui-select', '.ui-textarea']) {
    assert.ok(
      !규칙찾기(정책블록 + '}', sel).some(({ 본문 }) => /border:\s*0/.test(본문)),
      `${sel} 의 선을 지우면 안 된다`
    );
    assert.ok(규칙찾기(부품, sel).some(({ 본문 }) => /border:\s*1px/.test(본문)), `${sel} 은 선을 가져야 한다 — 값을 넣는 자리다`);
  }
});

test('★심플·미니멀 — 덜어내되 구분과 상태는 반드시 읽힌다 (interaction.contract#border_policy)', () => {
  const rule = json('design-system/interaction.contract.json').rules.border_policy;
  const 글 = rule.invariants.join(' ');
  assert.match(글, /minimal/i, '「최소로 쓴다」가 규칙 본문에 있어야 한다');
  assert.match(글, /distinguishab|readable|legible/i, '「그래도 구분된다」가 규칙 본문에 있어야 한다');
  assert.ok(rule.verification.includes('minimal-but-distinguishable'), '구분 가능 검증 항목이 있어야 한다');

  /** 덜어낸 자리는 반드시 «다른 신호»로 메운다 — 상태 선택자는 면/글자/표시 중 하나를 바꿔야 한다. */
  const 상태규칙 = 규칙들(css.slice(css.indexOf('선택·눌림 상태와 기본 골격')))
    .filter(({ 선택자 }) => /\.ui-/.test(선택자) && /(aria-pressed|aria-selected|:checked|disabled)/.test(선택자));
  assert.ok(상태규칙.length >= 4, `상태를 말하는 규칙이 ${상태규칙.length} 개뿐이다`);
  for (const { 선택자, 본문 } of 상태규칙) {
    assert.match(
      본문,
      /background|color|font-weight|mask|opacity/,
      `선을 안 쓰는 대신 무엇으로 상태를 말하는지가 없다: ${선택자.trim().slice(0, 60)}`
    );
  }
});

// ★대표(2026-09-23): 「아이콘이나 뭐 체크 이런 거는 루시드 아이콘으로 통일을 하고 그렇게 하자고」
//   — 한 벌만 쓴다. 기하 정본은 design-system/icons.lucide.json 이고, 마크업의 <svg> 와 CSS 마스크가
//     그 글자와 «똑같아야» 한다. 이모지·아이콘 폰트·제각각 글리프는 여기서 빨강이 된다.
const 아이콘 = json('design-system/icons.lucide.json');

test('★아이콘은 루시드 한 벌 — 정본 기하와 다르면 빨강 (interaction.contract#icon_policy)', () => {
  const rule = json('design-system/interaction.contract.json').rules.icon_policy;
  assert.ok(rule, 'icon_policy 규칙이 없다');
  assert.ok(json('contracts/ui-interaction-contract.schema.json').properties.rules.required.includes('icon_policy'));
  assert.equal(아이콘.contract, 'ai-core-icon-set/v1');
  assert.equal(아이콘.set.name, 'lucide');
  assert.equal(아이콘.set.license, 'ISC');
  assert.match(아이콘.set.attribution, /Lucide/, '재배포용 저작권 표기가 있어야 한다');
  assert.ok(Object.keys(아이콘.icons).length >= 10, '쓸 만큼은 기록해 둔다');

  const 기록 = new Set(Object.values(아이콘.icons).map((i) => i.svg_body));
  for (const [이름, 본문] of [['모바일', mobile], ['웹', web]]) {
    const svgs = [...본문.matchAll(/<svg class="ui-icon"[^>]*>([\s\S]*?)<\/svg>/g)].map((m) => m[1].trim());
    assert.ok(svgs.length >= 1, `${이름} 샘플에 루시드 아이콘이 하나도 없다`);
    for (const body of svgs) assert.ok(기록.has(body), `${이름} 샘플의 아이콘이 정본에 없다: ${body.slice(0, 48)}`);
    for (const svg of 본문.match(/<svg[^>]*>/g) ?? []) {
      assert.match(svg, /viewBox="0 0 24 24"/, '루시드 좌표계(24)를 벗어난 svg 가 있다');
      assert.match(svg, /stroke="currentColor"/, '아이콘 색은 글자색을 따라야 한다');
      assert.match(svg, /aria-hidden="true"/, '장식 아이콘은 보조기기에서 숨긴다');
    }
  }

  /** CSS 가 만드는 표시도 같은 기하다 — 글자(✓)가 아니라 마스크다. */
  const 체크 = 아이콘.icons.check.svg_body.match(/d="([^"]+)"/)[1];
  assert.ok(css.includes('--icon-check'), '체크 마스크 토큰이 없다');
  assert.ok(css.includes(encodeURIComponent(체크).replaceAll('%20', ' ')) || css.includes(체크), '마스크가 정본 기하를 쓰지 않는다');
  for (const 자리 of [/\.ui-chip\[aria-pressed="true"\]::before[\s\S]*?\}/, /\.ui-button\[aria-pressed="true"\]::before[\s\S]*?\}/]) {
    const 덩어리 = css.match(자리)?.[0] ?? '';
    assert.match(덩어리, /var\(--icon-check\)/, `표시가 루시드 마스크를 쓰지 않는다: ${덩어리.slice(0, 40)}`);
  }

  /** 이모지·손글리프 금지 — 정본 CSS 와 두 샘플 전부. */
  /** 주석의 ★ 는 글 표시라 센다고 치지 않는다 — 화면에 그려지는 것만 본다. */
  const 주석뺀 = (본문) => 본문.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const [이름, 본문] of [['runtime-v2.css', css], ['모바일', mobile], ['웹', web]]) {
    assert.doesNotMatch(주석뺀(본문), /[✓✔✗✘×●◆▶►☑☒]/u, `${이름} 에 루시드 밖 글리프가 있다`);
  }
});

test('★박스도 선 없이 간다 — 값 놓는 자리만 남긴다 (대표 2026-09-23)', () => {
  for (const sel of ['.ui-select-card', '.ui-badge', '.ui-document-preview']) {
    const 덩어리 = 규칙찾기(css, sel);
    assert.ok(덩어리.length, `${sel} 규칙이 없다`);
    assert.ok(덩어리.some(({ 본문 }) => /border:\s*0/.test(본문)), `${sel} 의 선을 지워야 한다 — 박스다`);
    assert.ok(!덩어리.some(({ 본문 }) => /border:\s*1px/.test(본문)), `${sel} 에 아직 선이 남아 있다`);
  }
  /** 파일 놓는 자리는 예외 — 「여기에 떨군다」를 말할 다른 수단이 없다. */
  assert.match(css, /\.ui-file-upload[\s\S]{0,400}border:\s*1px dashed/, '파일 드롭 자리의 점선은 남긴다');
});
