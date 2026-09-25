import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeStreamAtomically } from '../lib/atomic-stream-write.mjs';

const root = mkdtempSync(join(tmpdir(), 'aiops-atomic-write-test-'));
const target = join(root, 'existing.bin');
writeFileSync(target, 'keep');
const chunks = async function* () { yield Buffer.from('new'); yield Buffer.from(' data'); };
await assert.rejects(() => writeStreamAtomically(target, chunks(), { maxBytes: 3 }), /상한/);
assert.equal(readFileSync(target, 'utf8'), 'keep', '실패하면 기존 목적지를 보존해야 한다');
assert.equal(readdirSync(root).filter((name) => name.includes('.download-')).length, 0, '실패 staging은 남기지 않는다');
await writeStreamAtomically(target, chunks(), { maxBytes: 10 });
assert.equal(readFileSync(target, 'utf8'), 'new data');
rmSync(root, { recursive: true, force: true });
console.log('atomic-stream-write tests: PASS');
