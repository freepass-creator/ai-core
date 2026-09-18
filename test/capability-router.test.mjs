import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeCapability } from '../src/engine/capability-router.mjs';

const capabilityRegistry = JSON.parse(await readFile(new URL('../registry/capabilities.json', import.meta.url), 'utf8'));
const projectRegistry = JSON.parse(await readFile(new URL('../registry/projects.json', import.meta.url), 'utf8'));

const route = text => routeCapability({ text, capabilityRegistry, projectRegistry });

test('과태료 처리 요청은 AIOps 준비 엔진으로 간다', () => {
  const r = route('과태료 처리해');
  assert.equal(r.status, 'ROUTED');
  assert.equal(r.capability_id, 'operations.penalty.prepare');
  assert.equal(r.project_id, 'aiops');
});

test('과태료 실행기록 검증은 실행이 아니라 감사 adapter로 간다', () => {
  const r = route('과태료 실행기록 검증해');
  assert.equal(r.status, 'ROUTED');
  assert.equal(r.capability_id, 'operations.penalty.audit');
  assert.equal(r.project_id, 'aiops');
});

test('프로젝트 이름과 테스트 의도를 같이 읽는다', () => {
  const r = route('freepasserp4 테스트 돌려');
  assert.equal(r.status, 'ROUTED');
  assert.equal(r.capability_id, 'project.verify');
  assert.equal(r.project_id, 'freepasserp4');
});

test('빌드 요청은 test와 섞지 않는다', () => {
  const r = route('freepasserp4 빌드 해');
  assert.equal(r.status, 'ROUTED');
  assert.equal(r.capability_id, 'project.build');
  assert.equal(r.project_id, 'freepasserp4');
});

test('대표용 오늘 브리핑 요청을 core.brief로 보낸다', () => {
  const r = route('오늘 내가 볼 거 뭐 있어?');
  assert.equal(r.status, 'ROUTED');
  assert.equal(r.capability_id, 'core.brief');
  assert.equal(r.project_id, 'ai-core');
});

test('등록되지 않은 업무는 그럴듯하게 추측하지 않는다', () => {
  const r = route('거래처에 메일 보내');
  assert.equal(r.status, 'NO_MATCH');
});

test('명시 project hint가 틀리면 capability를 억지로 고르지 않는다', () => {
  const r = routeCapability({ text: '테스트 돌려', projectHint: '없는프로젝트', capabilityRegistry, projectRegistry });
  assert.equal(r.status, 'UNKNOWN_PROJECT');
});
