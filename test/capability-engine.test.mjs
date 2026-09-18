import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCapabilityEngine } from '../src/engine/capability-engine.mjs';

const capabilityRegistry = JSON.parse(await readFile(new URL('../registry/capabilities.json', import.meta.url), 'utf8'));
const projectRegistry = JSON.parse(await readFile(new URL('../registry/projects.json', import.meta.url), 'utf8'));

function fakeRuntime() {
  const calls = { prepare: 0, run: 0, module: 0 };
  return {
    calls,
    runtime: {
      prepareCommand: async (capability, project) => {
        calls.prepare++;
        return { kind: 'PROJECT_COMMAND', project_id: project.project_id, argv: capability.adapter.argv ?? ['npm', capability.adapter.command_key] };
      },
      runCommand: async capability => {
        calls.run++;
        return {
          status: 'SUCCEEDED', summary: capability.title + ' 완료', data: { ok: true },
          evidence: ['MEASURED:test'], artifacts: [], checks: [{ name: capability.id, status: 'PASS' }],
          blockers: [], external_effect: capability.mode === 'EXTERNAL_MUTATION',
        };
      },
      runModule: async capability => {
        calls.module++;
        return {
          status: 'SUCCEEDED', summary: capability.title + ' 완료', data: { ok: true },
          evidence: ['READ:test'], artifacts: [], checks: [{ name: capability.id, status: 'PASS' }],
          blockers: [], external_effect: false,
        };
      },
    },
  };
}

test('LOCAL_MUTATION은 기본이 PREPARED이고 perform=true에서만 돈다', async () => {
  const fake = fakeRuntime();
  const engine = createCapabilityEngine({ capabilityRegistry, projectRegistry, runtime: fake.runtime });
  const prepared = await engine.run({ text: 'freepasserp4 테스트 돌려' });
  assert.equal(prepared.status, 'PREPARED');
  assert.equal(prepared.execution.performed, false);
  assert.equal(fake.calls.run, 0);

  const executed = await engine.run({ text: 'freepasserp4 테스트 돌려', perform: true });
  assert.equal(executed.status, 'SUCCEEDED');
  assert.equal(executed.execution.performed, true);
  assert.equal(fake.calls.run, 1);
});

test('외부 변경은 승인 receipt가 없으면 실행하지 않는다', async () => {
  const fake = fakeRuntime();
  const engine = createCapabilityEngine({ capabilityRegistry, projectRegistry, runtime: fake.runtime });
  const result = await engine.run({ text: '과태료 처리해', perform: true });
  assert.equal(result.status, 'HOLD');
  assert.ok(result.blockers.includes('EXECUTION_CONTEXT_REQUIRED'));
  assert.equal(fake.calls.run, 0);
});

test('모양만 맞는 승인도 신뢰 verifier가 없으면 실행하지 않는다', async () => {
  const fake = fakeRuntime();
  const aiops = projectRegistry.projects.find(p => p.project_id === 'aiops');
  const cap = capabilityRegistry.capabilities.find(c => c.id === 'operations.penalty.prepare');
  const authority = {
    status: 'GRANTED', order_id: 'ORD-001', work_id: 'GWATAERYO-001',
    capability_id: cap.id, project_id: 'aiops',
    subject_revision: aiops.head_revision, ledger_head: 'head-001',
    scopes: [...cap.required_scopes], receipt_id: 'AUTH-001',
  };
  const engine = createCapabilityEngine({ capabilityRegistry, projectRegistry, runtime: fake.runtime });
  const result = await engine.run({ text: '과태료 처리해', orderId: 'ORD-001', workId: 'GWATAERYO-001', perform: true, authority });
  assert.equal(result.status, 'HOLD');
  assert.ok(result.blockers.includes('AUTHORITY_VERIFIER_REQUIRED'));
  assert.equal(fake.calls.run, 0);
});

test('현재 revision과 scope가 맞고 정본 verifier가 승인한 경우에만 외부 실행한다', async () => {
  const fake = fakeRuntime();
  const aiops = projectRegistry.projects.find(p => p.project_id === 'aiops');
  const cap = capabilityRegistry.capabilities.find(c => c.id === 'operations.penalty.prepare');
  const authority = {
    status: 'GRANTED', order_id: 'ORD-001', work_id: 'GWATAERYO-001',
    capability_id: cap.id, project_id: 'aiops',
    subject_revision: aiops.head_revision, ledger_head: 'head-001',
    scopes: [...cap.required_scopes], receipt_id: 'AUTH-001',
  };
  let verified = 0;
  const engine = createCapabilityEngine({
    capabilityRegistry, projectRegistry, runtime: fake.runtime,
    verifyAuthority: async () => { verified++; return true; },
  });
  const result = await engine.run({ text: '과태료 처리해', orderId: 'ORD-001', workId: 'GWATAERYO-001', perform: true, authority });
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.execution.external_effect, true);
  assert.equal(result.execution.authorization_source, 'AUTH-001');
  assert.equal(fake.calls.run, 1);
  assert.equal(verified, 1);
  assert.deepEqual(result.walls, ['관청발송', '문서24업로드']);
});

test('필수 입력 없는 module capability는 실행 전에 HOLD한다', async () => {
  const fake = fakeRuntime();
  const engine = createCapabilityEngine({ capabilityRegistry, projectRegistry, runtime: fake.runtime });
  const result = await engine.run({ text: '과태료 실행기록 검증해' });
  assert.equal(result.status, 'HOLD');
  assert.ok(result.blockers.includes('INPUT_REQUIRED_MANIFEST'));
  assert.equal(fake.calls.module, 0);
});

test('결과는 공통 Work Result 계약으로 돌아온다', async () => {
  const engine = createCapabilityEngine({ capabilityRegistry, projectRegistry });
  const result = await engine.run({ text: '오늘 내가 볼 거 뭐 있어?' });
  assert.equal(result.schema, 'ai-core-work-result/v1');
  assert.equal(result.capability_id, 'core.brief');
  assert.equal(result.project_id, 'ai-core');
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.execution.external_effect, false);
});
