import test from 'node:test';
import assert from 'node:assert/strict';
import { openOperatingCapabilityEngine } from '../src/engine/operating-engine.mjs';

const fakeStore = { get() { throw new Error('should not read without sources'); } };

test('workSources가 없으면 capability plan은 살아 있고 projection/authority만 닫힌다', async () => {
  const operating = await openOperatingCapabilityEngine({ store: fakeStore, workSources: null });
  assert.equal(operating.source_mode, 'ROUTING_ONLY');
  assert.equal(operating.readWorkProjection, null);
  assert.equal(operating.verifyAuthority, null);
  assert.equal(operating.issueAuthority, null);

  const project = operating.projectRegistry.projects.find(p => p.project_id === 'freepasserp4');
  const plan = operating.engine.plan({
    route: {
      capability_id: 'project.verify',
      target_project_id: 'freepasserp4',
      target_revision: project.head_revision,
    },
  });
  assert.equal(plan.status, 'PLANNED');
  assert.equal(plan.capability_id, 'project.verify');
});

test('외부 변경은 trusted work source가 없으면 모양 맞는 receipt가 있어도 fail-closed다', async () => {
  const fakeRuntime = {
    prepareCommand: async () => ({ argv: ['node', 'x.mjs'] }),
    runCommand: async () => { throw new Error('must not execute'); },
    runModule: async () => { throw new Error('must not execute'); },
  };
  const operating = await openOperatingCapabilityEngine({ store: fakeStore, workSources: null, runtime: fakeRuntime });
  const aiops = operating.projectRegistry.projects.find(p => p.project_id === 'aiops');
  const cap = operating.capabilityRegistry.capabilities.find(c => c.id === 'operations.penalty.prepare');
  const route = { capability_id: cap.id, target_project_id: 'aiops', target_revision: aiops.head_revision };
  const authority = {
    schema:'ai-core-authority-receipt/v1', status:'GRANTED',
    order_id:'ORD-00000000-0000-4000-8000-000000000001', work_id:'GWATAERYO-001',
    capability_id:cap.id, project_id:'aiops', subject_revision:aiops.head_revision,
    ledger_head:'fake-head', scopes:[...cap.required_scopes],
  };
  const result = await operating.engine.run({
    route, orderId:authority.order_id, workId:authority.work_id,
    perform:true, authority,
  });
  assert.equal(result.status, 'HOLD');
  assert.ok(result.blockers.includes('AUTHORITY_VERIFIER_REQUIRED'));
});
