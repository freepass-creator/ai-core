import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateDirectionRegistrySemantics } from '../src/engine/direction-registry.mjs';

const registry = JSON.parse(await readFile(new URL('../registry/directions.json', import.meta.url), 'utf8'));

test('현재 direction registry는 활성/초안 경계를 명시적으로 만족한다', () => {
  const result = validateDirectionRegistrySemantics(registry);
  assert.equal(result.status, 'VALID');
  assert.equal(result.count, 3);
  assert.equal(result.active, 1);
  assert.equal(result.draft, 2);
});

test('세운이만 채운 반쪽짜리 방향은 활성화할 수 없다', () => {
  const broken = structuredClone(registry);
  broken.방향[1].세운이 = '대표';
  assert.throws(() => validateDirectionRegistrySemantics(broken), /DIRECTION_ACTIVATION_PARTIAL/);
});

test('벽을 허가 scope로 동시에 넣을 수 없다', () => {
  const broken = structuredClone(registry);
  broken.방향[0].허가.scope.push('관청발송');
  assert.throws(() => validateDirectionRegistrySemantics(broken), /DIRECTION_SCOPE_CROSSES_WALL/);
});

test('활성 direction은 원장 승인근거 없이 살 수 없다', () => {
  const broken = structuredClone(registry);
  delete broken.방향[0].승인근거;
  assert.throws(() => validateDirectionRegistrySemantics(broken), /DIRECTION_APPROVAL_EVIDENCE_REQUIRED/);
});
