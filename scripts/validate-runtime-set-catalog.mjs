import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateRuntimeSetCatalog } from '../src/engine/runtime-set-catalog.mjs';

const path = resolve(process.argv[2] ?? 'registry/runtime-sets.candidate.json');
try {
  const catalog = JSON.parse(await readFile(path, 'utf8'));
  const result = validateRuntimeSetCatalog(catalog);
  console.log(`PASS: runtime set catalog valid (${result.component_count} components, ${result.runtime_set_count} sets)`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
