import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCapabilityRegistryReferences } from '../src/engine/capability-registry.mjs';

const capabilities = JSON.parse(await readFile(new URL('../registry/capabilities.json', import.meta.url), 'utf8'));
const projects = JSON.parse(await readFile(new URL('../registry/projects.json', import.meta.url), 'utf8'));

test('capability registry가 현재 project registry만 참조한다', () => {
  const result = validateCapabilityRegistryReferences(capabilities, projects);
  assert.equal(result.status, 'VALID');
  assert.ok(result.capability_count >= 8);
});

test('중복 capability id는 거절한다', () => {
  const broken = structuredClone(capabilities);
  broken.capabilities.push(structuredClone(broken.capabilities[0]));
  assert.throws(() => validateCapabilityRegistryReferences(broken, projects), /CAPABILITY_ID_INVALID_OR_DUPLICATE/);
});

test('EXTERNAL_MUTATION이 아닌 capability는 승인 scope를 가장하지 않는다', () => {
  const broken = structuredClone(capabilities);
  const item = broken.capabilities.find(x => x.id === 'project.verify');
  item.required_scopes = ['write'];
  assert.throws(() => validateCapabilityRegistryReferences(broken, projects), /NON_EXTERNAL_CAPABILITY_MUST_NOT_REQUIRE_AUTH_SCOPE/);
});
