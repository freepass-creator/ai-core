import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { 브리핑, 방향상태, 글로 } from '../src/integration/core-brief.mjs';
import { 원장승인확인 } from '../src/integration/order-work-sources.mjs';
import { appendLedgerEvent } from '../scripts/work-ledger.mjs';

const NOW = new Date('2026-09-18T05:00:00Z');
const rev = createHash('sha1').update('x').digest('hex');
const 방향 = (o = {}) => ({ id: 'DIR-X', 적용: { project_id: 'aiops' }, 세운이: '대표', 세운때: '2026-09-17T00:00:00Z', 만료: '2027-09-17T00:00:00Z',
  승인근거: { 원장사건: 'APPROVAL-001' }, ...o });

const 원장 = async (t, 증거) => {
  const dir = mkdtempSync(join(tmpdir(), 'brief-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const 길 = join(dir, 'l.jsonl');
  await appendLedgerEvent(길, { event_id: 'APPROVAL-001', work_id: 'DIRECTION-001', project_id: 'aiops', type: 'CREATED', from_state: null,
    to_state: 'RECEIVED', actor: 'T', subject_revision: rev, observed_at: '2026-09-17T00:00:00Z', evidence_refs: 증거 }, null);
  return readFileSync(길, 'utf8');
};

test('★방향 — 파일에 「세운이: 대표」 만 적혀서는 «살아있음» 이 아니다', async (t) => {
  const 승인있음 = 원장승인확인(await 원장(t, ['RECEIVED:「켜라」 @대표']));
  const 증거없음 = 원장승인확인(await 원장(t, ['READ:문서 @x']));
  const 판 = (d, 확인) => 방향상태(d, { asOf: NOW.toISOString(), 승인확인: 확인 });
  assert.equal(판(방향(), 승인있음).상태, '살아있음');
  assert.equal(판(방향({ 세운이: '' }), 승인있음).상태, '초안');
  assert.equal(판(방향({ 만료: '' }), 승인있음).상태, '초안');
  assert.deepEqual(판(방향({ 승인근거: undefined }), 승인있음), { id: 'DIR-X', 상태: '승인근거없음', 까닭: 'EVIDENCE_REQUIRED' });
  assert.equal(판(방향({ 승인근거: { 원장사건: 'NOPE-001' } }), 승인있음).까닭, 'LEDGER_APPROVAL_NOT_FOUND', '가리킨 사건이 원장에 없다');
  assert.equal(판(방향(), 증거없음).까닭, 'LEDGER_APPROVAL_NOT_FOUND', '사람이 말한 증거(RECEIVED)가 없는 사건은 승인이 아니다');
  assert.equal(판(방향(), 원장승인확인('')).상태, '승인근거없음', '원장이 없으면 승인도 없다');
  assert.deepEqual(판(방향({ 만료: '2026-09-18T00:00:00Z' }), 승인있음), { id: 'DIR-X', 상태: '못씀', 까닭: 'DIRECTION_EXPIRED' });
});

test('★사본이 없으면 «모른다» — 비어 있다고 하지 않는다', () => {
  const b = 브리핑({ now: NOW });
  assert.equal(b.운영, null);
  assert.equal(b.올라감, null);
  assert.equal(b.원장, null);
  assert.equal(b.열린PR, null);
  const 글 = 글로(b);
  assert.match(글, /모름 — npm run ops:watch/);
  assert.match(글, /모름 — npm run work:observe/);
  assert.match(글, /모름 — 원장 파일이 없다/);
  assert.match(글, /열린 PR 은 못 읽었다 — 모름/);
  assert.doesNotMatch(글, /^ {3}없음$/m, 'PR 을 못 읽었는데 「대표 몫 없음」 이라고 하면 안 된다');
  assert.match(글, /알려진 것은 없음 — PR 은 모름/);
});

test('운영 — 우리 몫 문제만 대표 몫에 올린다(자료가 들어간 실패는 조용히)', () => {
  const 판 = (자료반영) => ({ id: 'OPS-1', status: 'FAILED', 창안: true, 이유: [{ status: 'FAILED', code: 'LAST_RUN_FAILED', 자료반영 }] });
  const 조용 = 브리핑({ now: NOW, ops: { as_of: NOW.toISOString(), 판들: [판(true)] } });
  assert.deepEqual(조용.대표몫, []);
  assert.match(글로(조용), /LAST_RUN_FAILED\(자료는 반영됨\)/);
  const 울림 = 브리핑({ now: NOW, ops: { as_of: NOW.toISOString(), 판들: [판(false)] } });
  assert.deepEqual(울림.대표몫, ['운영 OPS-1: FAILED LAST_RUN_FAILED(자료도 안 바뀜)']);
});

test('원장 — 깨졌으면 대표 몫, 일감마다 리비전 드리프트를 붙인다', async (t) => {
  const 깨짐 = 브리핑({ now: NOW, ledgerText: '{"x":1}\n' });
  assert.equal(깨짐.원장.status, 'INVALID');
  assert.match(깨짐.대표몫[0], /원장이 깨졌다/);
  const 글 = await 원장(t, ['RECEIVED:x @y']);
  const b = 브리핑({ now: NOW, ledgerText: 글, landed: { as_of: NOW.toISOString(), projects: {}, commits: [],
    works: [{ work_id: 'DIRECTION-001', project_id: 'aiops', status: 'UNKNOWN', reason: 'REVISION_NOT_IN_PROJECT' }] } });
  assert.deepEqual(b.원장.일감.map((w) => [w.id, w.state, w.리비전]), [['DIRECTION-001', 'RECEIVED', 'UNKNOWN REVISION_NOT_IN_PROJECT']]);
});

test('열린 PR — 사흘 안에 움직였고 초안이 아닌 것만', () => {
  const p = (number, 날, draft = false) => ({ repo: 'ai-core', number, title: `t${number}`, updated_at: new Date(NOW.getTime() - 날 * 86_400_000).toISOString(), draft });
  const b = 브리핑({ now: NOW, prs: [p(1, 0.5), p(2, 5), p(3, 1, true)] });
  assert.deepEqual(b.열린PR.map((x) => x.number), [1]);
  assert.deepEqual(b.대표몫, ['열린 PR ai-core#1 t1']);
});

test('열린 PR — 갱신시각을 읽을 수 없으면 «없음»이 아니라 «모름»', () => {
  const b = 브리핑({ now: NOW, prs: [{ repo: 'ai-core', number: 9, title: 'bad-time', updated_at: 'not-a-time', draft: false }] });
  assert.equal(b.열린PR, null);
  assert.deepEqual(b.대표몫, []);
  const 글 = 글로(b);
  assert.match(글, /열린 PR 은 못 읽었다 — 모름/);
  assert.doesNotMatch(글, /^ {3}없음$/m, '갱신시각이 깨진 PR 을 조용히 버리고 「대표 몫 없음」 이라고 하면 안 된다');
});
