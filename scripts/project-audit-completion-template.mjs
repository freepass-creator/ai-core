import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const handoffPath = process.argv[2];
const resultRevision = process.argv[3];

if (!handoffPath || !resultRevision) {
  console.error('usage: npm run audit:completion-template -- <handoff.json> <result_revision>');
  process.exit(2);
}
if (!/^[0-9a-f]{40}$/.test(resultRevision)) {
  console.error('AUDIT_COMPLETION_RESULT_REVISION_INVALID');
  process.exit(2);
}

const handoff = JSON.parse(await readFile(resolve(handoffPath),'utf8'));
if (handoff?.schema !== 'ai-core-project-audit-handoff/v1' || handoff.status !== 'READY') {
  console.error('AUDIT_COMPLETION_HANDOFF_NOT_READY');
  process.exit(1);
}

const tasks = [
  ...(handoff.project_work?.implementation ?? []),
  ...(handoff.project_work?.discovery ?? []),
];

const report = {
  schema:'ai-core-project-audit-completion-report/v1',
  project_id:handoff.project_id,
  repository:handoff.repository,
  handoff_subject_revision:handoff.audit_binding.subject_revision,
  standard_baseline_revision:handoff.audit_binding.standard_baseline_revision,
  result_revision:resultRevision,
  completed_at:new Date().toISOString(),
  task_results:tasks.map(task => ({
    bucket:task.bucket,
    axis:task.axis,
    status:'NOT_DONE',
    summary:'Completion evidence not yet returned.',
    evidence:[],
    remaining_gaps:task.gaps.length ? [...task.gaps] : ['Completion evidence not yet returned.'],
  })),
};

process.stdout.write(JSON.stringify(report,null,2) + '\n');
