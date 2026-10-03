// devcenter/ 흡수표 — 222개 파일마다 흡수·검토·보관 중 «하나». 공백이 없고, 모르는 채로 끝났다고 하지 않게.
//
// ★대표 2026-09-29: 「보존해 보관하고 흡수만 하는 거로 하자」
//   Codex 조건: 지우기 전에 파일마다 실제 소비 경로·고유 자산·복구 수단을 확인한다.
//   정적 grep 만으로는 동적 경로(스키마 6개)를 놓쳤다 — devcenter/ 를 지운 임시 체크아웃에서 전체 테스트를 돌려 찾았다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 표 = JSON.parse(readFileSync(resolve(root, 'registry/sunset-devcenter-absorption.json'), 'utf8'));
const 통 = new Set(['ABSORB', 'REVIEW', 'ARCHIVE']);
const 읽기 = (p) => readFileSync(resolve(root, p), 'utf8');

test('devcenter tracked assets are retired and the historical manifest is recoverable', () => {
  const tracked = execFileSync('git', ['ls-files', '-z', '--', 'devcenter'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  assert.deepEqual(tracked, [], 'stage the authorized deletions before final retirement verification');
  assert.equal(표.recovery.kind, 'PROTECTED_MAIN_SHA');
  const historical = 표.files.filter(f => f.path.startsWith('devcenter/')).map(f => f.path).sort();
  const deleted = 표.recovery.deleted_manifest.map(f => 'devcenter/' + f.path).sort();
  assert.equal(new Set(historical).size, 57);
  assert.deepEqual(historical, deleted);
});

test('통은 셋뿐이고, 셈이 맞는다', () => {
  for (const f of 표.files) assert.ok(통.has(f.bucket), `${f.path} 의 통 «${f.bucket}»`);
  for (const b of 통) assert.equal(표.counts[b], 표.files.filter((f) => f.bucket === b).length, `${b} 셈이 다르다`);
  assert.equal(표.counts.total, 표.files.length);
});

test('★복사 뒤 고친 파일은 «그냥 보관»으로 두지 않는다 — 흡수하거나 검토한다(Codex)', () => {
  const 잘못 = 표.files.filter((f) => f.state === 'EDITED_AFTER_COPY' && f.bucket === 'ARCHIVE').map((f) => f.path);
  assert.deepEqual(잘못, []);
});

test('★흡수 목록은 실제로 ai-core 가 부르는 파일이다 — 적힌 소비처가 그 경로를 정말 부른다', () => {
  const 흡수 = 표.files.filter((f) => f.bucket === 'ABSORB');
  const 입구 = 읽기('registry/ui-ux-entrypoint.json');
  const 정본선 = 읽기('registry/canonical-development-lines.json');
  const 영수증 = 읽기('test/core-hub-receipt.test.mjs');
  const 문서허브 = 읽기('test/management-support-transition.test.mjs');
  for (const f of 흡수) {
    const 부름 = 입구.includes(f.path) || 정본선.includes(f.path) || 문서허브.includes(f.path.replace('devcenter/', '')) || 문서허브.includes(f.path)
      || (f.path.startsWith('contracts/hubs/') && 영수증.includes(`'${basename(f.path)}'`));
    assert.ok(부름, `${f.path} 는 흡수로 적혔는데 적힌 소비처가 부르지 않는다 — 흡수 까닭이 없다`);
  }
  // ★반대 방향(Codex 검토): 소비처가 부르는 devcenter 경로는 «전부» ABSORB 여야 한다. 손으로 적은 목록이 아니라 소비처에서 뽑는다.
  const 흡수경로 = new Set(흡수.map((f) => f.path));
  const 부르는것 = new Set([
    ...[...입구.matchAll(/(?:devcenter|contracts\/hubs|src\/hubs|docs\/hubs)\/[^"'\s]+/g), ...정본선.matchAll(/(?:devcenter|contracts\/hubs|src\/hubs|docs\/hubs)\/[^"'\s]+/g), ...문서허브.matchAll(/(?:devcenter|contracts\/hubs|src\/hubs|docs\/hubs)\/[^"'\s`]+/g)].map((m) => m[0]),
    ...[...(영수증.match(/const specialized=\[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/'([^']+\.json)'/g)].map((m) => `contracts/hubs/${m[1]}`),
  ]);
  const 기준선만 = new Set(표.also_retire_on_delete.flatMap((x) => x.match(/(?:devcenter|contracts\/hubs|src\/hubs|docs\/hubs)\/[^\s(]+/g) ?? []));
  const 빠짐 = [...부르는것].filter((p) => !흡수경로.has(p) && !기준선만.has(p) && 표.files.some((f) => f.path === p));
  assert.deepEqual(빠짐, [], '소비처가 부르는데 흡수로 적히지 않은 파일이 있다');
  assert.ok(부르는것.size >= 12, '소비처에서 뽑은 경로가 너무 적다 — 뽑는 규칙이 깨졌다');
  // 조용히 끊기는 둘 — 지워도 테스트가 안 깨지는 입구를 빠뜨리지 않는다
  for (const p of ['docs/hubs/design.md', 'docs/hubs/quality.md']) {
    assert.ok(흡수.some((f) => f.path === p), `${p} 가 흡수에서 빠졌다 — 지우면 아무도 모르게 끊긴다`);
  }
});

test('retirement uses the decided recovery contract while preserving old classification and tag history', () => {
  assert.match(표.status, /흡수 완료/);
  assert.equal(표.recovery.kind, 'PROTECTED_MAIN_SHA');
  assert.equal(표.recovery.sha, 'd7f1935763a5511536ca8c31489cd282cb13b1d6');
  assert.match(표.recovery_tag.superseded, /2026-10-04 사용자 결정/);
  assert.equal(표.recovery_tag.conditions_codex.length, 4, 'retain superseded decision history');
});
