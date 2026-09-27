import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyProbe, inspectToolchain } from '../scripts/local-toolchain-doctor.mjs';

test('doctor distinguishes available, missing, blocked, timeout and command failure', () => {
  const results = [
    { status: 0, stdout: 'tool 1.2.3\n', stderr: '' },
    { error: { code: 'ENOENT' }, stdout: '', stderr: '' },
    { error: { code: 'EACCES' }, stdout: '', stderr: '' },
    { error: { code: 'ETIMEDOUT' }, stdout: '', stderr: '' },
    { status: 2, stdout: '', stderr: 'bad config\nSECRET second line' },
  ];
  const statuses = results.map((fixture) => classifyProbe('tool', 'test', [], () => fixture));
  assert.deepEqual(statuses.map((item) => item.status), ['AVAILABLE', 'MISSING', 'BLOCKED', 'TIMEOUT', 'FAILED']);
  assert.equal(statuses[0].detail, 'tool 1.2.3');
  assert.equal(statuses[4].detail, 'bad config');
});

test('report counts states and does not claim execution authority', () => {
  const probes = [['ok', 'test', []], ['absent', 'test', []]];
  const report = inspectToolchain(probes, (name) => name === 'ok' ? { status: 0, stdout: 'ok 1', stderr: '' } : { error: { code: 'ENOENT' } });
  assert.equal(report.counts.AVAILABLE, 1);
  assert.equal(report.counts.MISSING, 1);
  assert.equal(report.authority, 'LOCAL_OBSERVATION_ONLY');
});
