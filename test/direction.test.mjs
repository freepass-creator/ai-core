import test from 'node:test';
import assert from 'node:assert/strict';
import { 방향적용, 방향고르기, 쓸수있나, 맞는가, 벽인가 } from '../src/integration/direction.mjs';
import { evaluateControlTower } from '../scripts/evaluate-control-tower.mjs';

const SUB = 'a'.repeat(40);
const AS_OF = '2026-09-17T12:00:00Z';

const 항목 = (덧 = {}) => ({
  id: 'DEV-001', project_id: 'ai-core', title: '시험',
  intent: { status: 'INFERRED', provenance: 'AI_INFERRED' },
  sources: [{ ref: 'r', revision: SUB, observed_at: '2026-09-17T09:00:00Z', valid_until: '2026-09-17T09:00:00Z', status: 'CURRENT', severity: 'MATERIAL' }],
  commitment: { status: 'PROPOSED', accepted: false, owner: null, due_at: null, dependencies: [] },
  allocations: [], authorization: { required: true, status: 'PENDING' },
  subject_revision: SUB, evidence_receipts: [], verification: 'NOT_RUN',
  execution: 'NOT_STARTED', outcome: 'NOT_OBSERVED', ...덧,
});

const 방향 = (덧 = {}) => ({
  id: 'DIR-001', 무엇: 'ai-core 개발은 main 병합까지 기계가',
  적용: { project_id: 'ai-core' }, 주인: '대표',
  기한규칙: { 며칠: 7 }, 관측유효: { 시간: 72 },
  허가: { action: 'develop', target: 'ai-core', scope: ['read', 'build', 'test', 'merge-to-main'], 유효시간: 24 },
  벽: ['배포'], 세운이: '대표', 세운때: '2026-09-17T00:00:00Z', 만료: '2027-09-17T00:00:00Z', ...덧,
});

const 실행되나 = (it) => {
  const r = evaluateControlTower({ schema_version: '1.0', as_of: AS_OF, capacities: [], items: [it] });
  return { 상태: r.status, 된다: r.items[0].actions.execute.enabled, 막는이유: r.items[0].actions.execute.reasons };
};

test('★방향이 없으면 예전 그대로 막힌다 — 관문은 한 줄도 안 바뀌었다', () => {
  const 그냥 = 실행되나(항목());
  assert.equal(그냥.된다, false);
  assert.ok(그냥.막는이유.includes('CONTROLLING_INTENT_UNCONFIRMED'));
  const r = 방향적용({ 항목: 항목(), 방향들: [], asOf: AS_OF });
  assert.equal(r.막힘, 'NO_DIRECTION');
  assert.equal(실행되나(r.항목).된다, false);
});

test('★방향이 있으면 같은 관문을 그대로 통과한다', () => {
  const r = 방향적용({ 항목: 항목(), 방향들: [방향()], asOf: AS_OF });
  const 결과 = 실행되나(r.항목);
  assert.equal(결과.상태, 'READY');
  assert.equal(결과.된다, true);
  assert.deepEqual(결과.막는이유, []);
  assert.equal(r.쓴방향, 'DIR-001/대표');
});

test('★방향이 채운 칸마다 «누가 허락했나» 가 남는다', () => {
  const { 항목: 채운 } = 방향적용({ 항목: 항목(), 방향들: [방향()], asOf: AS_OF });
  // 누가 허락했나에 답이 없으면 그것은 허가가 아니라 그냥 통과다.
  assert.equal(채운.authorization.authorized_by, 'DIR-001/대표');
  assert.equal(채운.commitment.owner, '대표');
});

test('★방향은 «적어 놓은 범위» 밖을 허가하지 못한다', () => {
  const 좁은 = 방향({ 허가: { action: 'develop', target: 'ai-core', scope: ['read'], 유효시간: 24 } });
  const { 항목: 채운 } = 방향적용({ 항목: 항목(), 방향들: [좁은], asOf: AS_OF });
  assert.deepEqual(채운.authorization.scope, ['read']);
  // 범위를 늘려 주지 않는다 — 방향에 적힌 그대로다.
  assert.ok(!채운.authorization.scope.includes('merge-to-main'));
});

test('★허가 칸이 없는 방향은 «아무 권한도» 주지 않는다 — 벽까지만 흐른다', () => {
  const 권한없이 = 방향({ 허가: undefined });
  const { 항목: 채운 } = 방향적용({ 항목: 항목(), 방향들: [권한없이], asOf: AS_OF });
  assert.equal(채운.authorization.status, 'PENDING');
  const 결과 = 실행되나(채운);
  assert.equal(결과.된다, false);
  assert.ok(결과.막는이유.includes('AUTHORIZATION_REQUIRED'));
  // 그래도 intent·commitment 는 섰다 — 「여기까지는 흐르고 실행만 사람이」 가 된다.
  assert.ok(!결과.막는이유.includes('CONTROLLING_INTENT_UNCONFIRMED'));
  assert.ok(!결과.막는이유.includes('COMMITMENT_NOT_ACTIVE'));
});

test('★안 맞는 일에는 방향이 닿지 않는다', () => {
  const 남의일 = 항목({ project_id: 'freepasserp4' });
  const r = 방향적용({ 항목: 남의일, 방향들: [방향()], asOf: AS_OF });
  assert.equal(r.막힘, 'NO_DIRECTION');
  assert.equal(실행되나(r.항목).된다, false);
});

test('★모든 일에 걸리는 방향은 방향이 아니다 — 빈 적용은 아무것도 안 맞는다', () => {
  assert.equal(맞는가(방향({ 적용: {} }), 항목()), false);
  assert.equal(맞는가(방향({ 적용: undefined }), 항목()), false);
});

test('★만료된 방향은 아무것도 못 준다', () => {
  const 지난 = 방향({ 만료: '2026-09-01T00:00:00Z' });
  assert.equal(쓸수있나(지난, AS_OF), 'DIRECTION_EXPIRED');
  const r = 방향적용({ 항목: 항목(), 방향들: [지난], asOf: AS_OF });
  assert.equal(r.막힘, 'DIRECTION_EXPIRED');
  assert.equal(실행되나(r.항목).된다, false);
});

test('★누가 언제 세웠는지 없는 방향은 못 쓴다', () => {
  assert.equal(쓸수있나(방향({ 세운이: '' }), AS_OF), 'DIRECTION_AUTHOR_REQUIRED');
  assert.equal(쓸수있나(방향({ 만료: null }), AS_OF), 'DIRECTION_WINDOW_REQUIRED');
  assert.equal(쓸수있나(방향({ 세운때: '2099-01-01T00:00:00Z' }), AS_OF), 'DIRECTION_FROM_FUTURE');
});

test('★두 방향이 같은 일을 가리키면 고르지 않고 선다', () => {
  const 둘 = [방향(), 방향({ id: 'DIR-002', 주인: '딴사람' })];
  assert.equal(방향고르기(둘, 항목(), AS_OF).막힘, 'DIRECTION_AMBIGUOUS');
  const r = 방향적용({ 항목: 항목(), 방향들: 둘, asOf: AS_OF });
  assert.equal(r.막힘, 'DIRECTION_AMBIGUOUS');
  assert.equal(실행되나(r.항목).된다, false);
});

test('★벽은 «사람이 정한 자리» 다 — 실패가 아니다', () => {
  assert.equal(벽인가(방향(), '배포'), true);
  assert.equal(벽인가(방향(), 'merge-to-main'), false);
});

test('★관측 유효기간도 방향이 정한다 — 없으면 이미 만료다', () => {
  const { 항목: 채운 } = 방향적용({ 항목: 항목(), 방향들: [방향()], asOf: AS_OF });
  assert.notEqual(채운.sources[0].valid_until, 채운.sources[0].observed_at);
  const 기간없이 = 방향({ 관측유효: undefined });
  const { 항목: 그대로 } = 방향적용({ 항목: 항목(), 방향들: [기간없이], asOf: AS_OF });
  assert.equal(그대로.sources[0].valid_until, 그대로.sources[0].observed_at);
  assert.ok(실행되나(그대로).막는이유.includes('MATERIAL_OBSERVATION_EXPIRED'));
});
