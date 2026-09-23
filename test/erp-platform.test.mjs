import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../examples/erp-platform/erp-engine.js';
import { validateErpPlatform, CSS_FILES } from '../scripts/validate-erp-platform.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const spec = JSON.parse(read('examples/erp-platform/erp.spec.json'));
const seed = JSON.parse(read('examples/erp-platform/erp.seed.json'));
const css = CSS_FILES.map(read).join('\n');
const fresh = () => E.createStore(spec, seed);
const meta = { by: '테스트', at: '2026-09-23' };

test('명세·시안 데이터·배치 CSS 가 규격을 통과한다', () => {
  assert.deepEqual(validateErpPlatform(spec, seed, css), []);
});

test('계산: 품목 줄 → 공급가액·부가세·합계', () => {
  const ent = E.entityOf(spec, 'sales_order');
  const r = E.computeRecord(spec, ent, E.find(fresh(), 'sales_order', 'SO-202609-0002'));
  assert.equal(r.supply, 400 * 12000 + 200 * 1800);
  assert.equal(r.vat, Math.round(r.supply * 0.1));
  assert.equal(r.total, r.supply + r.vat);
});

test('권한: 담당자는 결재 대기 수주를 승인할 수 없고, 팀장은 할 수 있다', () => {
  const ent = E.entityOf(spec, 'sales_order');
  const rec = E.find(fresh(), 'sales_order', 'SO-202609-0003');
  assert.equal(E.transitionsFor(spec, ent, rec, 'staff').some((t) => t.id === 'approve'), false);
  assert.equal(E.transitionsFor(spec, ent, rec, 'manager').some((t) => t.id === 'approve'), true);
  const s = fresh();
  assert.equal(E.applyTransition(s, 'sales_order', 'SO-202609-0003', 'approve', { role: 'staff', ...meta }).ok, false);
  const ok = E.applyTransition(s, 'sales_order', 'SO-202609-0003', 'approve', { role: 'manager', ...meta });
  assert.equal(ok.ok, true);
  assert.equal(E.find(s, 'sales_order', 'SO-202609-0003').status, 'approved');
  assert.match(E.find(s, 'sales_order', 'SO-202609-0003').history.at(-1).what, /승인/);
});

test('가드: 차대변이 안 맞는 전표는 승인 요청이 막히고 이유를 말한다', () => {
  const s = fresh();
  const ent = E.entityOf(spec, 'journal');
  const t = E.transitionsFor(spec, ent, E.find(s, 'journal', 'JV-202609-0003'), 'finance').find((x) => x.id === 'submit');
  assert.match(t.blocked, /차변 45,000 ≠ 대변 40,000/);
  assert.equal(E.applyTransition(s, 'journal', 'JV-202609-0003', 'submit', { role: 'finance', ...meta }).ok, false);
});

test('반려는 사유가 없으면 안 된다', () => {
  const s = fresh();
  assert.equal(E.applyTransition(s, 'leave', 'LV-202609-0002', 'reject', { role: 'manager', ...meta }).error, '사유를 적어 주세요');
  assert.equal(E.applyTransition(s, 'leave', 'LV-202609-0002', 'reject', { role: 'manager', comment: '마감 주간', ...meta }).ok, true);
});

test('효과: 입고는 재고를 늘리고, 출고는 모자라면 통째로 막는다(반쯤 반영 없음)', () => {
  const s = fresh();
  const before = E.find(s, 'item', 'I-0002').stock;
  assert.equal(E.applyTransition(s, 'purchase_order', 'PO-202609-0002', 'receive', { role: 'staff', ...meta }).ok, true);
  assert.equal(E.find(s, 'item', 'I-0002').stock, before + 60);

  const s2 = fresh();
  E.find(s2, 'sales_order', 'SO-202609-0004').status = 'approved';
  const i5 = E.find(s2, 'item', 'I-0005').stock;
  E.find(s2, 'item', 'I-0002').stock = 3; // 둘째 줄이 모자라다
  const res = E.applyTransition(s2, 'sales_order', 'SO-202609-0004', 'ship', { role: 'staff', ...meta });
  assert.equal(res.ok, false);
  assert.match(res.error, /모자랍니다/);
  assert.equal(E.find(s2, 'item', 'I-0005').stock, i5, '첫 줄도 반영되지 않아야 한다');
  assert.equal(E.find(s2, 'sales_order', 'SO-202609-0004').status, 'approved');
});

test('휴가 승인은 남은 연차를 깎는다', () => {
  const s = fresh();
  E.applyTransition(s, 'leave', 'LV-202609-0003', 'approve', { role: 'manager', ...meta });
  assert.equal(E.find(s, 'employee', 'E-0005').leave_left, 13.5);
});

test('채번·입력 검증·등록', () => {
  const s = fresh();
  const bad = E.createRecord(s, 'customer', { code: 'C-0001', name: '', biz_no: '12-3', grade: 'Z' }, meta);
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['biz_no', 'code', 'grade', 'name']);
  const po = E.createRecord(s, 'purchase_order', { vendor: 'V-0002', date: '2026-09-23', due: '2026-10-01', warehouse: '본사 창고', lines: [{ item: 'I-0002', qty: 10, price: 41000 }] }, meta);
  assert.equal(po.ok, true);
  assert.equal(po.record.no, 'PO-202609-0005');
  assert.equal(po.record.status, 'draft');
  const oct = E.createRecord(s, 'purchase_order', { vendor: 'V-0002', date: '2026-10-02', due: '2026-10-09', warehouse: '본사 창고', lines: [] }, meta);
  assert.equal(oct.record.no, 'PO-202610-0001');
});

test('원장: 확정한 입출고와 전기한 전표는 고칠 수 없다', () => {
  const s = fresh();
  assert.equal(E.canEdit(spec, E.entityOf(spec, 'stock_move'), E.find(s, 'stock_move', 'SM-202609-0001')), false);
  assert.equal(E.canEdit(spec, E.entityOf(spec, 'journal'), E.find(s, 'journal', 'JV-202609-0001')), false);
  assert.equal(E.updateRecord(s, 'journal', 'JV-202609-0001', { summary: 'x' }, meta).ok, false);
});

test('결재함과 지표는 역할에 따라 달라진다', () => {
  const s = fresh();
  const mgr = E.approvalsFor(s, 'manager').map((a) => a.rec.id);
  const fin = E.approvalsFor(s, 'finance').map((a) => a.rec.id);
  assert.ok(mgr.includes('SO-202609-0003') && !mgr.includes('JV-202609-0002'));
  assert.deepEqual(fin, ['JV-202609-0002']);
  const low = spec.dashboard.metrics.find((m) => m.id === 'low_stock');
  assert.equal(E.metricValue(s, low, 'manager'), 3);
});

test('차트 자료: 빈 달도 0 으로 남기고, 진행 중 파이프라인과 재고 대비를 낸다', () => {
  const s = fresh();
  const [trend, pipe, stock] = spec.dashboard.charts;
  const series = E.monthlySeries(s, trend);
  assert.deepEqual(series.map((x) => x.month), ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  assert.equal(series.at(-1).value, 5676000 + 10340000);
  const d = structuredClone(seed); d.records.sales_order = d.records.sales_order.filter((r) => !r.date.startsWith('2026-05'));
  assert.equal(E.monthlySeries(E.createStore(spec, d), trend)[2].value, 0);
  assert.equal(E.stateBreakdown(s, pipe).find((x) => x.state.id === 'submitted').count, 2);
  assert.deepEqual(E.targetSeries(s, stock).filter((x) => x.below).map((x) => x.id), ['I-0002', 'I-0004', 'I-0006']);
});

test('제안: 안전재고 미달 품목 → 최근 발주를 물려받은 발주 초안(등록은 하지 않는다)', () => {
  const s = fresh();
  assert.deepEqual(E.suggestionsFor(s, 'staff').map((x) => x.rec.id), ['I-0002', 'I-0004', 'I-0006']);
  assert.equal(E.suggestionsFor(s, 'finance').length, 0);
  const before = s.records.purchase_order.length;
  const d = E.draftFromSuggestion(s, 'reorder', 'I-0002');
  assert.equal(s.records.purchase_order.length, before);
  assert.equal(d.values.vendor, 'V-0002');
  assert.deepEqual(d.values.lines, [{ item: 'I-0002', qty: 82, price: 41000 }]);
  assert.match(E.draftFromSuggestion(s, 'reorder', 'I-0006').basis, /이력 없음/);
  assert.equal(E.createRecord(s, 'purchase_order', d.values, meta).ok, true);
});

// 무력화 시험: 규격을 한 군데씩 깨면 검사기가 빨갛게 되어야 한다.
const broken = [
  ['없는 상태로 가는 전이', (s) => { s.modules[0].entities[2].workflow.transitions[0].to = 'nowhere'; }, /to nowhere/],
  ['명세에 없는 역할', (s) => { s.modules[0].entities[2].workflow.transitions[1].roles = ['ceo']; }, /roles/],
  ['confirm 없는 위험 동작', (s) => { delete s.modules[0].entities[2].workflow.transitions.find((t) => t.id === 'cancel').confirm; }, /risk 전이/],
  ['막다른 상태', (s) => { s.modules[0].entities[2].workflow.states.push({ id: 'limbo', label: '보류', tone: 'idle' }); }, /막다른/],
  ['규격 밖 tone', (s) => { s.modules[0].entities[2].workflow.states[0].tone = 'pink'; }, /tone/],
  ['없는 entity 참조', (s) => { s.modules[0].entities[1].fields[0].ref = 'client'; }, /ref client/],
  ['목록 열이 없는 필드', (s) => { s.modules[0].entities[0].list.columns.push('fax'); }, /list 열 fax/],
  ['제안 대상 줄에 참조 칸 없음', (s) => { s.suggestions[0].line.col = 'sku'; }, /sku 칸이 없다/],
  ['근거 없는 제안', (s) => { delete s.suggestions[0].reason; }, /reason/],
  ['없는 차트를 가리키는 추세', (s) => { s.dashboard.metrics[0].trend = 'nope'; }, /trend nope/],
  ['기준정보에 code 없음', (s) => { s.modules[1].entities[0].fields.shift(); }, /code 필드/]
];
for (const [name, mutate, expect] of broken) {
  test(`무력화: ${name} → 빨강`, () => {
    const s = structuredClone(spec);
    mutate(s);
    const fail = validateErpPlatform(s, seed, css);
    assert.ok(fail.some((f) => expect.test(f)), fail.join('\n'));
  });
}

test('무력화: 데이터가 명세를 어기면 빨강', () => {
  const d = structuredClone(seed);
  d.records.customer[0].grade = 'S';
  assert.ok(validateErpPlatform(spec, d, css).some((f) => /C-0001\.grade/.test(f)));
});

test('무력화: 배치 CSS 에 선·그림자·날색·토큰 밖 크기를 쓰면 빨강', () => {
  const fail = validateErpPlatform(spec, seed, css + '\n.x { border: 1px solid red; box-shadow: 0 1px 2px black; color: #ff0000; font-size: 11px; border-radius: 6px; }');
  for (const re of [/선을/, /그림자/, /토큰 밖 색/, /글자 크기/, /모서리/]) assert.ok(fail.some((f) => re.test(f)), re.source);
});
