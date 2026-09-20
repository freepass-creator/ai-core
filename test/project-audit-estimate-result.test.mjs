import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeProjectAuditResult, validateProjectAuditResult } from '../src/engine/project-audit-result.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

test('FreePass Estimate audit keeps production proof and partial-standard boundaries explicit', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-estimate-pilot-2026-09-20.json'),
  ]);
  assert.doesNotThrow(() => validateProjectAuditResult(result, readiness));
  const summary = summarizeProjectAuditResult(result, readiness);
  assert.equal(summary.status, 'READ_ONLY_AUDIT_COMPLETE_WITH_LIMITATIONS');
  assert.equal(summary.counts.core_match, 4);
  assert.equal(summary.counts.migration_gap, 1);
  assert.equal(summary.counts.research_advisory, 2);
  assert.equal(summary.counts.unknown, 1);
  assert.equal(summary.full_conformance_eligible, false);
  assert.equal(summary.auto_remediation_allowed, false);
});

test('Estimate QA may match the partial baseline without erasing Core QA gaps', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-estimate-pilot-2026-09-20.json'),
  ]);
  result.findings.find(x => x.axis === 'qa-observability').verdict = 'CORE_MATCH';
  const summary = summarizeProjectAuditResult(result, readiness);
  assert.equal(summary.full_conformance_eligible, false);
  assert.ok(summary.standard_limitations.canonical_partial.some(item => item.axis === 'qa-observability'));
});
