import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createOrderIntakeSandbox } from '../src/integration/order-intake-sandbox.mjs';
import { verifyLedgerText } from '../scripts/work-ledger.mjs';

const registry = JSON.parse(await readFile(new URL('../examples/project-registry.json', import.meta.url)));
async function fixture(t) {
  const s = await createOrderIntakeSandbox({ registry, asOf: '2026-09-15T01:00:00Z' });
  t.after(() => s.close()); return s;
}
function preview(s, intent = 'new', target = null) {
  const source = { origin: 'user', message_id: 'synthetic-message', text: target ? `${target} 요구를 모바일 검증으로 수정해줘` : '오더 화면을 만들어줘' };
  const evidence = [{ start: 0, end: source.text.length, quote: source.text }];
  const candidate = { source, intent: { value: intent, evidence }, request: { value: source.text, evidence }, targets: target ? [{ value: target, evidence }] : [] };
  return s.preview(candidate, source, { projectId: 'ai-core', title: '합성 오더', criteria: ['모바일에서 확인'] });
}
const confirm = (s, p) => s.confirm({ token: p.token, proposal_digest: p.proposal_digest, confirmed: true });

test('original intake/store/ledger/evaluator compose; confirmation is still HOLD, not authority', async t => {
  const s = await fixture(t); const p = preview(s);
  assert.equal(p.status, 'SEMANTIC_CONFIRMATION_REQUIRED'); assert.equal(s.store.list().length, 0);
  await assert.rejects(s.confirm({ token: p.token, proposal_digest: p.proposal_digest, confirmed: false }), /CONFIRMATION_MISMATCH/);
  const result = await confirm(s, p);
  assert.equal(result.reason, 'DURABLE_MAPPING_OUTBOX_UNAVAILABLE');
  assert.equal(result.projection.status, 'LINKED');
  assert.equal(result.projection.canonical_state, 'RECEIVED');
  assert.equal(result.projection.control_result.execute.enabled, false);
  assert.equal(result.execution_authorized, false); assert.equal(result.sent, false);
  const ledger = verifyLedgerText(await readFile(s.ledgerPath, 'utf8'));
  assert.equal(ledger.status, 'VALID'); assert.equal(ledger.event_count, 1);
});

test('same confirmation across clients appends once; changed digest cannot reuse token', async t => {
  const s = await fixture(t); const p = preview(s);
  const [a, b] = await Promise.all([confirm(s, p), confirm(s, p)]);
  assert.deepEqual(a, b); assert.equal(s.store.list().length, 1); assert.equal(s.mappingHistory().length, 1);
  assert.equal(verifyLedgerText(await readFile(s.ledgerPath, 'utf8')).event_count, 1);
  await assert.rejects(confirm(s, { ...p, proposal_digest: 'different' }), /CONFIRMATION_MISMATCH/);
});

test('new requirements get new work identity; note/claim changes only observed record version', async t => {
  const s = await fixture(t); const initial = await confirm(s, preview(s));
  const history = s.mappingHistory(); const order = s.store.get(initial.order_id);
  s.store.mutate(order.id, { requestId: 'note-1', version: order.version, action: 'note', note: '합성 메모' });
  let result = await s.readWorkProjection(order.id);
  assert.equal(result.projection.mapping.work_id, history[0].mapping.work_id);
  assert.equal(result.projection.mapping.record_version, 2);
  const changed = await confirm(s, preview(s, 'change', order.id));
  assert.equal(changed.projection.canonical_state, 'RECEIVED');
  assert.notEqual(changed.projection.mapping.work_id, history[0].mapping.work_id);
  assert.deepEqual(s.mappingHistory()[0], history[0]);
  assert.notEqual(s.mappingHistory()[1].requirement_digest, history[0].requirement_digest);
  assert.equal(verifyLedgerText(await readFile(s.ledgerPath, 'utf8')).event_count, 2);
});

test('stale confirmation rejects before requirements or ledger writes', async t => {
  const s = await fixture(t); const initial = await confirm(s, preview(s));
  const p = preview(s, 'change', initial.order_id); const order = s.store.get(initial.order_id);
  s.store.mutate(order.id, { requestId: 'note-stale', version: order.version, action: 'note', note: '다른 관측' });
  const before = await readFile(s.ledgerPath, 'utf8');
  await assert.rejects(confirm(s, p), /STALE_CONFIRMATION/);
  assert.equal(await readFile(s.ledgerPath, 'utf8'), before); assert.equal(s.store.get(order.id).revision, 1);
});

test('partial write holds and cannot be blindly replayed', async t => {
  const s = await fixture(t); const p = preview(s);
  await writeFile(`${s.ledgerPath}.lock`, 'synthetic competing writer');
  const first = await confirm(s, p); const second = await confirm(s, p);
  assert.equal(first.reason, 'PARTIAL_WRITE_REQUIRES_RECONCILIATION'); assert.equal(first.detail, 'LEDGER_LOCKED');
  assert.deepEqual(second, first); assert.equal(s.store.list().length, 1); assert.deepEqual(s.mappingHistory(), []);
});

test('host source mismatch and ledger corruption fail closed without stale projection', async t => {
  const s = await fixture(t);
  assert.throws(() => s.preview({ source: { text: 'forged' } }, { text: 'actual' }), /SOURCE_MISMATCH/);
  const result = await confirm(s, preview(s));
  await writeFile(s.ledgerPath, 'broken');
  const failed = await s.readWorkProjection(result.order_id);
  assert.equal(failed.projection.reason, 'LEDGER_INVALID'); assert.equal(failed.projection.mapping, undefined);
});
