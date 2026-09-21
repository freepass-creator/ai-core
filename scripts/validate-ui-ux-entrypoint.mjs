import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  validateUiUxEntrypointSemantics,
  validateUiUxTargetBinding
} from '../src/engine/ui-ux-entrypoint.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);

function optionValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const preflight = args.includes('--preflight');
const designHubRoot = optionValue('--design-hub-root') ?? process.env.AI_CORE_DESIGN_HUB_ROOT;
const entryOption = optionValue('--entry');
const consumedValues = new Set([optionValue('--design-hub-root'), entryOption].filter(Boolean));
const positionalEntry = args.find(
  (arg) => !arg.startsWith('--') && !consumedValues.has(arg)
);
const entryPath = entryOption ?? positionalEntry ?? 'registry/ui-ux-entrypoint.json';

const [schema, entry] = await Promise.all([
  readFile(resolve(root, 'contracts/ui-ux-entrypoint.schema.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, entryPath), 'utf8').then(JSON.parse)
]);

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

if (!validate(entry)) {
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}

try {
  const result = validateUiUxEntrypointSemantics(entry);

  if (preflight) {
    if (!designHubRoot) {
      throw new Error('UIUX_PREFLIGHT_DESIGN_HUB_ROOT_REQUIRED');
    }

    const bindingPath = resolve(root, designHubRoot, entry.execution.design_hub_binding);
    const designHubBinding = JSON.parse(await readFile(bindingPath, 'utf8'));
    let coreRevision = process.env.AI_CORE_REVISION?.trim();

    if (!coreRevision) {
      try {
        coreRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          encoding: 'utf8'
        }).trim();
      } catch {
        throw new Error('UIUX_PREFLIGHT_CORE_REVISION_UNAVAILABLE');
      }
    }

    const targetResult = validateUiUxTargetBinding(entry, {
      coreRevision,
      designHubBinding
    });

    console.log(
      'PASS: UI/UX target preflight exact Design Hub binding ' +
      targetResult.coreRevision
    );
  } else {
    console.log(
      'PASS: UI/UX canonical entrypoint ' +
      result.readSources + ' sources / ' +
      result.sequenceSteps + ' steps / ' +
      result.failClosedRules + ' fail-closed rules'
    );
  }
} catch (error) {
  console.error('FAIL: ' + error.message);
  process.exit(1);
}
