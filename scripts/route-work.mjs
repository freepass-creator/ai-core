import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeWork, validateWorkMap } from '../src/routing/work-router.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const query = args.join(' ').trim();
if (!query) {
  console.error('Usage: npm run ops:route -- "<natural language request>"');
  process.exit(2);
}

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const workMap = await readJson(join(root, 'registry', 'work-map.json'));
const projectRegistry = await readJson(join(root, 'registry', 'projects.json'));
const capabilityRegistry = await readJson(join(root, 'registry', 'capabilities.json'));
const validation = validateWorkMap(workMap, projectRegistry, capabilityRegistry);
if (validation.status !== 'VALID') {
  console.error(JSON.stringify(validation, null, 2));
  process.exit(2);
}

const result = routeWork(query, { workMap, projectRegistry, capabilityRegistry });
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'RESOLVED') process.exitCode = 1;
