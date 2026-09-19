import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateUiUxRegistrySemantics } from '../src/engine/ui-ux-registry.mjs';

const registry = JSON.parse(
  await readFile(new URL('../registry/ui-ux-features.json', import.meta.url), 'utf8')
);

test('universal UI/UX registry covers the required common feature families', () => {
  const result = validateUiUxRegistrySemantics(registry);
  assert.equal(result.status, 'VALID');
  assert.ok(result.count >= 40);
  assert.equal(result.families, 9);
  assert.ok(result.profiles >= 8);
});

test('a product cannot fork a common feature into optional adoption', () => {
  const broken = structuredClone(registry);
  broken.features[0].adoption = 'OPTIONAL';
  assert.throws(() => validateUiUxRegistrySemantics(broken), /UIUX_FEATURE_NOT_REQUIRED/);
});

test('engine and adapter surfaces require explicit bindings', () => {
  const brokenEngine = structuredClone(registry);
  delete brokenEngine.features.find((item) => item.id === 'integration.engine-job').engine_binding;
  assert.throws(() => validateUiUxRegistrySemantics(brokenEngine), /UIUX_ENGINE_BINDING_REQUIRED/);

  const brokenAdapter = structuredClone(registry);
  delete brokenAdapter.features.find((item) => item.id === 'integration.adapter-connection').adapter_binding;
  assert.throws(() => validateUiUxRegistrySemantics(brokenAdapter), /UIUX_ADAPTER_BINDING_REQUIRED/);
});

test('all feature profiles must resolve to a canonical shared profile', () => {
  const broken = structuredClone(registry);
  broken.features.find((item) => item.id === 'form.file-upload').profiles.push('LOCAL_MAGIC');
  assert.throws(() => validateUiUxRegistrySemantics(broken), /UIUX_UNKNOWN_PROFILE/);
});
