import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeProjectAuditResult, validateProjectAuditResult } from '../src/engine/project-audit-result.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

function asV2(result, readiness, overrides = {}) {
  return {
    ...structuredClone(result),
    schema: 'ai-core-project-audit-result/v2',
    standard_baseline_revision: readiness.baseline_revision,
    audited_at: '2026-09-20T11:00:00.000Z',
    ...overrides,
  };
}

test('legacy FreePass Admin pilot stays valid but standard baseline is explicitly unknown', async () => {
  const [readiness, result] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  assert.doesNotThrow(() => validateProjectAuditResult(result, readiness));
  const summary = summarizeProjectAuditResult(result, readiness);
  assert.equal(summary.status, 'READ_ONLY_AUDIT_COMPLETE_WITH_LIMITATIONS');
  assert.equal(summary.audit_result_schema, 'ai-core-project-audit-result/v1');
  assert.equal(summary.standard_binding.status, 'UNKNOWN_LEGACY');
  assert.equal(summary.counts.core_match, 4);
  assert.equal(summary.counts.migration_gap, 2);
  assert.equal(summary.counts.research_advisory, 2);
  assert.equal(summary.source_proof.ci_revision_match, true);
  assert.equal(summary.full_conformance_eligible, false);
  assert.equal(summary.auto_remediation_allowed, false);
});

test('v2 audit binds the exact current Core standard baseline', async () => {
  const [readiness, legacy] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  const result = asV2(legacy, readiness);

  assert.doesNotThrow(() => validateProjectAuditResult(result, readiness));
  const summary = summarizeProjectAuditResult(result, readiness);

  assert.equal(summary.audit_result_schema, 'ai-core-project-audit-result/v2');
  assert.equal(summary.standard_binding.status, 'CURRENT');
  assert.equal(summary.standard_binding.audited_baseline_revision, readiness.baseline_revision);
  assert.equal(summary.audited_at, '2026-09-20T11:00:00.000Z');
});

test('v2 audit with moved standard baseline remains structurally valid but summarizes as stale binding', async () => {
  const [readiness, legacy] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  const result = asV2(legacy, readiness, {
    standard_baseline_revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });

  assert.doesNotThrow(() => validateProjectAuditResult(result, readiness));
  const summary = summarizeProjectAuditResult(result, readiness);

  assert.equal(summary.standard_binding.status, 'STALE');
  assert.equal(summary.full_conformance_eligible, false);
});

test('v2 requires standard baseline revision and audited_at', async () => {
  const [readiness, legacy] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);

  const missingBaseline = asV2(legacy, readiness);
  delete missingBaseline.standard_baseline_revision;
  assert.throws(
    () => validateProjectAuditResult(missingBaseline, readiness),
    /PROJECT_AUDIT_STANDARD_BASELINE_REVISION_INVALID/,
  );

  const missingAuditedAt = asV2(legacy, readiness);
  delete missingAuditedAt.audited_at;
  assert.throws(
    () => validateProjectAuditResult(missingAuditedAt, readiness),
    /PROJECT_AUDIT_AUDITED_AT_INVALID/,
  );
});

test('canonical-partial axes may be scored locally but never erase Core-level limitations', async () => {
  const [readiness, legacy] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../docs/audits/freepass-admin-pilot-2026-09-20.json'),
  ]);
  const result = asV2(legacy, readiness);
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
