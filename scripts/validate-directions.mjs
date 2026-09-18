import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateDirectionRegistrySemantics } from '../src/engine/direction-registry.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const [schema, registry] = await Promise.all([
  readFile(resolve(root, 'contracts/direction-registry.schema.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, process.argv[2] ?? 'registry/directions.json'), 'utf8').then(JSON.parse),
]);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(registry)) {
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}
try {
  const result = validateDirectionRegistrySemantics(registry);
  console.log(`PASS: directions ${result.count} total / ${result.active} active / ${result.draft} draft`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
