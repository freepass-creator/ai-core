import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCapabilityEngine } from '../src/engine/capability-engine.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const argv = process.argv.slice(2);
const action = argv.shift();
if (!['plan', 'run'].includes(action)) {
  console.error('사용법: npm run core:capability -- plan|run "요청" [--project ID] [--input FILE.json] [--perform]');
  process.exit(2);
}
const projectAt = argv.indexOf('--project');
const inputAt = argv.indexOf('--input');
const projectHint = projectAt >= 0 ? argv[projectAt + 1] : null;
const inputPath = inputAt >= 0 ? argv[inputAt + 1] : null;
const perform = argv.includes('--perform');
const skipped = new Set([projectAt, projectAt + 1, inputAt, inputAt + 1, argv.indexOf('--perform')].filter(i => i >= 0));
const text = argv.filter((_, i) => !skipped.has(i)).join(' ').trim();
if (!text) {
  console.error('요청 문장이 필요합니다.');
  process.exit(2);
}
const [capabilityRegistry, projectRegistry, input] = await Promise.all([
  readFile(resolve(root, 'registry/capabilities.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'registry/projects.json'), 'utf8').then(JSON.parse),
  inputPath ? readFile(resolve(inputPath), 'utf8').then(JSON.parse) : Promise.resolve({}),
]);
const engine = createCapabilityEngine({ capabilityRegistry, projectRegistry });
const result = action === 'plan'
  ? engine.plan({ text, projectHint })
  : await engine.run({ text, projectHint, input, perform });
console.log(JSON.stringify(result, null, 2));
if (result.status === 'HOLD' || result.status === 'FAILED') process.exitCode = 1;
