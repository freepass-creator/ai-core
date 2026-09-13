import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContext } from '../src/context-compiler.mjs';
import { resolveCapabilities } from '../src/capability-resolver.mjs';

test('context holds when required source lacks revision', () => {
  const out = compileContext({ task:{task_id:'T',project:'p',domain:'development'}, sourcePointers:[{location:'x',status:'unresolved',required:true}] });
  assert.equal(out.status,'HOLD');
});

test('context excludes unrelated failures', () => {
  const out = compileContext({ task:{task_id:'T',project:'freepasserp4',domain:'development'}, failures:[{scope:'other',id:1},{scope:'freepasserp4.ui',id:2}] });
  assert.deepEqual(out.relevant_failures.map(x=>x.id),[2]);
});

test('capability resolves one authoritative asset', () => {
  const out = resolveCapabilities(['dev.design.token'], {datasets:[{scope:'dev.design.token',role:'authoritative',source:{locator:'tokens.ts'}}]});
  assert.equal(out[0].status,'RESOLVED');
});

test('candidate is not promoted to authoritative', () => {
  const out = resolveCapabilities(['x'], {datasets:[{scope:'x',role:'candidate'}]});
  assert.equal(out[0].status,'CANDIDATE_ONLY');
});
