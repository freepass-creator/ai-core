import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorkMap } from '../src/routing/work-router.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mapPath = args[0] ?? join(root, 'registry', 'work-map.json');
const registryPath = args[1] ?? join(root, 'registry', 'projects.json');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const result = validateWorkMap(await readJson(mapPath), await readJson(registryPath));
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'VALID') process.exitCode = 1;
