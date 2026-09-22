import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateConsumer,planPromotion,validateEngineeringAssets,verifyLocalSources} from '../scripts/engineering-hub.mjs';

const registry={
  contract:'devcenter-engineering-assets/v1',
  assets:[
    {
      id:'shared.example',kind:'SCRIPT',status:'ACTIVE',
      source:{repository:'freepass-creator/devcenter',revision:'1'.repeat(40),path:'script.mjs',blob_sha:'2'.repeat(40)},
      interface:{inputs:[],outputs:[],side_effects:[]},
      verification:['test/example'],
      lifecycle:{owner:'engineering-hub',supersedes:null,superseded_by:null,rollback_ref:'git:example'}
    }
  ]
};

test('asset registry validates lifecycle and revision pins',()=>{
  assert.deepEqual(validateEngineeringAssets(registry),[]);
});

test('consumer fails closed on unknown assets',()=>{
  const result=evaluateConsumer({asset_ids:['missing.asset']},registry);
  assert.equal(result.status,'FAIL');
});

test('candidate asset keeps consumer on HOLD',()=>{
  const candidate=structuredClone(registry);
  candidate.assets[0].status='CANDIDATE';
  const result=evaluateConsumer({asset_ids:['shared.example']},candidate);
  assert.equal(result.status,'HOLD');
});

test('promotion requires evidence',()=>{
  assert.throws(()=>planPromotion(registry.assets[0],{decision:'ADOPT',evidence_refs:[]}),/ENGINEERING_PROMOTION_EVIDENCE_REQUIRED/);
});

test('promotion plan never mutates source registry directly',()=>{
  const before=structuredClone(registry.assets[0]);
  const plan=planPromotion(registry.assets[0],{decision:'DEPRECATE',evidence_refs:['review/1']});
  assert.equal(plan.target_status,'DEPRECATED');
  assert.deepEqual(registry.assets[0],before);
});

test('unmounted source repository is HOLD not PASS',()=>{
  const result=verifyLocalSources(registry,{repoRoots:{}});
  assert.equal(result[0].status,'HOLD');
});
