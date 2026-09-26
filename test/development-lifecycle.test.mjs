import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('development lifecycle has exactly ten ordered stages', async () => {
  const lifecycle = JSON.parse(await read('registry/development-lifecycle.json'));
  assert.equal(lifecycle.schema, 'ai-core-development-lifecycle/v1');
  assert.equal(lifecycle.stages.length, 10);
  assert.deepEqual(
    lifecycle.stages.map(s => s.id),
    ['DEV-01','DEV-02','DEV-03','DEV-04','DEV-05','DEV-06','DEV-07','DEV-08','DEV-09','DEV-10']
  );
  assert.deepEqual(
    lifecycle.stages.map(s => s.name),
    ['MAIN','BRANCH','CODE','TEST','COMMIT','PR','CI','MERGE','BUILD','RELEASE']
  );
});

test('lifecycle preserves loops and production truth', async () => {
  const lifecycle = JSON.parse(await read('registry/development-lifecycle.json'));
  assert.deepEqual(lifecycle.model.repeatable_loop, ['DEV-03','DEV-04','DEV-05']);
  assert.deepEqual(lifecycle.model.ci_failure_returns_to, ['DEV-03','DEV-04','DEV-05']);
  assert.equal(lifecycle.model.production_is_a_state_not_a_separate_number, true);
  assert.match(lifecycle.reporting.format, /DEV-XX\/10/);
});

test('human development standard exposes the same numbered vocabulary', async () => {
  const body = await read('docs/DEVELOPMENT_CONTINUITY_STANDARD.md');
  for (const token of ['DEV-01 MAIN','DEV-02 BRANCH','DEV-03 CODE','DEV-04 TEST','DEV-05 COMMIT','DEV-06 PR','DEV-07 CI','DEV-08 MERGE','DEV-09 BUILD','DEV-10 RELEASE']) {
    assert.ok(body.includes(token), `missing lifecycle token: ${token}`);
  }
  assert.match(body, /현재 단계: DEV-07\/10 CI/);
  assert.match(body, /다음 단계: DEV-08\/10 MERGE/);
  assert.match(body, /DONE \/ IN_PROGRESS \/ N\/A \/ HOLD/);
  assert.match(body, /N\/A — 배포 대상 없음/);
});

test('AI work result requires development stage reporting', async () => {
  const body = await read('docs/AI_WORKING_STANDARD.md');
  assert.match(body, /개발단계: 개발 작업이면 `DEV-XX\/10 NAME`/);
  assert.match(body, /registry\/development-lifecycle\.json/);
});
