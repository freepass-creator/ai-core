import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSourceRequirements, bindResolvedSources } from '../src/source-resolver.mjs';

test('development requires project, aiops control, devcenter registry and inspection', () => {
  const req = resolveSourceRequirements({project:'freepasserp4',domain:'development'});
  assert.deepEqual(req.filter(x=>x.required).map(x=>`${x.system}:${x.kind}`), ['project:instructions','aiops:control','devcenter:registry','devcenter:inspection']);
});

test('missing required source holds', () => {
  const req = [{system:'aiops',kind:'control',required:true}];
  assert.equal(bindResolvedSources(req, [])[0].status,'HOLD');
});

test('authoritative versioned source binds', () => {
  const req = [{system:'aiops',kind:'control',required:true}];
  const got = bindResolvedSources(req,[{system:'aiops',kind:'control',status:'authoritative',location:'docs/CONTROL_PLANE.md',revision_or_sha:'abc'}]);
  assert.equal(got[0].status,'BOUND');
});

test('multiple authoritative sources hold instead of guessing', () => {
  const req = [{system:'project',kind:'instructions',required:true}];
  const got = bindResolvedSources(req,[
    {system:'project',kind:'instructions',status:'authoritative',location:'A',revision_or_sha:'1'},
    {system:'project',kind:'instructions',status:'authoritative',location:'B',revision_or_sha:'2'}
  ]);
  assert.equal(got[0].status,'HOLD');
});
