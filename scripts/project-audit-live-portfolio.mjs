import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectGitHubProject } from '../src/engine/github-project-inspector.mjs';
import { buildLiveProjectAuditPortfolio } from '../src/engine/project-audit-live-portfolio.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const auditsDir = resolve(root, 'docs/audits');

const [readinessRegistry, projectRegistry, names] = await Promise.all([
  readFile(resolve(root, 'registry/project-audit-readiness.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'registry/projects.json'), 'utf8').then(JSON.parse),
  readdir(auditsDir),
]);

const auditResults = [];
for (const name of names.filter(name => name.endsWith('.json')).sort()) {
  try {
    const parsed = JSON.parse(await readFile(resolve(auditsDir, name), 'utf8'));
    if (parsed?.schema === 'ai-core-project-audit-result/v1' || parsed?.schema === 'ai-core-project-audit-result/v2') {
      auditResults.push(parsed);
    }
  } catch {}
}

const report = await buildLiveProjectAuditPortfolio({
  readinessRegistry,
  projectRegistry,
  auditResults,
  inspectProject: inspectGitHubProject,
});

process.stdout.write(JSON.stringify(report, null, 2) + '\n');

if (process.argv.includes('--require-current') && report.totals.live_re_audit_required > 0) {
  process.exitCode = 1;
}
