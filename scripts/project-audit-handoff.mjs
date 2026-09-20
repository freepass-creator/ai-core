import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectGitHubProject } from '../src/engine/github-project-inspector.mjs';
import { assessProjectAuditFreshness } from '../src/engine/project-audit-freshness.mjs';
import { buildProjectAuditRefreshQueue } from '../src/engine/project-audit-refresh-queue.mjs';
import { buildProjectAuditHandoffPacket, renderProjectAuditHandoffMarkdown } from '../src/engine/project-audit-handoff.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const auditsDir = resolve(root, 'docs/audits');
const args = process.argv.slice(2);
const projectId = args[0];
const outputAt = args.indexOf('--output');
const output = outputAt >= 0 ? args[outputAt + 1] : null;
const formatAt = args.indexOf('--format');
const format = formatAt >= 0 ? args[formatAt + 1] : (output && extname(output).toLowerCase() === '.md' ? 'md' : 'json');
const requireReady = args.includes('--require-ready');

if (!projectId) {
  console.error('usage: npm run audit:handoff -- <project_id> [--format json|md] [--output path] [--require-ready]');
  process.exit(2);
}
if (!['json','md'].includes(format)) {
  console.error('AUDIT_HANDOFF_FORMAT_INVALID');
  process.exit(2);
}

const [readinessRegistry, projectRegistry, names] = await Promise.all([
  readFile(resolve(root, 'registry/project-audit-readiness.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'registry/projects.json'), 'utf8').then(JSON.parse),
  readdir(auditsDir),
]);

const auditResults = [];
for (const name of names.filter(name => name.endsWith('.json')).sort()) {
  try {
    const parsed = JSON.parse(await readFile(resolve(auditsDir, name), 'utf8'));
    if (
      parsed?.project_id === projectId &&
      (parsed?.schema === 'ai-core-project-audit-result/v1' || parsed?.schema === 'ai-core-project-audit-result/v2')
    ) {
      auditResults.push(parsed);
    }
  } catch {}
}

if (!auditResults.length) {
  console.error(JSON.stringify({ status:'HOLD', reason:'PROJECT_AUDIT_RESULT_NOT_FOUND', project_id:projectId }));
  process.exit(1);
}

const queue = buildProjectAuditRefreshQueue({
  readinessRegistry,
  projectRegistry,
  auditResults,
});
const active = queue.items.find(item => item.project_id === projectId);
if (!active) {
  console.error(JSON.stringify({ status:'HOLD', reason:'ACTIVE_PROJECT_AUDIT_NOT_FOUND', project_id:projectId }));
  process.exit(1);
}

const result = auditResults.find(candidate =>
  candidate.project_id === active.project_id &&
  candidate.repository === active.repository &&
  candidate.schema === active.audit_result_schema &&
  candidate.subject_revision === active.audited_revision &&
  (candidate.audited_at ?? null) === (active.audited_at ?? null)
);
if (!result) {
  console.error(JSON.stringify({ status:'HOLD', reason:'ACTIVE_PROJECT_AUDIT_RECORD_MISSING', project_id:projectId }));
  process.exit(1);
}

const registryProject = projectRegistry.projects.find(item => item.project_id === projectId) ?? null;

try {
  const capsule = await inspectGitHubProject({
    project_id: result.project_id,
    repository: result.repository,
    default_branch: result.source_proof.default_branch,
  });

  const freshness = assessProjectAuditFreshness({
    result,
    readinessRegistry,
    capsule,
    registryProject,
  });

  const packet = buildProjectAuditHandoffPacket({
    result,
    readinessRegistry,
    liveFreshness: freshness,
  });

  const rendered = format === 'md'
    ? renderProjectAuditHandoffMarkdown(packet)
    : JSON.stringify(packet, null, 2) + '\n';

  if (output) {
    const path = resolve(output);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, rendered, 'utf8');
  }

  process.stdout.write(rendered);
  if (requireReady && packet.status !== 'READY') process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    status:'HOLD',
    reason:error?.message ?? 'PROJECT_AUDIT_HANDOFF_FAILED',
    project_id:projectId,
  }));
  process.exitCode = 1;
}
