import { readFile } from 'node:fs/promises';
import { evaluateControlTower } from './evaluate-control-tower.mjs';
import { validateProjectRegistry } from './validate-project-registry.mjs';
import { verifyLedgerText } from './work-ledger.mjs';

const unique = (values) => [...new Set(values)];

export function runControlTower({ registry, snapshot, ledgerText }) {
  const registryResult = validateProjectRegistry(registry);
  const ledgerResult = verifyLedgerText(ledgerText);
  const controlResult = evaluateControlTower(snapshot);
  const errors = [];
  if (registryResult.status !== 'VALID') errors.push({ code: 'PROJECT_REGISTRY_INVALID', details: registryResult.errors });
  if (ledgerResult.status !== 'VALID') errors.push({ code: 'WORK_LEDGER_INVALID', details: ledgerResult.errors });
  if (controlResult.status === 'INVALID') errors.push({ code: 'CONTROL_SNAPSHOT_INVALID', details: controlResult.errors });
  if (errors.length) return { status: 'INVALID', execution_authorized: false, errors, items: [] };

  const projects = new Map(registry.projects.map((project) => [project.project_id, project]));
  const controlById = new Map(controlResult.items.map((item) => [item.id, item]));
  const items = snapshot.items.map((item) => {
    const project = projects.get(item.project_id);
    const ledgerWork = ledgerResult.work[item.id];
    const blockers = [...controlById.get(item.id).actions.execute.reasons];
    if (!project) blockers.push('PROJECT_NOT_REGISTERED');
    else {
      if (project.status !== 'ACTIVE') blockers.push(`PROJECT_${project.status}`);
      if (project.head_revision !== item.subject_revision) blockers.push('PROJECT_REVISION_STALE');
    }
    if (!ledgerWork) blockers.push('WORK_NOT_REGISTERED');
    else {
      if (ledgerWork.project_id !== item.project_id) blockers.push('WORK_PROJECT_MISMATCH');
      if (ledgerWork.state !== 'READY') blockers.push(`WORK_STATE_${ledgerWork.state}`);
      if (!ledgerWork.subject_revision) blockers.push('WORK_REVISION_REQUIRED');
      else if (ledgerWork.subject_revision !== item.subject_revision) blockers.push('WORK_REVISION_STALE');
    }
    const reasons = unique(blockers);
    return {
      id: item.id,
      project_id: item.project_id,
      ledger_state: ledgerWork?.state ?? null,
      execute: { enabled: reasons.length === 0, reasons },
      close: controlById.get(item.id).actions.close,
      warnings: controlById.get(item.id).warnings,
    };
  });
  return {
    status: items.some((item) => !item.execute.enabled) ? 'HOLD' : 'READY',
    execution_authorized: false,
    registry_observed_at: registry.observed_at,
    ledger_head: ledgerResult.head,
    errors: [],
    items,
  };
}

if (process.argv[1]?.endsWith('run-control-tower.mjs')) {
  const [registryPath, snapshotPath, ledgerPath] = process.argv.slice(2);
  if (!registryPath || !snapshotPath || !ledgerPath) {
    console.error('Usage: node scripts/run-control-tower.mjs <registry.json> <snapshot.json> <ledger.jsonl>');
    process.exit(2);
  }
  const [registry, snapshot, ledgerText] = await Promise.all([
    readFile(registryPath, 'utf8').then(JSON.parse),
    readFile(snapshotPath, 'utf8').then(JSON.parse),
    readFile(ledgerPath, 'utf8'),
  ]);
  const result = runControlTower({ registry, snapshot, ledgerText });
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'INVALID') process.exitCode = 1;
}
