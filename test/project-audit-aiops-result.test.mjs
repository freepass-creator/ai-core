import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeProjectAuditResult, validateProjectAuditResult } from '../src/engine/project-audit-result.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

test('AIOps pilot preserves strong advisory evidence without falsely promoting research axes', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/aiops-pilot-2026-09-20.json'),
  ]);
  assert.doesNotThrow(() => validateProjectAuditResult(result, readiness));
  const summary = summarizeProjectAuditResult(result, readiness);
  assert.equal(summary.status, 'READ_ONLY_AUDIT_COMPLETE_WITH_GAPS');
  assert.equal(summary.counts.core_match, 3);
  assert.equal(summary.counts.migration_gap, 2);
  assert.equal(summary.counts.research_advisory, 2);
  assert.equal(summary.counts.unknown, 1);
  assert.equal(summary.auto_remediation_allowed, false);
});

test('AIOps security evidence cannot self-promote when Security/Audit is research-only', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/aiops-pilot-2026-09-20.json'),
  ]);
  readiness.axes.find(x => x.id === 'security-audit').maturity = 'RESEARCH_ONLY';
  result.findings.find(x => x.axis === 'security-audit').verdict = 'PROJECT_AHEAD';
  assert.throws(
    () => validateProjectAuditResult(result, readiness),
    /PROJECT_AUDIT_RESEARCH_AXIS_NORMATIVE_VERDICT_FORBIDDEN:security-audit/,
  );
});
