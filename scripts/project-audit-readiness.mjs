import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessProjectAuditReadiness } from '../src/engine/project-audit-readiness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(await readFile(resolve(root, 'registry/project-audit-readiness.json'), 'utf8'));
const report = assessProjectAuditReadiness(registry);
process.stdout.write(JSON.stringify(report, null, 2) + '\n');

if (process.argv.includes('--require-full') && !report.full_conformance_ready) process.exitCode = 1;
if (process.argv.includes('--require-pilot') && report.status !== 'READ_ONLY_AUDIT_PILOT_READY') process.exitCode = 1;
