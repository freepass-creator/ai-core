import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildLiveProjectAuditPortfolio } from '../src/engine/project-audit-live-portfolio.mjs';

const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);

const auditFiles = [
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

test('live portfolio marks exact matching active audits CURRENT', async () => {
  const [readinessRegistry, projectRegistry, auditResults] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../registry/projects.json'),
    Promise.all(auditFiles.map(readJson)),
  ]);

  const activeRevision = new Map([
    ['freepass-admin','2747ef32e96c550d7dea05c58ee012880cb42dd3'],
    ['freepasserp4','f7c89b7b995d8d98ea04606405e68b158fb4256f'],
    ['freepass-estimate','57a75aaeaa8b91f14c6bc22faa01e745daaa3112'],
    ['aiops','03dd804962eb4e345b7a34b3e0e97e8bc6d5efe3'],
  ]);

  const report = await buildLiveProjectAuditPortfolio({
    readinessRegistry,
    projectRegistry,
    auditResults,
    inspectProject: async ({project_id,repository,default_branch}) => ({
      schema:'ai-core-project-capsule/v1',
      project_id,
      repository,
      default_branch,
      subject_revision:activeRevision.get(project_id),
      observed_at:'2026-09-20T11:50:00.000Z',
      readiness:{status:'READY_FOR_REGISTRY_REVIEW',blockers:[],review_required:true},
      evidence_refs:[`GIT:${repository}@${activeRevision.get(project_id)}`],
    }),
  });

  assert.equal(report.totals.active_projects, 4);
  assert.equal(report.totals.live_current, 4);
  assert.equal(report.totals.live_stale, 0);
  assert.equal(report.totals.live_hold, 0);
  assert.equal(report.totals.live_re_audit_required, 0);
  assert.equal(report.totals.live_registry_stale, 1);
  assert.equal(report.projects.every(item => item.audit_usable_as_current), true);
});

test('live portfolio turns moved project head into STALE even when registry has not caught up', async () => {
  const [readinessRegistry, projectRegistry, auditResults] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../registry/projects.json'),
    Promise.all(auditFiles.map(readJson)),
  ]);

  const report = await buildLiveProjectAuditPortfolio({
    readinessRegistry,
    projectRegistry,
    auditResults,
    inspectProject: async ({project_id,repository,default_branch}) => ({
      schema:'ai-core-project-capsule/v1',
      project_id,
      repository,
      default_branch,
      subject_revision: project_id === 'aiops'
        ? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        : ({
            'freepass-admin':'2747ef32e96c550d7dea05c58ee012880cb42dd3',
            'freepasserp4':'f7c89b7b995d8d98ea04606405e68b158fb4256f',
            'freepass-estimate':'57a75aaeaa8b91f14c6bc22faa01e745daaa3112',
          })[project_id],
      observed_at:'2026-09-20T11:50:00.000Z',
      readiness:{status:'READY_FOR_REGISTRY_REVIEW',blockers:[],review_required:true},
      evidence_refs:[],
    }),
  });

  const aiops = report.projects.find(item => item.project_id === 'aiops');
  assert.equal(aiops.live_status, 'STALE');
  assert.equal(aiops.project_revision_moved, true);
  assert.equal(aiops.re_audit_required, true);
  assert.ok(aiops.live_reasons.includes('SUBJECT_REVISION_MOVED'));
  assert.equal(report.totals.live_stale, 1);
  assert.equal(report.totals.live_re_audit_required, 1);
});

test('live inspection failure is HOLD and never current', async () => {
  const [readinessRegistry, projectRegistry, auditResults] = await Promise.all([
    readJson('../registry/project-audit-readiness.json'),
    readJson('../registry/projects.json'),
    Promise.all(auditFiles.map(readJson)),
  ]);

  const report = await buildLiveProjectAuditPortfolio({
    readinessRegistry,
    projectRegistry,
    auditResults,
    inspectProject: async ({project_id,repository,default_branch}) => {
      if (project_id === 'freepass-admin') throw new Error('GITHUB_UNAVAILABLE');
      const revisions = {
        'freepasserp4':'f7c89b7b995d8d98ea04606405e68b158fb4256f',
        'freepass-estimate':'57a75aaeaa8b91f14c6bc22faa01e745daaa3112',
        'aiops':'03dd804962eb4e345b7a34b3e0e97e8bc6d5efe3',
      };
      return {
        schema:'ai-core-project-capsule/v1', project_id, repository, default_branch,
        subject_revision:revisions[project_id], observed_at:'2026-09-20T11:50:00.000Z',
        readiness:{status:'READY_FOR_REGISTRY_REVIEW',blockers:[],review_required:true},
        evidence_refs:[],
      };
    },
  });

  const admin = report.projects.find(item => item.project_id === 'freepass-admin');
  assert.equal(admin.live_status, 'HOLD');
  assert.equal(admin.audit_usable_as_current, false);
  assert.equal(report.totals.live_hold, 1);
});
