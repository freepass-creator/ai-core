import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { bridgeLegacyAdapterResult } from '../src/contracts/legacy-adapter-bridge.mjs';

const types=JSON.parse(await readFile(new URL('../contracts/core-types.schema.json',import.meta.url),'utf8'));
const resultSchema=JSON.parse(await readFile(new URL('../contracts/core-adapter-result.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:false});
addFormats(ajv);
ajv.addSchema(types);
ajv.addSchema(resultSchema);
const validate=ajv.getSchema('https://schemas.freepass.ai/core/adapter-result/v1');

test('legacy adapter result can shadow-project into canonical v1 without granting authority',()=>{
  const legacy={
    status:'HOLD',summary:'needs review',data:{x:1},evidence:['artifact:1'],
    checks:[{name:'provider-shape',status:'FAIL',detail:'missing field'}],
    blockers:['manual review required'],external_effect:false
  };
  const bridged=bridgeLegacyAdapterResult({
    legacy,adapterId:'legacy.project-adapter',adapterVersion:'0.9.0',providerId:'legacy-provider',
    sourceRevision:'git:abc',correlationId:'corr_legacy_001',retryable:false,
    startedAt:'2026-09-19T13:00:00Z',endedAt:'2026-09-19T13:00:01Z'
  });
  assert.equal(validate(bridged),true);
  assert.equal(bridged.status,'HOLD');
  assert.deepEqual(bridged.evidence_refs,['artifact:1']);
  assert.equal(bridged.issues.some(x=>x.code==='LEGACY_BLOCKER'),true);
  assert.equal('authorization' in bridged,false);
});

test('bridge refuses to guess retryability',()=>{
  assert.throws(()=>bridgeLegacyAdapterResult({
    legacy:{status:'FAILED'},adapterId:'legacy.a',adapterVersion:'1',correlationId:'corr_legacy_002',
    startedAt:'2026-09-19T13:00:00Z',endedAt:'2026-09-19T13:00:01Z'
  }),/RETRYABLE_DECISION_REQUIRED/);
});
