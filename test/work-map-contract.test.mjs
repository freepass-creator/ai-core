import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

const schema = await readJson('contracts/work-map.schema.json');
const canonical = await readJson('registry/work-map.json');

function validate(value) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const check = ajv.compile(schema);
  return { valid: check(value), errors: check.errors };
}

test('shared work map contract accepts a non-DevCenter map without hub_routes', () => {
  const { hub_routes: _devCenterExtension, ...genericWorkMap } = canonical;
  const result = validate(genericWorkMap);

  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('shared work map contract still accepts the canonical map with hub_routes', () => {
  const result = validate(canonical);

  assert.equal(result.valid, true, JSON.stringify(result.errors));
});
