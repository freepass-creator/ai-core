import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { createDefaultBuiltins } from '../src/engine/builtins.mjs';
import { bridgeLegacyAdapterResult } from '../src/contracts/legacy-adapter-bridge.mjs';

const types=JSON.parse(await readFile(new URL('../contracts/core-types.schema.json',import.meta.url),'utf8'));
const adapterResult=JSON.parse(await readFile(new URL('../contracts/core-adapter-result.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv); ajv.addSchema(types); ajv.addSchema(adapterResult);
const validate=ajv.getSchema('https://schemas.freepass.ai/core/adapter-result/v1');

test('actual core.brief builtin result can be shadow-projected into canonical adapter result',async()=>{
  const builtins=createDefaultBuiltins();
  const legacy=await builtins.get('core.brief').invoke({input:{headline:'contract adoption'}});
  assert.equal(legacy.status,'SUCCEEDED');

  const canonical=bridgeLegacyAdapterResult({
    legacy,
    adapterId:'core.brief',
    adapterVersion:'shadow-v1',
    providerId:null,
    sourceRevision:'git:444066bea9ac00e4cf4ba539c7b5344154bd407e',
    correlationId:'adoption_core_brief_001',
    retryable:false,
    startedAt:'2026-09-19T13:10:00Z',
    endedAt:'2026-09-19T13:10:01Z'
  });

  assert.equal(validate(canonical),true);
  assert.equal(canonical.status,legacy.status);
  assert.deepEqual(canonical.data,legacy.data);
  assert.deepEqual(canonical.evidence_refs,legacy.evidence);
});

test('actual work.projection HOLD preserves blocker semantics through canonical shadow',async()=>{
  const builtins=createDefaultBuiltins();
  const legacy=await builtins.get('work.projection').invoke({input:{order_id:'ORD-001'}});
  assert.equal(legacy.status,'HOLD');
  assert.ok(legacy.blockers.includes('WORK_PROJECTION_PROVIDER_REQUIRED'));

  const canonical=bridgeLegacyAdapterResult({
    legacy,
    adapterId:'work.projection',
    adapterVersion:'shadow-v1',
    providerId:null,
    sourceRevision:'git:444066bea9ac00e4cf4ba539c7b5344154bd407e',
    correlationId:'adoption_work_projection_001',
    retryable:false,
    startedAt:'2026-09-19T13:11:00Z',
    endedAt:'2026-09-19T13:11:01Z'
  });

  assert.equal(validate(canonical),true);
  assert.equal(canonical.status,'HOLD');
  assert.ok(canonical.issues.some(x=>x.code==='LEGACY_BLOCKER'&&x.message==='WORK_PROJECTION_PROVIDER_REQUIRED'));
});
