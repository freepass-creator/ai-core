import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateCapabilityRegistryReferences } from '../src/engine/capability-registry.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const registryPath = resolve(root, process.argv[2] ?? 'registry/capabilities.json');
const [schema, registry, projects] = await Promise.all([
  readFile(resolve(root, 'contracts/capability-registry.schema.json'), 'utf8').then(JSON.parse),
  readFile(registryPath, 'utf8').then(JSON.parse),
  readFile(resolve(root, 'registry/projects.json'), 'utf8').then(JSON.parse),
]);

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(registry)) {
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}
try {
  const result = validateCapabilityRegistryReferences(registry, projects);
  console.log(`PASS: capability registry ${result.capability_count} capabilities / ${result.project_count} projects`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
