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
  const 상태규칙 = css
    .split('\n')
    .filter((line) => /\.ui-(chip|button|segmented|select-card)[^{]*(aria-pressed="true"|aria-selected="true"|input:checked)[^{]*\{/.test(line));
  assert.ok(상태규칙.length >= 4, `상태 선택자를 찾지 못했다 (${상태규칙.length})`);
  for (const line of 상태규칙) {
    assert.doesNotMatch(line, /border(-[a-z]+)?\s*:/, `상태를 테두리로 말한다: ${line.trim().slice(0, 90)}`);
    assert.doesNotMatch(line, /box-shadow\s*:/, `상태를 그림자로 말한다: ${line.trim().slice(0, 90)}`);
    /** ::before/::after 는 «표시 문자» 줄이라 면·글자 요구에서 뺀다 — 그것도 색이 아닌 신호다. */
    if (/::(before|after)/.test(line)) { assert.match(line, /content\s*:/, `표시 문자 줄이 비었다: ${line.trim().slice(0, 90)}`); continue; }
    assert.match(line, /background\s*:|color\s*:|font-weight\s*:/, `상태를 면·글자로 말해야 한다: ${line.trim().slice(0, 90)}`);
  }
  /** 예외는 살아 있어야 한다 — 키보드 포커스 윤곽선. */
  for (const sel of ['.ui-chip:focus-visible', '.ui-segmented > label:has(input:focus-visible)', '.ui-select-card:has(input:focus-visible)']) {
    assert.ok(css.includes(sel), `${sel} 의 focus-visible 윤곽선이 없다`);
  }
  /** 눌린 버튼이 보이는 이름에 글자를 덧붙이지 않는다(접근 이름 유지). */
  const 표시 = css.match(/\.ui-button\[aria-pressed="true"\]::before[^}]*content:\s*"([^"]*)"/)?.[1] ?? '';
  assert.ok(표시.trim().length > 0, '눌림 표시 문자가 없다');
  assert.doesNotMatch(표시, /[가-힣a-z]/i, `눌림 표시가 이름에 낱말을 덧붙인다: "${표시}" — 기호만 둔다`);
});
