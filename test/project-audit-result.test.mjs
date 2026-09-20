import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeProjectAuditResult, validateProjectAuditResult } from '../src/engine/project-audit-result.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

test('FreePass Admin pilot stays revision-bound and carries canonical-partial limitations', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  assert.doesNotThrow(() => validateProjectAuditResult(result, readiness));
  const summary = summarizeProjectAuditResult(result, readiness);
  assert.equal(summary.status, 'READ_ONLY_AUDIT_COMPLETE_WITH_LIMITATIONS');
  assert.equal(summary.counts.core_match, 4);
  assert.equal(summary.counts.migration_gap, 2);
  assert.equal(summary.counts.research_advisory, 2);
  assert.equal(summary.source_proof.ci_revision_match, true);
  assert.equal(summary.full_conformance_eligible, false);
  assert.deepEqual(
    summary.standard_limitations.canonical_partial.map(item => item.axis),
    ['api-event-error', 'security-audit', 'qa-observability', 'build-deploy-governance'],
  );
  assert.equal(summary.auto_remediation_allowed, false);
});

test('canonical-partial axes may be scored locally but never erase Core-level limitations', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  result.findings.find(x => x.axis === 'security-audit').verdict = 'CORE_MATCH';
  const summary = summarizeProjectAuditResult(result, readiness);
  assert.equal(summary.full_conformance_eligible, false);
  assert.ok(summary.standard_limitations.canonical_partial.some(item => item.axis === 'security-audit'));
});

test('audit subject revision must be exact and match CI proof revision', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  result.subject_revision = 'main';
  assert.throws(() => validateProjectAuditResult(result, readiness), /PROJECT_AUDIT_SUBJECT_REVISION_INVALID/);

  const result2 = await readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json');
  result2.source_proof.ci.revision = '2222222222222222222222222222222222222222';
  assert.throws(() => validateProjectAuditResult(result2, readiness), /PROJECT_AUDIT_CI_REVISION_MISMATCH/);
});

test('complete project audit results must cover all eight axes exactly once', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  result.findings.pop();
  assert.throws(() => validateProjectAuditResult(result, readiness), /PROJECT_AUDIT_FINDING_COUNT_INVALID/);
});
