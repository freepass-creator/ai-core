import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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
  const binding = JSON.parse(await readFile(resolve(root, entry.execution.design_hub_binding), 'utf8'));
  if (binding.contract !== 'ai-core-design-hub-binding/v2') throw new Error('DESIGN_HUB_BINDING_CONTRACT_INVALID');
  const entries = Object.entries(binding.sources ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) throw new Error('DESIGN_HUB_BINDING_SOURCES_EMPTY');
  for (const [key, source] of entries) {
    const text = (await readFile(resolve(root, source.path), 'utf8')).replaceAll('\r\n', '\n');
    const actual = createHash('sha256').update(text).digest('hex');
    if (actual !== source.sha256) throw new Error(`DESIGN_HUB_SOURCE_DIGEST_MISMATCH:${key}`);
  }
  const payload = entries.map(([, source]) => `${source.path}:${source.sha256}`).join('\n');
  const bundle = createHash('sha256').update(payload).digest('hex');
  if (bundle !== binding.ai_core?.source_bundle_sha256) throw new Error('DESIGN_HUB_BUNDLE_DIGEST_MISMATCH');
  console.log(
    'PASS: UI/UX canonical entrypoint ' +
    result.readSources + ' sources / ' +
    result.sequenceSteps + ' steps / ' +
    result.failClosedRules + ' fail-closed rules / source bundle ' + bundle
  );
} catch (error) {
  console.error('FAIL: ' + error.message);
  process.exit(1);
}
