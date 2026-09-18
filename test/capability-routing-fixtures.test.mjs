import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeCapability } from '../src/engine/capability-router.mjs';

const fixtures = JSON.parse(await readFile(new URL('../registry/routing-fixtures.json', import.meta.url), 'utf8'));
const capabilityRegistry = JSON.parse(await readFile(new URL('../registry/capabilities.json', import.meta.url), 'utf8'));
const projectRegistry = JSON.parse(await readFile(new URL('../registry/projects.json', import.meta.url), 'utf8'));

test('대표식 자연어 fixture 20개가 정해진 경로 또는 NO_MATCH로만 간다', () => {
  assert.equal(fixtures.schema, 'ai-core-routing-fixtures/v1');
  assert.equal(fixtures.cases.length, 20);
  for (const item of fixtures.cases) {
    const result = routeCapability({ text: item.text, capabilityRegistry, projectRegistry });
    if (item.status) {
      assert.equal(result.status, item.status, item.text);
      continue;
    }
    assert.equal(result.status, 'ROUTED', item.text);
    assert.equal(result.capability_id, item.capability_id, item.text);
    assert.equal(result.project_id, item.project_id, item.text);
  }
});
