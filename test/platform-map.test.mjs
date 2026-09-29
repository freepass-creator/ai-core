// 플랫폼은 둘이다 — 모든 프로젝트가 그 기준으로 «공백 없이» 나뉘어 있는지 지킨다.
//
// ★대표 2026-09-29: 「AI 코어와 AI 옵스를 남긴다 … 두 개로 가기로 했어」
//   범위는 «플랫폼만». 제품 저장소는 두 플랫폼이 관리하는 대상으로 남는다. AI Ops 는 kakao-ops 다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 읽기 = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const 지도 = 읽기('registry/platforms.json');
const 등록부 = 읽기('registry/projects.json');

test('★등록된 모든 프로젝트가 어느 한 통에 들어 있다 — 공백이 없다', () => {
  const 빠짐 = 등록부.projects.map((p) => p.project_id).filter((id) => !지도.projects[id]);
  assert.deepEqual(빠짐, [], '두 플랫폼 기준으로 분류되지 않은 프로젝트가 있다 — registry/platforms.json 에 넣어라');
});

test('지도에만 있고 등록부에 없는 이름이 없다 — 오타로 조용히 빠지지 않게', () => {
  const 있는것 = new Set(등록부.projects.map((p) => p.project_id));
  const 헛이름 = Object.keys(지도.projects).filter((id) => !있는것.has(id));
  assert.deepEqual(헛이름, []);
});

test('통은 정해진 여섯 개뿐이다 — 「미정」이나 「기타」가 없다', () => {
  const 허용 = new Set(Object.keys(지도.buckets));
  for (const [id, p] of Object.entries({ ...지도.projects, ...지도.not_in_project_registry })) {
    assert.ok(허용.has(p.bucket), `${id} 의 통 «${p.bucket}» 은 정해진 통이 아니다`);
  }
});

test('★플랫폼은 정확히 둘이다 — AI Core 하나, AI Ops 하나', () => {
  const 코어 = Object.entries(지도.projects).filter(([, p]) => p.bucket === 'PLATFORM_CORE').map(([id]) => id);
  const 옵스 = Object.entries(지도.projects).filter(([, p]) => p.bucket === 'PLATFORM_OPS').map(([id]) => id);
  assert.deepEqual(코어, ['ai-core']);
  assert.deepEqual(옵스, ['kakao-ops'], 'AI Ops 는 kakao-ops 다(대표 선택)');
});

test('★기존 aiops 는 AI Ops 가 아니라 «데이터 소유 서비스»다 — 처음 판단을 정정했다', () => {
  /** 2026-09-29 처음엔 ABSORB_INTO_OPS 로 적었다. 대표가 「딱 두 개가 아니라」고 지적했고,
   *  Codex 도 「정본 데이터는 AI Ops 와 분리한 도메인 소유 서비스가 맡아야 한다」고 했다.
   *  실행과 정본을 한 곳에 두면 실행 코드가 정본을 고치기 쉽다. */
  assert.equal(지도.projects.aiops.bucket, 'DATA_OWNER');
  assert.match(지도.projects.aiops.correction_2026_09_29, /틀렸다/, '틀렸던 판단을 지우면 같은 실수를 다시 한다');
  assert.match(지도.projects.aiops.risk, /전역 CLAUDE\.md/, '정본을 옮길 때 전역 지침 경로도 바꿔야 한다는 경고가 빠지면 세션마다 숫자가 엇갈린다');
});

test('★철칙이 적혀 있다 — 공통은 복사하지 않고 버전으로 소비한다', () => {
  assert.match(지도.iron_rule.rule, /복사하지 않고/);
  assert.ok(지도.iron_rule.bootstrap, '진입 문서가 규칙을 못 읽는 부트스트랩 반례에 대한 답이 없다');
});

test('공통의 종류는 다섯이고, 데이터는 플랫폼이 공급하지 않는다', () => {
  assert.deepEqual(Object.keys(지도.kinds).sort(), ['CODE', 'CONTRACTS', 'DATA', 'RULES', 'RUNTIME']);
  assert.match(지도.kinds.DATA.provider, /도메인 소유 서비스/);
  const 데이터소유 = Object.entries(지도.projects).filter(([, p]) => p.bucket === 'DATA_OWNER').map(([id]) => id).sort();
  assert.deepEqual(데이터소유, ['aiops', 'freepass-data']);
});

test('판단이 들어간 분류는 «확인 대기»라고 적혀 있다 — 조용히 확정된 것처럼 보이지 않게', () => {
  for (const id of ['aiops', 'docshub', 'workcontrol']) {
    assert.match(지도.projects[id].confirm ?? '', /대표 확인/, `${id} 는 대표 확인이 필요한 판단인데 표시가 없다`);
  }
});
