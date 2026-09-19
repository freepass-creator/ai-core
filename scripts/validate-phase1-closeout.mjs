import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { evaluatePhase1Closeout } from '../src/engine/phase1-closeout.mjs';

const path = resolve(process.argv[2] ?? 'registry/phase1-closeout.json');
const manifest = JSON.parse(await readFile(path, 'utf8'));
const result = evaluatePhase1Closeout(manifest);

if (!result.valid) {
  for (const error of result.errors) console.error(`FAIL: ${error}`);
  process.exitCode = 1;
} else if (result.lockable) {
  console.log('PASS: AI Core Phase 1 is eligible for BASELINE_LOCKED');
} else {
  const blockers = manifest.lanes.filter(lane => lane.status !== 'PASS').map(lane => `${lane.id}:${lane.status}`);
  console.log(`PASS: closeout registry is valid but not lockable (${blockers.join(', ') || 'global gates/CI remain'})`);
}
