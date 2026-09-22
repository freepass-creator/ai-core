import test from 'node:test';
import assert from 'node:assert/strict';
import {loadReadiness,reportReadiness,scoreHub,validateReadiness} from '../scripts/hub-readiness.mjs';

const {readiness,hubRegistry}=loadReadiness();

test('readiness covers exactly the seven official hubs',()=>{
  assert.deepEqual(validateReadiness(readiness,hubRegistry),[]);
  assert.equal(readiness.hubs.length,7);
  assert.deepEqual(
    new Set(readiness.hubs.map((h)=>h.id)),
    new Set(hubRegistry.hubs.map((h)=>h.id))
  );
});

test('readiness uses eight evidence axes and a 90 percent target',()=>{
  assert.equal(readiness.scoring.axes.length,8);
  assert.equal(readiness.target_percent,90);
});

test('READY cannot be reached with a non-verified critical axis',()=>{
  const sample=structuredClone(readiness.hubs[0]);
  for(const axis of readiness.scoring.axes) sample.axes[axis]={level:'VERIFIED',evidence:['test']};
  sample.axes.runtime={level:'PARTIAL',evidence:['test'],gap:'not complete'};
  const result=scoreHub(sample,readiness);
  assert.notEqual(result.status,'READY');
  assert.equal(result.critical_verified,false);
});

test('unknown or missing hub fails readiness validation',()=>{
  const broken=structuredClone(readiness);
  broken.hubs.pop();
  assert.ok(validateReadiness(broken,hubRegistry).some((x)=>x.startsWith('READINESS_')));
});

test('current baseline produces no READY claim without evidence',()=>{
  const report=reportReadiness(readiness,hubRegistry);
  assert.equal(report.status,'PASS');
  assert.equal(report.summary.ready,0);
  assert.equal(report.hubs.length,7);
});
