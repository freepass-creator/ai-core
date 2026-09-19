import test from 'node:test';
import assert from 'node:assert/strict';
import { findBreakingSchemaChanges, checkCompatibility } from '../scripts/check-contract-compatibility.mjs';

test('additive optional property is compatible inside the same contract major',()=>{
  const before={type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false};
  const after={type:'object',properties:{id:{type:'string'},note:{type:'string'}},required:['id'],additionalProperties:false};
  assert.deepEqual(findBreakingSchemaChanges(before,after),[]);
});

test('required field addition and enum removal are breaking',()=>{
  const before={type:'object',properties:{status:{enum:['A','B']}},required:['status']};
  const after={type:'object',properties:{status:{enum:['A']},reason:{type:'string'}},required:['status','reason']};
  const codes=findBreakingSchemaChanges(before,after).map(x=>x.code);
  assert.ok(codes.includes('ENUM_VALUE_REMOVED'));
  assert.ok(codes.includes('REQUIRED_FIELD_ADDED'));
});

test('type narrowing nullability and tighter limits are breaking',()=>{
  const before={type:['string','null'],maxLength:200};
  const after={type:'string',maxLength:100};
  const codes=findBreakingSchemaChanges(before,after).map(x=>x.code);
  assert.ok(codes.includes('TYPE_NARROWED'));
  assert.ok(codes.includes('MAXLENGTH_TIGHTENED'));
});

test('canonical contract removal is rejected',async()=>{
  const baseRegistry={contracts:[{id:'core.test.v1',status:'CANONICAL',path:'contracts/test.json'}]};
  const currentRegistry={contracts:[]};
  const result=await checkCompatibility({
    baseRegistry,currentRegistry,
    readBaseSchema:async()=>({type:'object'}),readCurrentSchema:async()=>({type:'object'})
  });
  assert.equal(result.status,'INVALID');
  assert.equal(result.errors[0].code,'CANONICAL_CONTRACT_REMOVED');
});

test('breaking schema change is allowed only by introducing a new major instead of mutating v1',async()=>{
  const baseRegistry={contracts:[{id:'core.test.v1',status:'CANONICAL',path:'contracts/test-v1.json'}]};
  const currentRegistry={contracts:[
    {id:'core.test.v1',status:'CANONICAL',path:'contracts/test-v1.json'},
    {id:'core.test.v2',status:'CANONICAL',path:'contracts/test-v2.json'}
  ]};
  const before={type:'object',properties:{id:{type:['string','null']}},required:['id']};
  const unchanged=structuredClone(before);
  const result=await checkCompatibility({
    baseRegistry,currentRegistry,
    readBaseSchema:async()=>before,
    readCurrentSchema:async path=>path.endsWith('v1.json')?unchanged:{type:'object',properties:{id:{type:'string'}},required:['id']}
  });
  assert.equal(result.status,'VALID');
});
