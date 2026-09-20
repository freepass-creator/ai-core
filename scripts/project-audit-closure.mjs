import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectGitHubProject } from '../src/engine/github-project-inspector.mjs';
import { assessProjectAuditFreshness } from '../src/engine/project-audit-freshness.mjs';
import { buildProjectAuditClosureReceipt, renderProjectAuditClosureMarkdown } from '../src/engine/project-audit-closure.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const handoffPath = args[0];
const completionPath = args[1];
const successorAt = args.indexOf('--successor');
const successorPath = successorAt >= 0 ? args[successorAt + 1] : null;
const formatAt = args.indexOf('--format');
const outputAt = args.indexOf('--output');
const outputPath = outputAt >= 0 ? args[outputAt + 1] : null;
const format = formatAt >= 0
  ? args[formatAt + 1]
  : (outputPath && extname(outputPath).toLowerCase() === '.md' ? 'md' : 'json');
const requireClosed = args.includes('--require-closed');

if (!handoffPath || !completionPath) {
  console.error('usage: npm run audit:closure -- <handoff.json> <completion.json> [--successor audit.json] [--format json|md] [--output path] [--require-closed]');
  process.exit(2);
}
if (!['json','md'].includes(format)) {
  console.error('AUDIT_CLOSURE_FORMAT_INVALID');
  process.exit(2);
}

const [readinessRegistry, projectRegistry, handoff, completionReport] = await Promise.all([
  readFile(resolve(root,'registry/project-audit-readiness.json'),'utf8').then(JSON.parse),
  readFile(resolve(root,'registry/projects.json'),'utf8').then(JSON.parse),
  readFile(resolve(handoffPath),'utf8').then(JSON.parse),
  readFile(resolve(completionPath),'utf8').then(JSON.parse),
]);

let successorAudit = null;
let liveFreshness = null;

if (successorPath) {
  successorAudit = JSON.parse(await readFile(resolve(successorPath),'utf8'));
  const registryProject = projectRegistry.projects.find(item => item.project_id === successorAudit.project_id) ?? null;
  const capsule = await inspectGitHubProject({
    project_id: successorAudit.project_id,
    repository: successorAudit.repository,
    default_branch: successorAudit.source_proof.default_branch,
  });
  liveFreshness = assessProjectAuditFreshness({
    result: successorAudit,
    readinessRegistry,
    capsule,
    registryProject,
  });
}

const receipt = buildProjectAuditClosureReceipt({
  handoff,
  completionReport,
  readinessRegistry,
  successorAudit,
  liveFreshness,
});

const rendered = format === 'md'
  ? renderProjectAuditClosureMarkdown(receipt)
  : JSON.stringify(receipt,null,2) + '\n';

if (outputPath) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = resolve(outputPath);
  await mkdir(dirname(path),{recursive:true});
  await writeFile(path,rendered,'utf8');
}

process.stdout.write(rendered);

if (requireClosed && receipt.status !== 'CLOSED_VERIFIED') {
  process.exitCode = 1;
}
