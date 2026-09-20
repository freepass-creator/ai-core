import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateUiUxConsumerManifestSemantics } from '../src/engine/ui-ux-consumer-manifest.mjs';

const [schema, example, registry] = await Promise.all([
  readFile(new URL('../contracts/ui-ux-consumer-manifest.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../examples/ui-ux-consumer.manifest.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../registry/ui-ux-features.json', import.meta.url), 'utf8').then(JSON.parse)
]);

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

test('consumer manifest example is schema and semantic valid', () => {
  assert.equal(validate(example), true, JSON.stringify(validate.errors));
  const result = validateUiUxConsumerManifestSemantics(example, registry.features.map((x) => x.id));
  assert.equal(result.status, 'VALID');
  assert.equal(result.adoption_status, 'MAPPED');
});

test('consumer mapping cannot reference an unknown core feature', () => {
  const broken = structuredClone(example);
  broken.feature_bindings[0].feature_id = 'local.magic';
  assert.throws(
    () => validateUiUxConsumerManifestSemantics(broken, registry.features.map((x) => x.id)),
    /UIUX_CONSUMER_UNKNOWN_FEATURE/
  );
});

test('pilot requires the full shared viewport input and locale probe matrix', () => {
  const broken = structuredClone(example);
  broken.adoption_status = 'PILOT';
  assert.throws(() => validateUiUxConsumerManifestSemantics(broken), /UIUX_CONSUMER_PILOT_VIEWPORT_MISSING:412/);
});

test('conformant status requires canonical core receipts and no pending conformance', () => {
  const broken = structuredClone(example);
  broken.adoption_status = 'CONFORMANT';
  broken.verification.viewports = [360, 390, 412, 1280, 1440];
  broken.verification.input_modes = ['keyboard', 'touch', 'pointer', 'ime-composition'];
  broken.verification.locales = ['ko-KR', 'en-US', 'de-DE', 'ar-SA'];
  assert.throws(() => validateUiUxConsumerManifestSemantics(broken), /UIUX_CONSUMER_CONFORMANT_CORE_NOT_CANONICAL/);
});
