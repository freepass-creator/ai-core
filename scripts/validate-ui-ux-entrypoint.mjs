import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateUiUxEntrypointSemantics } from '../src/engine/ui-ux-entrypoint.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const [schema, entry] = await Promise.all([
  readFile(resolve(root, 'contracts/ui-ux-entrypoint.schema.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, process.argv[2] ?? 'registry/ui-ux-entrypoint.json'), 'utf8').then(JSON.parse)
]);

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

if (!validate(entry)) {
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}

try {
  const result = validateUiUxEntrypointSemantics(entry);
  console.log(
    'PASS: UI/UX canonical entrypoint ' +
    result.readSources + ' sources / ' +
    result.sequenceSteps + ' steps / ' +
    result.failClosedRules + ' fail-closed rules'
  );
} catch (error) {
  console.error('FAIL: ' + error.message);
  process.exit(1);
}
