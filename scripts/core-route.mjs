import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeCapability } from '../src/engine/capability-router.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const projectAt = args.indexOf('--project');
const projectHint = projectAt >= 0 ? args[projectAt + 1] : null;
const textArgs = args.filter((_, i) => i !== projectAt && i !== projectAt + 1);
const text = textArgs.join(' ').trim();
if (!text) {
  console.error('사용법: npm run core:route -- "과태료 처리해" [--project aiops]');
  process.exit(2);
}
const [capabilityRegistry, projectRegistry] = await Promise.all([
  readFile(resolve(root, 'registry/capabilities.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'registry/projects.json'), 'utf8').then(JSON.parse),
]);
console.log(JSON.stringify(routeCapability({ text, projectHint, capabilityRegistry, projectRegistry }), null, 2));
