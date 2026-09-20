import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateUiUxRuntimeSemantics } from '../src/engine/ui-ux-runtime.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

async function json(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}

const [
  tokenSchema,
  componentSchema,
  patternSchema,
  interactionSchema,
  governanceSchema,
  consumerSchema,
  screenSchema,
  featureRegistry,
  tokens,
  components,
  patterns,
  interactions,
  governance,
  consumers,
  screenManifest,
  tokenCss,
  legacyCss,
  runtimeCss
] = await Promise.all([
  json('contracts/design-token-ssot.schema.json'),
  json('contracts/ui-component-registry.schema.json'),
  json('contracts/ui-pattern-registry.schema.json'),
  json('contracts/ui-interaction-contract.schema.json'),
  json('contracts/ui-ux-governance.schema.json'),
  json('contracts/ui-ux-consumer-conformance.schema.json'),
  json('contracts/ui-screen-manifest.schema.json'),
  json('registry/ui-ux-features.json'),
  json('design-system/tokens.json'),
  json('design-system/components.registry.json'),
  json('design-system/patterns.registry.json'),
  json('design-system/interaction.contract.json'),
  json('registry/ui-ux-governance.json'),
  json('registry/ui-ux-consumers.json'),
  json('examples/ui-screen.manifest.json'),
  readFile(resolve(root, 'design-system/tokens.runtime.css'), 'utf8'),
  readFile(resolve(root, 'design-system/components.css'), 'utf8'),
  readFile(resolve(root, 'design-system/runtime-v2.css'), 'utf8')
]);

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

for (const [name, schema, value] of [
  ['tokens', tokenSchema, tokens],
  ['components', componentSchema, components],
  ['patterns', patternSchema, patterns],
  ['interactions', interactionSchema, interactions],
  ['governance', governanceSchema, governance],
  ['consumers', consumerSchema, consumers],
  ['screen', screenSchema, screenManifest]
]) {
  const validate = ajv.compile(schema);
  if (!validate(value)) {
    console.error(`FAIL: UIUX_${name.toUpperCase()}_SCHEMA`);
    console.error(JSON.stringify(validate.errors, null, 2));
    process.exit(1);
  }
}

try {
  const result = validateUiUxRuntimeSemantics({
    featureRegistry,
    tokens,
    components,
    patterns,
    interactions,
    governance,
    consumers,
    screenManifest,
    tokenCss,
    legacyCss,
    runtimeCss
  });
  console.log(
    `PASS: UI/UX runtime ${result.features} features / ${result.components} components / ` +
    `${result.patterns} patterns / ${result.screen_features} screen features / ` +
    `${result.interaction_rules} interaction rules / ${result.tokens} tokens / ` +
    `${result.governance_entries} governance entries / ${result.conformant_consumers} of ${result.consumers} consumers conformant`
  );
} catch (error) {
  console.error('FAIL: ' + error.message);
  process.exit(1);
}
