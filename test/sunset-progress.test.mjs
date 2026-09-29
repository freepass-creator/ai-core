// 「지울 수 있는 준비」가 «되고 있나»를 지킨다. 말로는 늘 되는 중이다 — 숫자로 본다.
//
// ★대표 2026-09-29: 「여기 종착역은 통합해서 개발센터·aiops·문서허브 폴더 다 삭제하는 거야」
//                   「ㅇㅇ 그러니까 삭제할 수 있는 준비를 하자고」
import test from 'node:test';
import assert from 'node:assert/strict';
import { 참조찾기, 준비도 } from '../src/governance/sunset.mjs';
import { 설정읽기, 저장소파일 } from '../scripts/check-sunset-progress.mjs';

const 설정 = 설정읽기();
const 모든구역 = 설정.areas.map((a) => a.path);

test('★끌어 쓰는 것과 이름만 부르는 것을 가른다 — 무게가 다르다', () => {
  const 파일 = [
    { path: 'src/x.mjs', text: "import y from '../aiops/lib/y.mjs';" },
    { path: 'docs/a.md', text: '예전에 aiops/lib 에 있었다' },
    { path: 'registry/catalog.json', text: '{"path":"aiops/lib/y.mjs"}' }
  ];
  const { 끌어씀, 언급 } = 참조찾기(파일, 'aiops/');
  assert.deepEqual(끌어씀, ['src/x.mjs'], '코드가 실제로 끌어 쓰는 것만 막는 것으로 센다');
  /** ★JSON 목록을 의존으로 세면 지워도 안 깨지는 것이 영원히 0 이 안 된다(2026-09-29 실측). */
  assert.deepEqual(언급.sort(), ['docs/a.md', 'registry/catalog.json']);
});

test('★일몰끼리의 참조는 막는 것으로 세지 않는다 — 같이 사라진다', () => {
  const 파일 = [
    { path: 'devcenter/z.mjs', text: "import q from '../aiops/q.mjs';" },
    { path: 'src/keep.mjs', text: "import q from '../aiops/q.mjs';" }
  ];
  const { 끌어씀, 일몰끼리 } = 참조찾기(파일, 'aiops/', ['aiops/', 'devcenter/']);
  assert.deepEqual(끌어씀, ['src/keep.mjs']);
  assert.deepEqual(일몰끼리, ['devcenter/z.mjs'], '둘 다 없어질 것이 서로를 붙잡으면 영원히 0 이 안 된다');
});

test('보존이 안 된 구역은 참조가 0 이어도 «지울 수 있다» 가 아니다', () => {
  const 없음 = { path: 'x/', preserved: false, baseline: { 끌어씀: 0, 언급: 0 } };
  assert.equal(준비도(없음, [], 0).지울수있나, false, '원본 없는 것을 참조만 보고 지우면 그냥 없어진다');
  const 있음 = { path: 'x/', preserved: true, baseline: { 끌어씀: 0, 언급: 0 } };
  assert.equal(준비도(있음, [], 0).지울수있나, true);
});

test('★devcenter 는 보존이 안 돼 있다는 사실이 정본에 남아 있다', () => {
  /** 파일 222개짜리인데 원본이 없다. 「통합 후 삭제」를 말할 때 이게 빠지면 그냥 소실이다. */
  const d = 설정.areas.find((a) => a.path === 'devcenter/');
  assert.equal(d.preserved, false);
  assert.ok(d.preserved_blocker?.includes('원본이 없다'), '막는 까닭이 없으면 다음 사람이 그냥 지운다');
});

test('★문서허브의 «옮길 수 없는 절반»이 정본에 남아 있다', () => {
  /** 업무·사건·_레거시 423개는 개인정보다. 「문서허브 폴더 삭제」가 여기로 번지면 안 된다. */
  const 갈림 = 설정.docshub_split;
  assert.ok(갈림.measured_2026_09_29.버전관리_불가.사건.발견.includes('실명'));
  assert.match(갈림.결론, /대상이 아니다/);
  assert.match(갈림.결론, /개인정보용 별도 보관소|제자리 보관/, '어디로 가야 하는지가 없으면 결국 누가 지운다');
});

test('★실제 저장소가 기준선을 넘지 않는다 — 이 수는 내려가기만 한다', () => {
  const { 목록, 본문 } = 저장소파일();
  const 넘은것 = 설정.areas
    .filter((a) => !a.retired_at)
    .map((a) => 준비도(a, 본문, 목록.filter((f) => f.startsWith(a.path)).length, 모든구역, 설정.self?.files ?? [], 설정.self?.record_prefixes ?? []))
    .filter((r) => r.넘음.끌어씀 || r.넘음.언급);
  assert.deepEqual(
    넘은것.map((r) => `${r.구역} 끌어씀+${r.넘음.끌어씀} 언급+${r.넘음.언급}`), [],
    '일몰 구역 참조가 늘었다 — 새로 끌어 쓰지 말고 옮겨 갈 자리에 써라'
  );
});

test('★재는 도구는 재는 대상에 안 잡힌다 — 그리고 그 제외는 «이름이 적혀» 있다', () => {
  /** 2026-09-29 실측: sunset.mjs 와 그 검사가 예시로 'aiops/' 를 적었다는 이유로 참조로 세어졌다.
   *  선언과 의존은 다르다. 다만 「기타」 통으로 빠져나가지 않게 파일 이름을 명시로 적는다. */
  assert.ok(설정.self?.files?.length > 0, '제외 목록이 없으면 도구가 스스로를 막는다');
  for (const f of 설정.self.files) assert.match(f, /sunset/, `일몰 측정과 무관한 파일이 제외에 들어갔다: ${f}`);
  const 파일 = [{ path: 'src/governance/sunset.mjs', text: "참조찾기(본문, 'aiops/')" }];
  assert.deepEqual(참조찾기(파일, 'aiops/', ['aiops/'], 설정.self.files).끌어씀, []);
});

test('★구역은 저장소 «뿌리» 폴더다 — 이름이 같은 다른 폴더를 세지 않고, 상대 import 는 놓치지 않는다', () => {
  /** 2026-09-29 에 두 번 틀렸다: 그냥 찾으니 docs/shared-services/ 를 잡았고(오탐),
   *  앞을 좁혔더니 '../shared-services/a.mjs' 를 놓쳤다(누락). 둘 다 여기서 고정한다. */
  const 판 = (text, path = 'src/x.mjs') => {
    const r = 참조찾기([{ path, text }], 'shared-services/');
    return r.끌어씀.length ? '끌어씀' : r.언급.length ? '언급' : '없음';
  };
  assert.equal(판("'docs/shared-services/SHARED.md'"), '없음', '다른 폴더를 일몰 구역으로 셌다');
  assert.equal(판("import a from '../shared-services/a.mjs'"), '끌어씀', '상대 import 를 놓쳤다');
  assert.equal(판("import a from './shared-services/a.mjs'"), '끌어씀');
  assert.equal(판("const p = 'shared-services/PROVENANCE.json'"), '끌어씀');
  assert.equal(판('예전엔 shared-services/ 에 있었다', 'docs/e.md'), '언급');
});

test('★지운 구역은 코드가 «절대» 끌어 쓰지 않는다 — 톱니가 아니라 0 이다', () => {
  /** 지우기 전에는 줄어드는지를 보고, 지운 뒤에는 0 만 본다. 없는 경로를 끌어 쓰면 그건 고장이다.
   *  문서의 언급은 세지 않는다 — 「9/22 에 aiops 를 복사해 왔다」는 참인 역사다. */
  const { 본문 } = 저장소파일();
  for (const a of 설정.areas.filter((x) => x.retired_at)) {
    const { 끌어씀 } = 참조찾기(본문, a.path, 모든구역, 설정.self?.files ?? [], 설정.self?.record_prefixes ?? []);
    assert.deepEqual(끌어씀, [], `${a.path} 는 ${a.retired_at} 에 지웠는데 코드가 아직 끌어 쓴다`);
  }
});

test('지운 구역에는 «어떻게 지웠는지»가 남아 있다', () => {
  for (const a of 설정.areas.filter((x) => x.retired_at)) {
    assert.ok(a.retired_how?.length > 40, `${a.path} 를 왜·어떻게 지웠는지 없으면 다음 사람이 되살린다`);
  }
});
