import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assessProjectAuditReadiness,
  validateProjectAuditReadinessRegistry,
} from '../src/engine/project-audit-readiness.mjs';

const readRegistry = async () => JSON.parse(await readFile(new URL('../registry/project-audit-readiness.json', import.meta.url), 'utf8'));

test('current AI Core standards are ready for read-only project audit pilot, not full conformance', async () => {
  const report = assessProjectAuditReadiness(await readRegistry());
  assert.equal(report.status, 'READ_ONLY_AUDIT_PILOT_READY');
  assert.equal(report.permissions.read_only_project_audit, true);
  assert.equal(report.permissions.gap_report, true);
  assert.equal(report.full_conformance_ready, false);
  assert.equal(report.permissions.auto_remediation, false);
  assert.equal(report.permissions.canonical_promotion, false);
  assert.equal(report.permissions.production_mutation, false);
  assert.deepEqual(report.axes.advisory_only, []);
  assert.ok(report.axes.canonical_partial.includes('api-event-error'));
  assert.ok(report.axes.canonical_partial.includes('security-audit'));
  assert.ok(report.axes.canonical_partial.includes('qa-observability'));
  assert.ok(report.axes.canonical_partial.includes('build-deploy-governance'));
});

test('research-only axis can never make full conformance ready', async () => {
  const registry = await readRegistry();
  const report = assessProjectAuditReadiness(registry);
  assert.equal(report.full_conformance_ready, false);
  assert.ok(report.blockers.some(item => item.code === 'FULL_CONFORMANCE_NOT_MACHINE_ENFORCED'));
});

test('missing required axis blocks even read-only pilot', async () => {
  const registry = await readRegistry();
  registry.axes.find(axis => axis.id === 'security-audit').maturity = 'MISSING';
  const report = assessProjectAuditReadiness(registry);
  assert.equal(report.status, 'HOLD');
  assert.equal(report.permissions.read_only_project_audit, false);
  assert.deepEqual(report.axes.missing, ['security-audit']);
});

test('registry rejects duplicate or unknown axes', async () => {
  const registry = await readRegistry();
  registry.axes[7] = structuredClone(registry.axes[0]);
  assert.throws(() => validateProjectAuditReadinessRegistry(registry), /AUDIT_READINESS_AXIS_ID_INVALID/);
});
