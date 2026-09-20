import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { evaluateReleaseAutomation } from '../src/governance/release-automation.mjs';

function argument(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const manifestPath = argument('manifest', 'registry/releases/ai-core.json');
const outputPath = argument('output', '.release/status.json');
const [schema, manifest] = await Promise.all([
  readFile(resolve('contracts/release-automation-manifest.schema.json'), 'utf8').then(JSON.parse),
  readFile(resolve(manifestPath), 'utf8').then(JSON.parse)
]);
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(manifest)) {
  console.error(JSON.stringify({ status: 'HOLD', failures: ['MANIFEST_SCHEMA_INVALID'], errors: validate.errors }, null, 2));
  process.exit(1);
}

const context = {
  event: argument('event', process.env.GITHUB_EVENT_NAME),
  ref: argument('ref', process.env.GITHUB_REF),
  revision: argument('revision', process.env.GITHUB_SHA),
  repository: argument('repository', process.env.GITHUB_REPOSITORY),
  attempt: Number(argument('attempt', process.env.GITHUB_RUN_ATTEMPT ?? '1')),
  available_secret_names: (argument('available-secrets', '') ?? '').split(',').filter(Boolean)
};
const evaluation = evaluateReleaseAutomation(manifest, context);
const status = {
  schema_version: 'release-automation-status/v1',
  project_id: manifest.project_id,
  repository: manifest.repository,
  canonical_branch: manifest.canonical_branch,
  revision: context.revision,
  event: context.event,
  ref: context.ref,
  ...evaluation
};
await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(resolve(outputPath), `${JSON.stringify(status, null, 2)}\n`);
console.log(JSON.stringify(status, null, 2));
if (argument('strict') === 'true' && status.status === 'HOLD') process.exitCode = 1;
