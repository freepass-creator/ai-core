import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const adoption=JSON.parse(await readFile(new URL('../registry/core-contract-adoption.json',import.meta.url),'utf8'));
const contracts=JSON.parse(await readFile(new URL('../registry/core-contracts.json',import.meta.url),'utf8'));

test('each pilot project accounts for every canonical C contract exactly once',()=>{
  const ids=contracts.contracts.map(x=>x.id).sort();
  assert.equal(adoption.entries.length,4);
  for(const entry of adoption.entries){
    const actual=entry.assessments.map(x=>x.contract_id).sort();
    assert.deepEqual(actual,ids,entry.project_id);
  }
});

test('Estimate is the first external project with a declared SHADOW Core adapter-result binding',()=>{
  const estimate=adoption.entries.find(x=>x.project_id==='freepass-estimate');
  const adapterResult=estimate.assessments.find(x=>x.contract_id==='core.adapter-result.v1');
  assert.equal(adapterResult.classification,'CORE_MATCH');
  assert.equal(adapterResult.binding_state,'SHADOW');
});

test('workflow-owned domain code content is not stolen by C',()=>{
  for(const projectId of ['freepasserp4','freepass-admin','freepass-sales']){
    const entry=adoption.entries.find(x=>x.project_id===projectId);
    const codes=entry.assessments.find(x=>x.contract_id==='core.code-set.v1');
    assert.equal(codes.classification,'D_OWNED_WORKFLOW');
    assert.equal(codes.priority,'NA');
  }
});

test('no pilot project claims cutover before Core contract equivalence proof',()=>{
  for(const entry of adoption.entries){
    assert.equal(entry.phase,'INVENTORY');
    assert.equal(entry.assessments.some(x=>['CUTOVER_READ','CUTOVER_WRITE','RETIRED'].includes(x.binding_state)),false);
  }
});
