import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeProjectAuditResult, validateProjectAuditResult } from '../src/engine/project-audit-result.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

test('FreePass Admin pilot obeys readiness maturity boundaries', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  assert.doesNotThrow(() => validateProjectAuditResult(result, readiness));
  const summary = summarizeProjectAuditResult(result, readiness);
  assert.equal(summary.status, 'READ_ONLY_AUDIT_COMPLETE_WITH_GAPS');
  assert.equal(summary.counts.core_match, 4);
  assert.equal(summary.counts.migration_gap, 2);
  assert.equal(summary.counts.research_advisory, 2);
  assert.equal(summary.auto_remediation_allowed, false);
});

test('research-only axes cannot be upgraded to normative CORE_MATCH', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  result.findings.find(x => x.axis === 'security-audit').verdict = 'CORE_MATCH';
  assert.throws(
    () => validateProjectAuditResult(result, readiness),
    /PROJECT_AUDIT_RESEARCH_AXIS_NORMATIVE_VERDICT_FORBIDDEN:security-audit/,
  );
});

test('audit is bound to an exact 40-character source revision', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  result.subject_revision = 'main';
  assert.throws(() => validateProjectAuditResult(result, readiness), /PROJECT_AUDIT_SUBJECT_REVISION_INVALID/);
});
