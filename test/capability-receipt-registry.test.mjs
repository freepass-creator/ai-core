import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCapabilityRegistryReferences } from '../src/engine/capability-registry.mjs';

const capabilities=JSON.parse(await readFile(new URL('../registry/capabilities.json',import.meta.url),'utf8'));
const projects=JSON.parse(await readFile(new URL('../registry/projects.json',import.meta.url),'utf8'));

test('과태료 execution receipt 계약이 현재 registry에서 유효하다',()=>{
  const result=validateCapabilityRegistryReferences(capabilities,projects);
  assert.equal(result.status,'VALID');
  const cap=capabilities.capabilities.find(x=>x.id==='operations.penalty.prepare');
  assert.equal(cap.receipt.schema_value,'gwataeryo-run-manifest/v1');
  assert.deepEqual(cap.receipt.success_states,['COMPLETED']);
});

test('receipt directory는 프로젝트 밖 절대경로나 .. 탈출을 허용하지 않는다',()=>{
  for(const directory of ['../tmp','/tmp/receipt','C:\\tmp\\receipt']){
    const broken=structuredClone(capabilities);
    broken.capabilities.find(x=>x.id==='operations.penalty.prepare').receipt.directory=directory;
    assert.throws(()=>validateCapabilityRegistryReferences(broken,projects),/RECEIPT_DIRECTORY_UNSAFE/);
  }
});

test('같은 terminal state를 성공/HOLD/실패에 동시에 선언할 수 없다',()=>{
  const broken=structuredClone(capabilities);
  const receipt=broken.capabilities.find(x=>x.id==='operations.penalty.prepare').receipt;
  receipt.hold_states.push('COMPLETED');
  assert.throws(()=>validateCapabilityRegistryReferences(broken,projects),/RECEIPT_STATES_OVERLAP/);
});
