// 키트 재배포 준비가 «프로젝트 소유 파일»을 지우지 않는지 지킨다.
// ★2026-10-03: compat 3 재배포에서 옛 .ai-core 를 통째로 지우자 freepass-sales 의 ui-ux.consumer.json,
//   teamjpkwork 의 standards 사본 둘이 사라질 뻔했다(푸시 전에 잡음).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lostFiles } from '../scripts/kit-redistribute.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('★옛 키트 매니페스트 밖의 파일만 되살린다 — 생성기가 일부러 뺀 옛 생성물은 부활시키지 않는다 (Codex 검토)', () => {
  const before = ['.ai-core/kit.json', '.ai-core/old-generated.mjs', '.ai-core/ui-ux.consumer.json', '.ai-core/standards/EMERGENCY_RUNBOOK.md', 'README.md'];
  const after = ['.ai-core/kit.json', '.ai-core/advisory.mjs'];
  const oldManifest = ['old-generated.mjs'];
  assert.deepEqual(lostFiles(before, after, oldManifest), ['.ai-core/standards/EMERGENCY_RUNBOOK.md', '.ai-core/ui-ux.consumer.json']);
  assert.deepEqual(lostFiles(after, after, []), []);
});

test('옛 매니페스트를 못 읽으면 아무것도 되살리지 않는다(null → HOLD)', () => {
  assert.equal(lostFiles(['.ai-core/x.json'], [], null), null);
});

test('★준비만 한다 — 스크립트가 스스로 푸시하지 않고, 푸시 명령은 원격 SHA 에 고정한 lease 다', () => {
  const src = readFileSync(resolve(root, 'scripts/kit-redistribute.mjs'), 'utf8');
  assert.doesNotMatch(src, /git\(tmp, 'push'|\['push'/, '스크립트가 푸시하면 안 된다');
  assert.match(src, /--force-with-lease=refs\/heads\/\$\{branch\}:\$\{ev\.remote_branch_sha_before\}/);
  assert.match(src, /restore-project-owned/);
  assert.match(src, /only-ai-core-changed/);
  assert.match(src, /UNAVAILABLE/);
});

test('★ai-core 가 origin/main 이 아닌 곳에서 돌면 멈춘다 — 키트가 원격에 없는 커밋을 가리키게 된다', () => {
  const src = readFileSync(resolve(root, 'scripts/kit-redistribute.mjs'), 'utf8');
  assert.match(src, /step\('ai-core-at-origin-main'/);
  assert.ok(src.indexOf("step('ai-core-at-origin-main'") < src.indexOf("'academy-start-READY'"), '생성 전에 확인해야 한다');
});
