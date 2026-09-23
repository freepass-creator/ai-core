// 문서허브 인수 준비 — «아직 옮기지 않았음»과 «옮길 것의 목록»을 같이 지킨다.
//
// 대표 2026-09-23: 「통합 계속 진행해줘」
// 두 번째 물결을 준비하며 원본을 읽었고, 옮기려다 기존 전환 게이트에 막혔다. 게이트가 맞다 —
// 전환은 승인 전이다. 그래서 복사본 대신 «목록과 해시»를 증거로 남기고, 읽으며 찾은 결함을 고정한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const 매니페스트 = JSON.parse(read('docs/integration/DOCSHUB_CUTOVER_MANIFEST_2026-09-23.json'));
const 감사 = read('docs/integration/DOCSHUB_SPEC_WIRING_AUDIT_2026-09-23.md');
const 판정 = JSON.parse(read('docs/integration/DOCSHUB_IMPORT_CLASSIFICATION_2026-09-23.json'));

test('아직 옮기지 않았다 — 매니페스트는 «증거»이지 사본이 아니다', () => {
  assert.equal(매니페스트.state, 'PRE_CUTOVER_EVIDENCE_ONLY');
  assert.equal(판정.authority.cutover_authorized, false, '승인 상태가 바뀌었으면 이 검사를 같이 고쳐라');
  assert.match(매니페스트.why, /승인/, '왜 아직 옮기지 않는지가 적혀 있어야 한다');
  assert.ok(매니페스트.files.length >= 100, `옮길 목록이 ${매니페스트.files.length} 개뿐이다`);
  for (const 파일 of 매니페스트.files) {
    assert.match(파일.sha256, /^[0-9a-f]{64}$/);
    assert.ok(파일.bytes > 0);
    assert.match(파일.target_path, /^(templates|docs)\//, `옮길 자리가 이상하다: ${파일.target_path}`);
  }
});

test('★원본이 git 이 아니라는 사실을 숨기지 않는다', () => {
  /** ★실측: C:/dev/docshub 는 저장소가 아니고(추적 0), 원격 docshub 는 파일 6개뿐이다.
   *  그래서 기존 판정의 revision 은 이 자산의 정본이 아니며, 해시로 고정할 수밖에 없다. */
  assert.equal(매니페스트.source.kind, 'LOCAL_FOLDER');
  assert.equal(매니페스트.source.git, 'NOT_A_REPOSITORY');
  assert.match(매니페스트.source.note, /저장소가 아니다/);
  assert.match(감사, /revision 이 존재하지 않는다|정본이 아니다/, '감사 문서가 이 어긋남을 적어야 한다');
});

test('★고객·사건 정보는 목록에 없다', () => {
  assert.ok(매니페스트.scope.excluded.some((x) => /사건/.test(x)));
  assert.ok(매니페스트.scope.excluded.some((x) => /registry\.js/.test(x)), '문서 카탈로그는 사건명을 담는다');
  for (const 파일 of 매니페스트.files) {
    assert.doesNotMatch(파일.source_path, /^(사건|업무|_레거시)\//, `대상에 들어가면 안 된다: ${파일.source_path}`);
    assert.ok(!/registry\.js$|schedule\.js$/.test(파일.source_path), `카탈로그가 목록에 있다: ${파일.source_path}`);
  }
  assert.match(매니페스트.personal_data_check.result, /자리표시자/, '개인정보 확인 결과가 있어야 한다');
});

test('★선언된 규격 넷이 부팅 경로에 없다 — 고치면 이 검사가 줄어든다', () => {
  const 연결 = 매니페스트.spec_wiring;
  assert.deepEqual(
    [...연결.unregistered].sort(),
    ['거래', '계약', '범용', '증명'],
    `미등록 규격이 바뀌었다 — 감사 문서를 같이 고쳐라. 지금: ${연결.unregistered.join(', ')}`
  );
  for (const 이름 of 연결.unregistered) {
    assert.ok(감사.includes(이름), `미등록 규격 ${이름} 이 감사 문서에 없다`);
  }
  /** 등록된 것은 열 개뿐이고, 그중 하나는 «규격 없음»을 뜻하는 custom 이다. */
  assert.ok(연결.registered_in_doc_js.includes('custom'));
  assert.ok(연결.registered_in_doc_js.length >= 9);
});

test('★빈 틀 17장이 저장소 자신의 금지(인라인 style)를 어기고 있다', () => {
  const 연결 = 매니페스트.spec_wiring;
  assert.equal(연결.inline_style_templates.length, 17, '인라인 style 수가 바뀌었다 — 감사 문서를 같이 고쳐라');
  assert.equal(연결.single_file_variants_exempt.length, 4, '한 장으로 묶는 변형은 설계상 예외다');
  for (const 이름 of 연결.single_file_variants_exempt) assert.match(이름, /_한파일\.html$/);
  assert.match(감사, /17장/);
});
