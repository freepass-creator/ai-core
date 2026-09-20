import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProjectAuditRefreshQueue } from '../src/engine/project-audit-refresh-queue.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const auditsDir = resolve(root, 'docs/audits');

const [readinessRegistry, projectRegistry, names] = await Promise.all([
  readFile(resolve(root, 'registry/project-audit-readiness.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'registry/projects.json'), 'utf8').then(JSON.parse),
  readdir(auditsDir),
]);

const auditResults = [];
for (const name of names.filter(name => name.endsWith('.json')).sort()) {
  const path = resolve(auditsDir, name);
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    if (parsed?.schema === 'ai-core-project-audit-result/v1') {
      auditResults.push(parsed);
    }
  } catch {
    // Ignore non-audit JSON or malformed unrelated portfolio files here.
  }
}

const queue = buildProjectAuditRefreshQueue({
  readinessRegistry,
  projectRegistry,
  auditResults,
});

process.stdout.write(JSON.stringify(queue, null, 2) + '\n');

if (process.argv.includes('--require-clean') && queue.totals.action_required > 0) {
  process.exitCode = 1;
}

if (process.argv.includes('--show-files')) {
  process.stderr.write(
    names
      .filter(name => name.endsWith('.json'))
      .map(name => relative(root, resolve(auditsDir, name)))
      .join('\n') + '\n',
  );
}
