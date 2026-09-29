// devcenter/ 흡수표 — 222개 파일마다 흡수·검토·보관 중 «하나». 공백이 없고, 모르는 채로 끝났다고 하지 않게.
//
// ★대표 2026-09-29: 「보존해 보관하고 흡수만 하는 거로 하자」
//   Codex 조건: 지우기 전에 파일마다 실제 소비 경로·고유 자산·복구 수단을 확인한다.
//   정적 grep 만으로는 동적 경로(스키마 6개)를 놓쳤다 — devcenter/ 를 지운 임시 체크아웃에서 전체 테스트를 돌려 찾았다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 표 = JSON.parse(readFileSync(resolve(root, 'registry/devcenter-absorption.json'), 'utf8'));
const 통 = new Set(['ABSORB', 'REVIEW', 'ARCHIVE']);
const 읽기 = (p) => readFileSync(resolve(root, p), 'utf8');

test('★git 이 추적하는 devcenter/ 파일은 모두 표에 정확히 한 번 있다 — 공백도 중복도 없다', () => {
  if (!existsSync(resolve(root, 'devcenter'))) return; // 지운 뒤에는 태그가 그 몫을 한다(아래 테스트)
  const 실제 = execFileSync('git', ['-c', 'core.quotepath=false', 'ls-files', 'devcenter'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  const 적힌 = 표.files.map((f) => f.path).sort();
  assert.equal(new Set(적힌).size, 적힌.length, '같은 파일이 두 번 적혔다');
  assert.deepEqual(적힌, 실제, '표에 없는 파일이 있거나, 없는 파일이 표에 있다');
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
      || (f.path.startsWith('devcenter/contracts/') && 영수증.includes(`'${basename(f.path)}'`));
    assert.ok(부름, `${f.path} 는 흡수로 적혔는데 적힌 소비처가 부르지 않는다 — 흡수 까닭이 없다`);
  }
  // 조용히 끊기는 둘 — 지워도 테스트가 안 깨지는 입구를 빠뜨리지 않는다
  for (const p of ['devcenter/hubs/design/README.md', 'devcenter/hubs/quality/README.md']) {
    assert.ok(흡수.some((f) => f.path === p), `${p} 가 흡수에서 빠졌다 — 지우면 아무도 모르게 끊긴다`);
  }
});

test('★REVIEW 가 남았거나 복구 태그가 없으면 «완료»가 아니다', () => {
  const 남음 = 표.counts.REVIEW > 0 || 표.recovery_tag.status !== 'VERIFIED';
  if (남음) assert.doesNotMatch(표.status, /^COMPLETE/, '검토가 남았거나 태그가 검증 전인데 완료로 적었다');
  assert.equal(표.recovery_tag.conditions_codex.length, 4, '태그를 복구 수단으로 인정하는 Codex 조건 넷이 빠졌다');
});
