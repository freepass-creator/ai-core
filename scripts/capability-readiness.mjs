import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessCapabilityReadiness } from '../src/engine/capability-readiness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const [capabilityRegistry, projectRegistry] = await Promise.all([
  readJson(join(root, 'registry', 'capabilities.json')),
  readJson(join(root, 'registry', 'projects.json')),
]);

const report = assessCapabilityReadiness({ capabilityRegistry, projectRegistry });
const holdOnly = process.argv.includes('--hold-only');
const output = holdOnly
  ? { ...report, items: report.items.filter(item => item.status === 'HOLD') }
  : report;

console.log(JSON.stringify(output, null, 2));

if (process.argv.includes('--fail-on-active-gap') && report.summary.active_with_gap > 0) {
  process.exitCode = 1;
}
