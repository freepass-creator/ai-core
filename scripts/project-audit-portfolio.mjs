import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProjectAuditPortfolio } from '../src/engine/project-audit-portfolio.mjs';

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
  } catch {
    // Ignore unrelated audit JSON documents.
  }
}

const portfolio = buildProjectAuditPortfolio({
  readinessRegistry,
  projectRegistry,
  auditResults,
});

process.stdout.write(JSON.stringify(portfolio, null, 2) + '\n');

if (process.argv.includes('--require-clean')) {
  if (
    portfolio.totals.freshness_review_required > 0 ||
    portfolio.totals.re_audit_candidate > 0 ||
    portfolio.totals.ci_fail > 0 ||
    portfolio.totals.ci_unknown > 0
  ) {
    process.exitCode = 1;
  }
}
