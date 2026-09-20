import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeProjectAuditResult, validateProjectAuditResult } from '../src/engine/project-audit-result.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

test('AIOps pilot preserves project gaps and current canonical-partial limitations', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/aiops-pilot-2026-09-20.json'),
  ]);
  assert.doesNotThrow(() => validateProjectAuditResult(result, readiness));
  const summary = summarizeProjectAuditResult(result, readiness);
  assert.equal(summary.status, 'READ_ONLY_AUDIT_COMPLETE_WITH_LIMITATIONS');
  assert.equal(summary.counts.core_match, 3);
  assert.equal(summary.counts.migration_gap, 2);
  assert.equal(summary.counts.research_advisory, 2);
  assert.equal(summary.counts.unknown, 1);
  assert.equal(summary.full_conformance_eligible, false);
  assert.equal(summary.auto_remediation_allowed, false);
});

test('AIOps security may be scored against the partial baseline without becoming full conformance', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/aiops-pilot-2026-09-20.json'),
  ]);
  result.findings.find(x => x.axis === 'security-audit').verdict = 'PROJECT_AHEAD';
  const summary = summarizeProjectAuditResult(result, readiness);
  assert.equal(summary.full_conformance_eligible, false);
  assert.ok(summary.standard_limitations.canonical_partial.some(item => item.axis === 'security-audit'));
});
