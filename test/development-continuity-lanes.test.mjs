import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('AI Core has exactly four conceptual work lanes and they are not permanent branches', async () => {
  const policy = JSON.parse(await read('registry/development-continuity-policy.json'));
  const lanes = policy.ai_core_work_lanes;
  assert.ok(lanes);
  assert.deepEqual(Object.keys(lanes.lanes).sort(), ['audit','core','hardening','integration']);
  assert.match(lanes.principle, /not permanent branches/i);
  for (const lane of Object.values(lanes.lanes)) assert.equal(lane.owns_domain_product_code, false);
});

test('domain implementations remain owned by their product repositories', async () => {
  const policy = JSON.parse(await read('registry/development-continuity-policy.json'));
  const ownership = policy.ai_core_work_lanes.domain_ownership;
  assert.match(ownership.rule, /Domain implementations belong to their owning product repository/);
  assert.match(ownership.examples.penalty, /Rental Manager owns penalty processing implementation/);
  assert.match(ownership.examples.kakao_ops, /Kakao Ops owns Kakao automation implementation/);
});

test('human standard explains lane classification and transient branches', async () => {
  const body = await read('docs/DEVELOPMENT_CONTINUITY_STANDARD.md');
  for (const lane of ['core','integration','audit','hardening']) assert.match(body, new RegExp('`'+lane+'`'));
  assert.match(body, /레인은 상시 브랜치 이름이 아니다/);
  assert.match(body, /실제 branch는 Work 수만큼만 잠깐 존재/);
});
