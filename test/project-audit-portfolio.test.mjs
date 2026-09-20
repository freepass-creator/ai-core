import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProjectAuditPortfolio } from '../src/engine/project-audit-portfolio.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

const files = [
  '../docs/audits/freepass-admin-pilot-2026-09-20.json',
  '../docs/audits/freepasserp4-pilot-2026-09-20.json',
  '../docs/audits/freepass-estimate-pilot-2026-09-20.json',
  '../docs/audits/aiops-pilot-2026-09-20.json',
  '../docs/audits/freepass-admin-v2-2026-09-20.json',
  '../docs/audits/freepasserp4-v2-2026-09-20.json',
  '../docs/audits/freepasserp4-v2-2026-09-20-r2.json',
  '../docs/audits/freepasserp4-v2-2026-09-20-r3.json',
  '../docs/audits/freepasserp4-v2-2026-09-20-r4.json',
  '../docs/audits/freepass-estimate-v2-2026-09-20.json',
  '../docs/audits/aiops-v2-2026-09-20.json',
];

test('portfolio rolls eleven stored records into four active v2 audits', async () => {
  const [readinessRegistry, projectRegistry, auditResults] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../registry/projects.json'),
    Promise.all(files.map(readJson)),
  ]);

  const portfolio = buildProjectAuditPortfolio({
    readinessRegistry,
    projectRegistry,
    auditResults,
  });

  assert.equal(portfolio.totals.audit_records, 11);
  assert.equal(portfolio.totals.active_projects, 4);
  assert.equal(portfolio.totals.superseded_history, 7);
  assert.equal(portfolio.totals.axis_observations, 32);
  assert.equal(portfolio.projects.every(item => item.audit_result_schema === 'ai-core-project-audit-result/v2'), true);
  assert.equal(portfolio.permissions.auto_remediation, false);
  assert.equal(portfolio.permissions.production_mutation, false);
});

test('portfolio preserves project-specific CI and freshness differences', async () => {
  const [readinessRegistry, projectRegistry, auditResults] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../registry/projects.json'),
    Promise.all(files.map(readJson)),
  ]);

  const portfolio = buildProjectAuditPortfolio({
    readinessRegistry,
    projectRegistry,
    auditResults,
  });
  const byId = new Map(portfolio.projects.map(item => [item.project_id, item]));

  assert.equal(byId.get('freepass-admin').ci.status, 'UNKNOWN');
  assert.equal(byId.get('freepasserp4').subject_revision, 'f7c89b7b995d8d98ea04606405e68b158fb4256f');
  assert.equal(byId.get('freepasserp4').ci.status, 'UNKNOWN');
  assert.equal(byId.get('freepass-estimate').ci.status, 'UNKNOWN');
  assert.equal(byId.get('aiops').ci.status, 'UNKNOWN');

  assert.equal(byId.get('freepasserp4').registry_status, 'REGISTRY_DRIFT');
  assert.equal(byId.get('freepasserp4').freshness_review_required, true);
  assert.equal(byId.get('freepasserp4').re_audit_candidate, false);

  assert.equal(portfolio.totals.ci_pass, 0);
  assert.equal(portfolio.totals.ci_unknown, 4);
  assert.equal(portfolio.totals.registry_drift, 1);
  assert.equal(portfolio.totals.branch_unprotected, 4);
});

test('portfolio verdict counts cover all 32 active-axis observations', async () => {
  const [readinessRegistry, projectRegistry, auditResults] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../registry/projects.json'),
    Promise.all(files.map(readJson)),
  ]);

  const portfolio = buildProjectAuditPortfolio({
    readinessRegistry,
    projectRegistry,
    auditResults,
  });
  const sum = Object.values(portfolio.aggregate_verdicts).reduce((a,b)=>a+b,0);

  assert.equal(sum, 32);
  assert.equal(portfolio.aggregate_verdicts.core_match, 15);
  assert.equal(portfolio.aggregate_verdicts.migration_gap, 15);
  assert.equal(portfolio.aggregate_verdicts.unknown, 2);
  assert.equal(portfolio.aggregate_verdicts.project_ahead, 0);
  assert.equal(portfolio.aggregate_verdicts.research_advisory, 0);
});
