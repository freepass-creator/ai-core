import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkResult } from '../src/engine/result-envelope.mjs';

const plan=mode=>({
  order_id:'ORD-1',work_id:'WORK-1',project_id:'project-a',capability_id:'cap-a',
  subject_revision:'a'.repeat(40),mode,walls:[],authorization_source:null,
});
const adapterResult={
  status:'SUCCEEDED',summary:'adapter reported success',data:{ok:true},evidence:[],artifacts:[],checks:[],blockers:[],external_effect:true,
};

test('non-external capability modes cannot false-green an observed external effect',()=>{
  for(const mode of ['READ_ONLY','LOCAL_MUTATION']){
    const result=createWorkResult({plan:plan(mode),status:'SUCCEEDED',adapterResult,performed:true,clock:()=>0});
    assert.equal(result.status,'HOLD');
    assert.equal(result.execution.external_effect,true);
    assert.equal(result.outcome.observed,false);
    assert.ok(result.blockers.includes('CAPABILITY_EFFECT_BOUNDARY_VIOLATION'));
  }
});

test('external mutation may report an observed external effect without being downgraded',()=>{
  const result=createWorkResult({plan:plan('EXTERNAL_MUTATION'),status:'SUCCEEDED',adapterResult,performed:true,clock:()=>0});
  assert.equal(result.status,'SUCCEEDED');
  assert.equal(result.execution.external_effect,true);
  assert.equal(result.outcome.observed,true);
  assert.deepEqual(result.blockers,[]);
});
