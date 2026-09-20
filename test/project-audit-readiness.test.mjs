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
  assert.equal(report.permissions.axis_machine_check, true);
  assert.equal(report.full_conformance_ready, false);
  assert.equal(report.permissions.full_conformance_pass, false);
  assert.equal(report.permissions.auto_remediation, false);
  assert.equal(report.permissions.canonical_promotion, false);
  assert.equal(report.permissions.production_mutation, false);
  assert.deepEqual(report.axes.advisory_only, []);
  assert.ok(report.axes.canonical_partial.includes('api-event-error'));
  assert.ok(report.axes.canonical_partial.includes('security-audit'));
  assert.ok(report.axes.canonical_partial.includes('qa-observability'));
  assert.ok(report.axes.canonical_partial.includes('build-deploy-governance'));
  assert.equal(report.coverage.total_axes, 8);
  assert.equal(report.coverage.machine_enforced_axes, 4);
  assert.equal(report.coverage.canonical_partial_axes, 4);
});

test('canonical partial axis can run checks but can never make full conformance ready', async () => {
  const registry = await readRegistry();
  const report = assessProjectAuditReadiness(registry);
  assert.equal(report.full_conformance_ready, false);
  assert.equal(report.permissions.axis_machine_check, true);
  assert.ok(report.blockers.some(item => item.code === 'FULL_CONFORMANCE_NOT_MACHINE_ENFORCED'));
});

test('canonical partial axis must keep machine checks and declared gaps', async () => {
  const registry = await readRegistry();
  const axis = registry.axes.find(item => item.id === 'security-audit');

  axis.machine_checks = [];
  assert.throws(
    () => validateProjectAuditReadinessRegistry(registry),
    /AUDIT_READINESS_PARTIAL_WITHOUT_CHECK:security-audit/,
  );

  const registry2 = await readRegistry();
  registry2.axes.find(item => item.id === 'security-audit').gaps = [];
  assert.throws(
    () => validateProjectAuditReadinessRegistry(registry2),
    /AUDIT_READINESS_PARTIAL_GAP_REQUIRED:security-audit/,
  );
});

test('missing required axis blocks even read-only pilot', async () => {
  const registry = await readRegistry();
  registry.axes.find(axis => axis.id === 'security-audit').maturity = 'MISSING';
  const report = assessProjectAuditReadiness(registry);
  assert.equal(report.status, 'HOLD');
  assert.equal(report.permissions.read_only_project_audit, false);
  assert.equal(report.permissions.axis_machine_check, false);
  assert.deepEqual(report.axes.missing, ['security-audit']);
});

test('registry rejects duplicate or unknown axes', async () => {
  const registry = await readRegistry();
  registry.axes[7] = structuredClone(registry.axes[0]);
  assert.throws(() => validateProjectAuditReadinessRegistry(registry), /AUDIT_READINESS_AXIS_ID_INVALID/);
});
