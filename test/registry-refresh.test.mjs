import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryRefresh, 끝값 } from '../scripts/registry-refresh.mjs';
import { validateProjectRegistry } from '../scripts/validate-project-registry.mjs';

// GPT_REVIEW(2026-09-18 08:30, PR #29) 가 요구한 반례 넷:
//   ① 다른 갈래 체크아웃 ② 잘못된 형제 경로 ③ 원격 관측 실패 ④ 진짜 낡은 등록부

const 뿌리 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 진짜등록부 = async () => JSON.parse(await readFile(resolve(뿌리, 'registry/projects.json'), 'utf8'));
const NOW = new Date('2026-09-18T03:00:00.000Z');
const 원격 = (id) => id.charCodeAt(0).toString(16).padStart(2, '0').repeat(20);

test('① 로컬 체크아웃이 다른 갈래여도 «원격 기본 갈래» 만 적는다', async () => {
  const 등록부 = await 진짜등록부();
  // 이 검사가 도는 체크아웃 자체를 local_path 로 준다 — 그 HEAD 는 원격 main 과 다를 수 있다.
  const 로컬HEAD = execFileSync('git', ['-C', 뿌리, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  for (const 프 of 등록부.projects) 프.local_path = 뿌리;
  const 부른것 = [];
  const { 모름 } = registryRefresh(등록부, { now: NOW, observe: (repo, branch) => { 부른것.push([repo, branch]); return 원격(repo.split('/')[1]); } });
  assert.deepEqual(모름, []);
  assert.deepEqual(부른것, 등록부.projects.map((p) => [p.repository, p.default_branch]));
  for (const 프 of 등록부.projects) {
    assert.equal(프.head_revision, 원격(프.repository.split('/')[1]));
    assert.notEqual(프.head_revision, 로컬HEAD);
  }
});

test('② 형제 폴더가 없어도(잘못된 경로) 원격에서 읽는다 — 폴더는 보지 않는다', async () => {
  const 등록부 = await 진짜등록부();
  for (const 프 of 등록부.projects) { 프.project_id = `없는-폴더-${프.project_id}`; 프.local_path = 'Z:\\nowhere'; }
  const { 모름 } = registryRefresh(등록부, { now: NOW, observe: () => 'a'.repeat(40) });
  assert.deepEqual(모름, []);
  assert.ok(등록부.projects.every((p) => p.head_revision === 'a'.repeat(40)));
});

test('③ 원격을 못 보면 UNKNOWN — 성공으로 넘기지 않고 값도 덮지 않는다', async () => {
  for (const 실패 of [() => { throw new Error('auth'); }, () => null, () => '', () => 'not-a-sha', () => 'A'.repeat(40)]) {
    const 등록부 = await 진짜등록부();
    const 전 = structuredClone(등록부);
    const 결과 = registryRefresh(등록부, { now: NOW, observe: 실패 });
    assert.equal(결과.모름.length, 등록부.projects.length);
    assert.ok(결과.모름.every((m) => m.reason === 'REMOTE_UNOBSERVED'));
    assert.deepEqual(등록부, 전, '못 본 것은 한 글자도 안 바뀐다 — observed_at 도');
    assert.equal(끝값(결과), 2, '--check 가 0 으로 끝나면 «못 봤다» 가 «새것이다» 로 둔갑한다');
  }
  const 등록부 = await 진짜등록부();
  delete 등록부.projects[0].default_branch;
  const 결과 = registryRefresh(등록부, { now: NOW, observe: () => 'a'.repeat(40) });
  assert.deepEqual(결과.모름, [{ project_id: 등록부.projects[0].project_id, reason: 'CANONICAL_REF_UNDECLARED' }]);
});

test('④ 진짜 낡은 등록부 — 고치고, 원천까지 묶고, 검증기를 통과한다', async () => {
  const 등록부 = await 진짜등록부();
  const 새것 = 'b'.repeat(40);
  const 결과 = registryRefresh(등록부, { now: NOW, observe: () => 새것 });
  assert.equal(결과.바뀜.length, 등록부.projects.length);
  assert.equal(끝값(결과), 1);
  for (const 프 of 등록부.projects) {
    assert.equal(프.head_revision, 새것);
    assert.ok(프.authoritative_sources.filter((s) => s.kind === 'GIT').every((s) => s.revision === 새것 && s.observed_at === '2026-09-18T03:00:00Z'));
  }
  assert.equal(등록부.observed_at, '2026-09-18T03:00:00Z');
  assert.equal(validateProjectRegistry(등록부).status, 'VALID');
  assert.equal(끝값(registryRefresh(등록부, { now: NOW, observe: () => 새것 })), 0, '고친 뒤 다시 보면 낡은 것 없음');
});

test('일부만 못 보면 canonical registry를 한 글자도 부분 갱신하지 않는다', async () => {
  const 등록부 = await 진짜등록부();
  const 전 = structuredClone(등록부);
  const 못볼것 = 등록부.projects[1].repository;
  const 결과 = registryRefresh(등록부, { now: NOW, observe: (repo) => (repo === 못볼것 ? null : 'c'.repeat(40)) });
  assert.equal(결과.모름.length, 1);
  assert.ok(결과.바뀜.length > 0, '관측된 stale 후보는 보고하되');
  assert.deepEqual(등록부, 전, 'UNKNOWN이 하나라도 있으면 canonical bytes 의미는 그대로여야 한다');
  assert.equal(끝값(결과), 2, 'mixed stale+UNKNOWN은 관측 불완전이 우선이다');
  assert.equal(validateProjectRegistry(등록부).status, 'VALID');
});
