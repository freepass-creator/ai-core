// ERP 표준 UI 규격 v1 — design/erp-standard 가 규격대로 유지되는지 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkErpStandard } from '../scripts/check-erp-standard.mjs';

test('ERP 표준 규격 — 토큰 투영·토큰 전용·템플릿 골격이 모두 지켜진다', () => {
  const { ok, errors } = checkErpStandard();
  assert.ok(ok, errors.join('\n'));
});
