import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeProjectAuditResult, validateProjectAuditResult } from '../src/engine/project-audit-result.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/project-audit.mjs <audit-result.json>');
  process.exit(2);
}

const [readiness, result] = await Promise.all([
  readFile(resolve(root, 'registry/project-audit-readiness.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, input), 'utf8').then(JSON.parse),
]);

try {
  validateProjectAuditResult(result, readiness);
  const summary = summarizeProjectAuditResult(result, readiness);
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');

  if (process.argv.includes('--require-no-gaps') && summary.status !== 'READ_ONLY_AUDIT_COMPLETE') {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(JSON.stringify({
    status: 'INVALID',
    code: error?.message ?? 'PROJECT_AUDIT_VALIDATION_FAILED',
    input,
  }));
  process.exitCode = 1;
}
