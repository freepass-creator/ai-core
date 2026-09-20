import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectGitHubProject } from '../src/engine/github-project-inspector.mjs';
import { buildProjectAuditPlan } from '../src/engine/project-audit-plan.mjs';
import { buildProjectAuditWorkbook } from '../src/engine/project-audit-workbook.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const projectId = args[0];
const outAt = args.indexOf('--output');
const output = outAt >= 0 ? args[outAt + 1] : null;
const requireReady = args.includes('--require-ready');

if (!projectId) {
  console.error('usage: npm run audit:workbook -- <project_id> [--output path.json] [--require-ready]');
  process.exit(2);
}

const [projectsRegistry, readinessRegistry] = await Promise.all([
  readFile(resolve(root, 'registry/projects.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'registry/project-audit-readiness.json'), 'utf8').then(JSON.parse),
]);

const project = projectsRegistry.projects.find(item => item.project_id === projectId);
if (!project) {
  console.error(JSON.stringify({ status: 'HOLD', reason: 'PROJECT_NOT_REGISTERED', project_id: projectId }));
  process.exit(1);
}

try {
  const capsule = await inspectGitHubProject({
    project_id: project.project_id,
    repository: project.repository,
    default_branch: project.default_branch,
  });
  const plan = buildProjectAuditPlan(readinessRegistry, capsule);
  const workbook = buildProjectAuditWorkbook(plan);
  const text = JSON.stringify(workbook, null, 2) + '\n';

  if (output) {
    const path = resolve(output);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text, { flag: 'w' });
  }

  process.stdout.write(text);
  if (requireReady && workbook.status !== 'READY_FOR_REVIEW') process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    status: 'HOLD',
    reason: error?.message ?? 'PROJECT_AUDIT_WORKBOOK_FAILED',
    project_id: projectId,
  }));
  process.exitCode = 1;
}
