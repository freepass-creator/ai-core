import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { evaluateSelfEvolution } from '../scripts/evaluate-self-evolution.mjs';
import { evaluateEvolutionLine, evaluateEvolutionStream } from '../src/improvement/evaluate-evolution-jsonl.mjs';

test('reproduces shared evaluator failures and keeps them as explicit unknown holds', () => {
  for (const input of [{ candidate: null }, { candidate: { target_metrics: 'oops' } }, null]) {
    assert.throws(() => evaluateSelfEvolution(input), TypeError);
    const record = evaluateEvolutionLine(JSON.stringify(input), 7);
    assert.deepEqual(record, { line: 7, auto_adopted: false, execution_authorized: false, result: {
      status: 'HOLD_EVALUATION_ERROR', reasons: ['EVALUATOR_THROWN'],
      auto_adopted: false, execution_authorized: false
    } });
  }
});

test('ordinary policy result is returned unchanged', () => {
  const input = { candidate: {}, baseline: {}, trial: {} };
  assert.deepEqual(evaluateEvolutionLine(JSON.stringify(input), 1).result,
    evaluateSelfEvolution(input));
});

test('invalid JSON is distinct from evaluator failure and does not leak content', () => {
  const result = evaluateEvolutionLine('private-content {', 2);
  assert.equal(result.result.status, 'HOLD_INVALID_JSON');
  assert.equal(JSON.stringify(result).includes('private-content'), false);
});

test('CLI continues past malformed and throwing records, retaining physical line numbers', () => {
  const child = spawnSync(process.execPath, ['src/improvement/evaluate-evolution-jsonl.mjs'], {
    input: '\r\n{bad}\r\n{"candidate":null}\r\n{"candidate":{}}', encoding: 'utf8'
  });
  assert.equal(child.status, 2, child.stderr);
  assert.equal(child.stderr, '');
  const records = child.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(records.map(record => record.line), [2, 3, 4]);
  assert.deepEqual(records.map(record => record.result.status),
    ['HOLD_INVALID_JSON', 'HOLD_EVALUATION_ERROR', 'HOLD_INCOMPLETE_CANDIDATE']);
  for (const record of records) {
    assert.equal(record.execution_authorized, false);
    assert.equal(record.auto_adopted, false);
  }
});

test('CLI policy HOLD exits zero for successful evaluation, never indicating adoption', () => {
  const child = spawnSync(process.execPath, ['src/improvement/evaluate-evolution-jsonl.mjs'], {
    input: '{"candidate":{}}\n', encoding: 'utf8'
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(JSON.parse(child.stdout).result.auto_adopted, false);
});

test('CLI rejects ignored positional arguments', () => {
  const child = spawnSync(process.execPath, ['src/improvement/evaluate-evolution-jsonl.mjs', 'unused'], {
    input: '', encoding: 'utf8'
  });
  assert.equal(child.status, 2);
  assert.equal(child.stdout, '');
  assert.match(child.stderr, /Usage:/);
});

test('output failure rejects instead of claiming a fully evaluated stream', async () => {
  const output = new Writable({ write(chunk, encoding, callback) { callback(new Error('disk full')); } });
  await assert.rejects(evaluateEvolutionStream(Readable.from(['{}\n{}\n']), output), /disk full/);
});

test('input I/O failure rejects instead of returning an empty success', async () => {
  const input = new Readable({ read() { this.destroy(new Error('read failed')); } });
  const output = new Writable({ write(chunk, encoding, callback) { callback(); } });
  await assert.rejects(evaluateEvolutionStream(input, output), /read failed/);
});

test('stream returns row-error summary after delivering all records', async () => {
  const chunks = [];
  const output = new Writable({ write(chunk, encoding, callback) { chunks.push(String(chunk)); callback(); } });
  const result = await evaluateEvolutionStream(Readable.from(['{bad}\nnull\n{}']), output);
  assert.deepEqual(result, { input_error: true });
  assert.equal(chunks.length, 3);
});

test('empty input has no evaluation or adoption result', () => {
  const child = spawnSync(process.execPath, ['src/improvement/evaluate-evolution-jsonl.mjs'], {
    input: ' \n\r\n', encoding: 'utf8'
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, '');
});

test('CLI accepts a single UTF-8 file BOM without asking for a re-save', () => {
  const child = spawnSync(process.execPath, ['src/improvement/evaluate-evolution-jsonl.mjs'], {
    input: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"candidate":{}}\r\n')]),
    encoding: 'utf8'
  });
  assert.equal(child.status, 0, child.stderr);
  const record = JSON.parse(child.stdout);
  assert.equal(record.line, 1);
  assert.deepEqual(record.result, evaluateSelfEvolution({ candidate: {} }));
});

test('BOM inside a later nonblank record is not silently repaired', () => {
  const child = spawnSync(process.execPath, ['src/improvement/evaluate-evolution-jsonl.mjs'], {
    input: '{}\n\uFEFF{}\n', encoding: 'utf8'
  });
  assert.equal(child.status, 2);
  const records = child.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(records[1].line, 2);
  assert.equal(records[1].result.status, 'HOLD_INVALID_JSON');
});
