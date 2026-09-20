import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerminalReceiptReader } from '../src/engine/execution-receipt.mjs';

function fake(files = {}) {
  const mtimes = new Map(Object.entries(files).map(([name, value], i) => [name, { value, mtimeMs: 100 + i }]));
  return {
    files: mtimes,
    reader: createTerminalReceiptReader({
      listDirectory: async () => [...mtimes.keys()],
      readStat: async path => {
        const name = String(path).split(/[\\/]/).at(-1);
        const row = mtimes.get(name);
        if (!row) { const e = new Error('missing'); e.code='ENOENT'; throw e; }
        return { mtimeMs: row.mtimeMs };
      },
      readText: async path => {
        const name = String(path).split(/[\\/]/).at(-1);
        return JSON.stringify(mtimes.get(name).value);
      },
    }),
  };
}
const config = {
  kind: 'NEW_JSON_TERMINAL_RECEIPT',
  directory: 'tmp/과태료', prefix: '실행기록-', suffix: '.json',
  schema_field: 'schema', schema_value: 'gwataeryo-run-manifest/v1',
  state_field: 'state', success_states: ['COMPLETED'],
  hold_states: ['COMPLETED_WITH_HOLD'], failure_states: ['FAILED'],
};

test('명령 뒤 새 COMPLETED receipt가 생겨야 성공이다', async () => {
  const f=fake();
  const before=await f.reader.snapshot('/project',config);
  f.files.set('실행기록-new.json',{mtimeMs:999,value:{schema:'gwataeryo-run-manifest/v1',state:'COMPLETED'}});
  const out=await f.reader.reconcile('/project',config,before);
  assert.equal(out.status,'SUCCEEDED');
  assert.equal(out.state,'COMPLETED');
});

test('exit 성공 여부와 무관하게 receipt가 없으면 HOLD다', async () => {
  const f=fake();
  const before=await f.reader.snapshot('/project',config);
  const out=await f.reader.reconcile('/project',config,before);
  assert.equal(out.status,'HOLD');
  assert.equal(out.reason,'EXECUTION_RECEIPT_MISSING');
});

test('부분 완료는 성공으로 올리지 않는다', async () => {
  const f=fake();
  const before=await f.reader.snapshot('/project',config);
  f.files.set('실행기록-hold.json',{mtimeMs:999,value:{schema:'gwataeryo-run-manifest/v1',state:'COMPLETED_WITH_HOLD'}});
  const out=await f.reader.reconcile('/project',config,before);
  assert.equal(out.status,'HOLD');
  assert.equal(out.reason,'EXECUTION_RECEIPT_HOLD');
});

test('실패 receipt는 FAILED다', async () => {
  const f=fake();
  const before=await f.reader.snapshot('/project',config);
  f.files.set('실행기록-fail.json',{mtimeMs:999,value:{schema:'gwataeryo-run-manifest/v1',state:'FAILED'}});
  const out=await f.reader.reconcile('/project',config,before);
  assert.equal(out.status,'FAILED');
});

test('다른 schema나 비종료 상태를 성공으로 읽지 않는다', async () => {
  const f=fake();
  const before=await f.reader.snapshot('/project',config);
  f.files.set('실행기록-bad.json',{mtimeMs:999,value:{schema:'other',state:'COMPLETED'}});
  let out=await f.reader.reconcile('/project',config,before);
  assert.equal(out.reason,'EXECUTION_RECEIPT_SCHEMA_MISMATCH');

  f.files.clear();
  const before2=await f.reader.snapshot('/project',config);
  f.files.set('실행기록-running.json',{mtimeMs:1000,value:{schema:'gwataeryo-run-manifest/v1',state:'RUNNING'}});
  out=await f.reader.reconcile('/project',config,before2);
  assert.equal(out.reason,'EXECUTION_RECEIPT_NON_TERMINAL');
});

test('execution identity가 bind되지 않은 receipt는 복구 성공으로 올리지 않는다', async () => {
  const f=fake();
  const before=await f.reader.snapshot('/project',config);
  f.files.set('실행기록-b.json',{mtimeMs:999,value:{schema:'gwataeryo-run-manifest/v1',state:'COMPLETED',request_id:'exec-b'}});
  const out=await f.reader.reconcile('/project',config,before,{expectedIdentity:'exec-a'});
  assert.equal(out.status,'HOLD');
  assert.equal(out.reason,'EXECUTION_RECEIPT_IDENTITY_UNBOUND');
  assert.equal(out.identity_verified,false);
});

test('다른 execution identity의 terminal receipt는 복구하지 않는다', async () => {
  const f=fake();
  const bound={...config,identity_field:'request_id'};
  const before=await f.reader.snapshot('/project',bound);
  f.files.set('실행기록-b.json',{mtimeMs:999,value:{schema:'gwataeryo-run-manifest/v1',state:'COMPLETED',request_id:'exec-b'}});
  const out=await f.reader.reconcile('/project',bound,before,{expectedIdentity:'exec-a'});
  assert.equal(out.status,'HOLD');
  assert.equal(out.reason,'EXECUTION_RECEIPT_IDENTITY_MISMATCH');
  assert.equal(out.identity,'exec-b');
  assert.equal(out.identity_verified,false);
});

test('같은 execution identity의 terminal receipt만 복구한다', async () => {
  const f=fake();
  const bound={...config,identity_field:'request_id'};
  const before=await f.reader.snapshot('/project',bound);
  f.files.set('실행기록-a.json',{mtimeMs:999,value:{schema:'gwataeryo-run-manifest/v1',state:'COMPLETED',request_id:'exec-a'}});
  const out=await f.reader.reconcile('/project',bound,before,{expectedIdentity:'exec-a'});
  assert.equal(out.status,'SUCCEEDED');
  assert.equal(out.state,'COMPLETED');
  assert.equal(out.identity_verified,true);
});

test('동시 변경 receipt 중 더 최신인 다른 identity가 있어도 exact identity를 복구한다', async () => {
  const f=fake();
  const bound={...config,identity_field:'request_id'};
  const before=await f.reader.snapshot('/project',bound);
  f.files.set('실행기록-a.json',{mtimeMs:998,value:{schema:'gwataeryo-run-manifest/v1',state:'COMPLETED',request_id:'exec-a'}});
  f.files.set('실행기록-b.json',{mtimeMs:999,value:{schema:'gwataeryo-run-manifest/v1',state:'COMPLETED',request_id:'exec-b'}});
  const out=await f.reader.reconcile('/project',bound,before,{expectedIdentity:'exec-a'});
  assert.equal(out.status,'SUCCEEDED');
  assert.equal(out.receipt.request_id,'exec-a');
  assert.ok(out.path.endsWith('실행기록-a.json'));
  assert.equal(out.identity_verified,true);
});
