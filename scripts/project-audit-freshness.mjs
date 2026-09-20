import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectGitHubProject } from '../src/engine/github-project-inspector.mjs';
import { assessProjectAuditFreshness } from '../src/engine/project-audit-freshness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
if (!input) {
  console.error('usage: npm run audit:freshness -- <audit-result.json> [--require-current]');
  process.exit(2);
}

const [readinessRegistry, projectRegistry, result] = await Promise.all([
  readFile(resolve(root, 'registry/project-audit-readiness.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'registry/projects.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, input), 'utf8').then(JSON.parse),
]);

const registryProject = projectRegistry.projects.find(item => item.project_id === result.project_id);
if (!registryProject) {
  console.error(JSON.stringify({
    status: 'HOLD',
    reason: 'PROJECT_NOT_REGISTERED',
    project_id: result.project_id,
  }));
  process.exit(1);
}

try {
  const capsule = await inspectGitHubProject({
    project_id: registryProject.project_id,
    repository: registryProject.repository,
    default_branch: registryProject.default_branch,
  });

  const freshness = assessProjectAuditFreshness({
    result,
    readinessRegistry,
    capsule,
    registryProject,
  });

  process.stdout.write(JSON.stringify(freshness, null, 2) + '\n');

  if (process.argv.includes('--require-current') && freshness.status !== 'CURRENT') {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(JSON.stringify({
    status: 'HOLD',
    reason: error?.message ?? 'PROJECT_AUDIT_FRESHNESS_FAILED',
    project_id: result.project_id,
  }));
  process.exitCode = 1;
}
