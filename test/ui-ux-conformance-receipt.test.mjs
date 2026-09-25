import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateUiUxConformanceReceiptSemantics } from '../src/engine/ui-ux-conformance-receipt.mjs';

const [schema, example, registry] = await Promise.all([
  readFile(new URL('../contracts/ui-ux-conformance-receipt.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../examples/ui-ux-conformance.receipt.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../registry/ui-ux-features.json', import.meta.url), 'utf8').then(JSON.parse)
]);

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const known = registry.features.map((x) => x.id);

test('pilot conformance receipt example is schema and semantic valid', () => {
  assert.equal(validate(example), true, JSON.stringify(validate.errors));
  const result = validateUiUxConformanceReceiptSemantics(example, known);
  assert.equal(result.status, 'VALID');
  assert.equal(result.claim_level, 'PILOT');
});

test('PASS receipt cannot hide a failed or held feature', () => {
  const broken = structuredClone(example);
  broken.feature_results[0].status = 'FAIL';
  assert.throws(() => validateUiUxConformanceReceiptSemantics(broken, known), /UIUX_RECEIPT_PASS_WITH_NONPASS_FEATURE/);
});

test('semantic validation cannot accept a receipt with no feature result evidence', () => {
  const broken = structuredClone(example);
  broken.feature_results = [];
  assert.equal(validate(broken), false);
  assert.throws(() => validateUiUxConformanceReceiptSemantics(broken, known), /UIUX_RECEIPT_FEATURE_RESULTS_REQUIRED/);
});

test('receipt cannot omit required globalization or device probes', () => {
  const broken = structuredClone(example);
  broken.required_matrix.locales = ['ko-KR', 'en-US', 'de-DE'];
  assert.throws(() => validateUiUxConformanceReceiptSemantics(broken, known), /UIUX_RECEIPT_LOCALE_MATRIX_INCOMPLETE/);
});

test('conformant receipt requires canonical AI Core', () => {
  const broken = structuredClone(example);
  broken.claim_level = 'CONFORMANT';
  assert.throws(() => validateUiUxConformanceReceiptSemantics(broken, known), /UIUX_RECEIPT_CONFORMANT_CORE_NOT_CANONICAL/);
});

test('receipt feature results must resolve to canonical feature ids', () => {
  const broken = structuredClone(example);
  broken.feature_results[0].feature_id = 'local.magic-feature';
  assert.throws(() => validateUiUxConformanceReceiptSemantics(broken, known), /UIUX_RECEIPT_UNKNOWN_FEATURE/);
});
