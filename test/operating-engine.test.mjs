import test from 'node:test';
import assert from 'node:assert/strict';
import { openOperatingCapabilityEngine } from '../src/engine/operating-engine.mjs';

const fakeStore = { get() { throw new Error('should not read without sources'); } };

test('workSources가 없으면 routing은 살아 있고 운영 projection/authority만 닫힌다', async () => {
  const operating = await openOperatingCapabilityEngine({ store: fakeStore, workSources: null });
  assert.equal(operating.source_mode, 'ROUTING_ONLY');
  assert.equal(operating.readWorkProjection, null);
  assert.equal(operating.verifyAuthority, null);
  assert.equal(operating.issueAuthority, null);
  const plan = operating.engine.plan({ text: 'freepasserp4 테스트 돌려' });
  assert.equal(plan.status, 'PLANNED');
  assert.equal(plan.capability_id, 'project.verify');
});

test('외부 변경은 운영 source가 없으면 perform을 요구해도 fail-closed다', async () => {
  const fakeRuntime = {
    prepareCommand: async () => ({ argv: ['node', 'x.mjs'] }),
    runCommand: async () => { throw new Error('must not execute'); },
    runModule: async () => { throw new Error('must not execute'); },
  };
  const operating = await openOperatingCapabilityEngine({ store: fakeStore, workSources: null, runtime: fakeRuntime });
  const aiops = operating.projectRegistry.projects.find(p => p.project_id === 'aiops');
  const cap = operating.capabilityRegistry.capabilities.find(c => c.id === 'operations.penalty.prepare');
  const authority = {
    schema: 'ai-core-authority-receipt/v1', status: 'GRANTED', order_id: 'ORD-001', work_id: 'GWATAERYO-001',
    capability_id: cap.id, project_id: 'aiops', subject_revision: aiops.head_revision,
    ledger_head: 'fake-head', scopes: [...cap.required_scopes],
  };
  const result = await operating.engine.run({
    text: '과태료 처리해', orderId: authority.order_id, workId: authority.work_id,
    perform: true, authority,
  });
  assert.equal(result.status, 'HOLD');
  assert.ok(result.blockers.includes('AUTHORITY_VERIFIER_REQUIRED'));
});
