import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectGitHubProject } from '../src/engine/github-project-inspector.mjs';
import { buildProjectAuditClosureQueue, renderProjectAuditClosureQueueMarkdown, selectActiveProjectAuditHandoffs } from '../src/engine/project-audit-closure-queue.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const live = args.includes('--live');
const requireClean = args.includes('--require-clean');
const formatAt = args.indexOf('--format');
const outputAt = args.indexOf('--output');
const outputPath = outputAt >= 0 ? args[outputAt + 1] : null;
const format = formatAt >= 0
  ? args[formatAt + 1]
  : (outputPath && extname(outputPath).toLowerCase() === '.md' ? 'md' : 'json');

if (!['json','md'].includes(format)) {
  console.error('AUDIT_CLOSURE_QUEUE_FORMAT_INVALID');
  process.exit(2);
}

async function readJsonFiles(dir, predicate) {
  let names = [];
  try {
    names = await readdir(dir);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const out = [];
  for (const name of names.sort()) {
    if (!name.endsWith('.json')) continue;
    const path = resolve(dir,name);
    try {
      const parsed = JSON.parse(await readFile(path,'utf8'));
      if (predicate(parsed,name)) out.push(parsed);
    } catch {}
  }
  return out;
}

const [readinessRegistry,handoffs,completionReports,closureReceipts] = await Promise.all([
  readFile(resolve(root,'registry/project-audit-readiness.json'),'utf8').then(JSON.parse),
  readJsonFiles(
    resolve(root,'docs/handoffs/project-4'),
    parsed => parsed?.schema === 'ai-core-project-audit-handoff/v1',
  ),
  readJsonFiles(
    resolve(root,'docs/completions/project-4'),
    parsed => parsed?.schema === 'ai-core-project-audit-completion-report/v1',
  ),
  readJsonFiles(
    resolve(root,'docs/closures/project-4'),
    parsed => parsed?.schema === 'ai-core-project-audit-closure-receipt/v1',
  ),
]);

const liveByProject = new Map();
if (live) {
  for (const handoff of selectActiveProjectAuditHandoffs(handoffs).active) {
    try {
      const capsule = await inspectGitHubProject({
        project_id:handoff.project_id,
        repository:handoff.repository,
        default_branch:handoff.default_branch,
      });
      const projectMoved = capsule.subject_revision !== handoff.audit_binding.subject_revision;
      const standardMoved = handoff.audit_binding.standard_baseline_revision !== readinessRegistry.baseline_revision;
      const blockers = [];
      if (projectMoved) blockers.push('HANDOFF_PROJECT_REVISION_MOVED');
      if (standardMoved) blockers.push('HANDOFF_STANDARD_BASELINE_STALE');
      liveByProject.set(handoff.project_id,{
        status: blockers.length ? 'STALE' : 'CURRENT',
        live_revision:capsule.subject_revision,
        blockers,
      });
    } catch (error) {
      liveByProject.set(handoff.project_id,{
        status:'HOLD',
        live_revision:null,
        blockers:[error?.message ?? 'HANDOFF_LIVE_INSPECTION_FAILED'],
      });
    }
  }
}

const queue = buildProjectAuditClosureQueue({
  handoffs,
  completionReports,
  closureReceipts,
  liveByProject,
});

const rendered = format === 'md'
  ? renderProjectAuditClosureQueueMarkdown(queue)
  : JSON.stringify(queue,null,2) + '\n';

if (outputPath) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = resolve(outputPath);
  await mkdir(dirname(path),{recursive:true});
  await writeFile(path,rendered,'utf8');
}

process.stdout.write(rendered);

if (requireClean && queue.totals.action_required > 0) {
  process.exitCode = 1;
}
