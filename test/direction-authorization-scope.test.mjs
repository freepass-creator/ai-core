import test from 'node:test';
import assert from 'node:assert/strict';
import { 방향적용 } from '../src/integration/direction.mjs';
import { evaluateControlTower } from '../scripts/evaluate-control-tower.mjs';

const SUBJECT = 'a'.repeat(40);
const AS_OF = '2026-09-17T12:00:00Z';

const item = {
  id: 'DEV-001', project_id: 'ai-core', title: 'scope boundary',
  intent: { status: 'INFERRED', provenance: 'AI_INFERRED' },
  sources: [{ ref: 'r', revision: SUBJECT, observed_at: '2026-09-17T09:00:00Z', valid_until: '2026-09-20T09:00:00Z', status: 'CURRENT', severity: 'MATERIAL' }],
  commitment: { status: 'PROPOSED', accepted: false, owner: null, due_at: null, dependencies: [] },
  allocations: [], authorization: { required: true, status: 'PENDING' },
  subject_revision: SUBJECT, evidence_receipts: [], verification: 'NOT_RUN', execution: 'NOT_STARTED', outcome: 'NOT_OBSERVED',
};

const direction = {
  id: 'DIR-001', 적용: { project_id: 'ai-core' }, 주인: '대표',
  승인근거: { 원장사건: 'WR-000000001' }, 기한규칙: { 며칠: 7 }, 관측유효: { 시간: 72 },
  허가: { action: 'develop', target: 'ai-core', scope: ['   '], 유효시간: 24 },
  세운이: '대표', 세운때: '2026-09-17T00:00:00Z', 만료: '2027-09-17T00:00:00Z',
};

test('★ whitespace-only authority scope never becomes a granted execution proof', () => {
  const applied = 방향적용({ 항목: item, 방향들: [direction], asOf: AS_OF, 승인확인: () => true }).항목;
  assert.equal(applied.authorization.status, 'PENDING');

  const result = evaluateControlTower({ schema_version: '1.0', as_of: AS_OF, capacities: [], items: [applied] });
  assert.equal(result.items[0].actions.execute.enabled, false);
  assert.ok(result.items[0].actions.execute.reasons.includes('AUTHORIZATION_REQUIRED'));
});
