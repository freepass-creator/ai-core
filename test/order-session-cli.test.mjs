import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

function cli(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/orders.mjs', ...args], { cwd });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

test('operator CLI creates, selects, claims and exports one bounded session pack', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ai-core-session-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const db = join(root, 'orders.sqlite');
  const input = join(root, 'request.json');
  const pack = join(root, 'session.md');
  await writeFile(input, JSON.stringify({
    requestId: 'cli-flow-request', title: 'local flow', intent: 'verify local handoff flow',
    project: 'ai-core', criteria: ['session packet exists'], kind: 'general', source: 'test',
  }));
  const prefix = ['--local', '--db', db];
  const createdRun = await cli([...prefix, 'create', input], process.cwd());
  assert.equal(createdRun.code, 0, createdRun.stderr);
  const created = JSON.parse(createdRun.stdout);
  const nextRun = await cli([...prefix, 'next', 'codex'], process.cwd());
  assert.equal(nextRun.code, 0, nextRun.stderr);
  assert.equal(JSON.parse(nextRun.stdout).orderId, created.id);
  const claimRun = await cli([...prefix, 'claim-next', 'codex'], process.cwd());
  assert.equal(claimRun.code, 0, claimRun.stderr);
  const claimed = JSON.parse(claimRun.stdout);
  assert.equal(claimed.status, 'CLAIMED');
  assert.ok(claimed.lease.token);
  assert.equal(JSON.stringify(claimed.packet).includes(claimed.lease.token), false);
  const packRun = await cli([...prefix, 'session-pack', created.id, 'T1', pack], process.cwd());
  assert.equal(packRun.code, 0, packRun.stderr);
  assert.equal(JSON.parse(packRun.stdout).authority, false);
  const markdown = await readFile(pack, 'utf8');
  assert.match(markdown, new RegExp(created.id));
  assert.equal(markdown.includes(claimed.lease.token), false);
  const overwrite = await cli([...prefix, 'session-pack', created.id, 'T1', pack], process.cwd());
  assert.equal(overwrite.code, 1);
});
