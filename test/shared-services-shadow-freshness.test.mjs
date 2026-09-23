// 그림자가 «옛 그림»이 되는 순간을 잡는다.
//
// ★대표 2026-09-23: 「통합 계속 진행해줘」 — 세 번째 물결(공통 서비스 ← aiops)에서 내 레인은 반례 검토다.
// 읽어 보니 사본 자체는 고정된 blob 과 정확히 일치했다(직접 대조함). 구멍은 다른 곳에 있었다:
//   고정된 sha 가 시험 파일 안에 «글자»로 박혀 있어서, **원본이 움직여도 시험은 영원히 초록**이다.
//   ai-core 는 이미 프로젝트 head 를 관측하므로, 그 값과 맞대면 움직임은 알 수 있다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 그림자신선도, 모든그림자, 판정 } from '../src/integration/shadow-freshness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const 기본내력 = (덮개 = {}) => ({
  source_repository: 'freepass-creator/aiops',
  source_revision: A,
  entries: [
    { source_path: 'lib/goog.mjs', source_blob_sha: '1'.repeat(40) },
    { source_path: 'lib/sheet.mjs', source_blob_sha: '2'.repeat(40) }
  ],
  ...덮개
});

test('관측된 head 와 고정 revision 이 같으면 최신이다', () => {
  const r = 그림자신선도(기본내력(), A);
  assert.equal(r.state, 판정.최신);
  assert.deepEqual(r.이유, []);
});

test('★원본이 움직였는데 다시 본 기록이 없으면 보류다 — 지금 구조에서는 아무도 이걸 잡지 않았다', () => {
  const r = 그림자신선도(기본내력(), B);
  assert.equal(r.state, 판정.보류);
  assert.deepEqual(r.이유, ['SOURCE_MOVED_WITHOUT_REVALIDATION']);
});

test('다시 본 기록이 «다른 head» 의 것이면 보류다', () => {
  const 내력 = 기본내력({ revalidation: { checked_head: 'c'.repeat(40), entries: [] } });
  const r = 그림자신선도(내력, B);
  assert.equal(r.state, 판정.보류);
  assert.deepEqual(r.이유, ['REVALIDATION_HEAD_MISMATCH']);
});

test('일부만 다시 봤으면 보류다 — 안 본 것이 바뀌었을 수 있다', () => {
  const 내력 = 기본내력({
    revalidation: { checked_head: B, entries: [{ source_path: 'lib/goog.mjs', source_blob_sha_at_checked_head: '1'.repeat(40) }] }
  });
  const r = 그림자신선도(내력, B);
  assert.equal(r.state, 판정.보류);
  assert.deepEqual(r.이유, ['REVALIDATION_INCOMPLETE']);
  assert.deepEqual(r.확인안된것, ['lib/sheet.mjs']);
});

test('★원본이 실제로 바뀌었으면 보류이고, 무엇이 바뀌었는지 이름을 댄다', () => {
  const 내력 = 기본내력({
    revalidation: {
      checked_head: B,
      entries: [
        { source_path: 'lib/goog.mjs', source_blob_sha_at_checked_head: '1'.repeat(40) },
        { source_path: 'lib/sheet.mjs', source_blob_sha_at_checked_head: '9'.repeat(40) }
      ]
    }
  });
  const r = 그림자신선도(내력, B);
  assert.equal(r.state, 판정.보류);
  assert.deepEqual(r.이유, ['SOURCE_DRIFTED']);
  assert.deepEqual(r.바뀐것, ['lib/sheet.mjs']);
});

test('head 가 움직였어도 대상 blob 이 그대로임을 다 확인했으면 재확인됨이다', () => {
  const 내력 = 기본내력({
    revalidation: {
      checked_head: B,
      entries: [
        { source_path: 'lib/goog.mjs', source_blob_sha_at_checked_head: '1'.repeat(40) },
        { source_path: 'lib/sheet.mjs', source_blob_sha_at_checked_head: '2'.repeat(40) }
      ]
    }
  });
  const r = 그림자신선도(내력, B);
  assert.equal(r.state, 판정.재확인됨);
  assert.equal(r.확인한head, B);
});

test('revision 이 40자 16진수가 아니면 그 자체로 보류다 — 짧은 sha 로 고정하지 않는다', () => {
  assert.equal(그림자신선도(기본내력({ source_revision: 'abc1234' }), A).state, 판정.보류);
  assert.equal(그림자신선도(기본내력(), '   ').state, 판정.보류);
});

test('★지금 저장소의 실제 그림자가 최신이다 — 이 검사가 원본 이동을 처음으로 잡아낸다', () => {
  /** 실측(2026-09-23): shared-services 의 고정 revision · registry 가 관측한 aiops head ·
   *  원격 aiops main 이 모두 3d6ec8c 로 같다. 원본이 움직이면 이 검사가 빨개진다. */
  const 내력 = json('shared-services/PROVENANCE.json');
  const aiops = json('registry/projects.json').projects.find((p) => p.project_id === 'aiops');
  assert.ok(aiops, 'registry 에 aiops 가 있어야 원본 이동을 관측할 수 있다');

  const { 결과, 보류 } = 모든그림자([{ 이름: 'shared-services', 내력, 관측head: aiops.head_revision }]);
  assert.equal(결과.length, 1);
  assert.deepEqual(
    보류.map((r) => `${r.이름}: ${r.이유.join(',')}`),
    [],
    'aiops 가 움직였다 — shared-services/PROVENANCE.json 에 revalidation 을 기록해야 한다(scripts/verify-shadow-freshness.mjs)'
  );
  assert.equal(결과[0].state, 판정.최신);
});
