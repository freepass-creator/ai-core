import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { resolveBinding } from '../src/contracts/engine-adapter-contract.mjs';
import { createPortRuntime } from '../src/engine/port-runtime.mjs';

async function json(path){return JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));}

const [types,engineSchema,portSchema,adapterSchema,connectorSchema,bindingSchema,engine,port,adapter,connector,profile]=await Promise.all([
  json('contracts/core-types.schema.json'),
  json('contracts/core-engine.schema.json'),
  json('contracts/core-port.schema.json'),
  json('contracts/core-adapter.schema.json'),
  json('contracts/core-connector.schema.json'),
  json('contracts/core-binding-profile.schema.json'),
  json('registry/adoption/freepass-estimate-quote.engine.json'),
  json('registry/adoption/freepass-estimate-quote-provider.port.json'),
  json('registry/adoption/freepass-estimate-quote-provider.adapter.json'),
  json('registry/adoption/freepass-estimate-quote-http.connector.json'),
  json('registry/adoption/freepass-estimate-quote.binding-profile.json')
]);

const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv); ajv.addSchema(types);
for(const schema of [engineSchema,portSchema,adapterSchema,connectorSchema,bindingSchema]) ajv.addSchema(schema);

test('FreePass Estimate shadow artifacts satisfy canonical C schemas',()=>{
  for(const [id,value] of [
    ['https://schemas.freepass.ai/core/engine/v1',engine],
    ['https://schemas.freepass.ai/core/port/v1',port],
    ['https://schemas.freepass.ai/core/adapter/v1',adapter],
    ['https://schemas.freepass.ai/core/connector/v1',connector],
    ['https://schemas.freepass.ai/core/binding-profile/v1',profile]
  ]){
    const validate=ajv.getSchema(id);
    assert.ok(validate,id);
    assert.equal(validate(value),true,JSON.stringify(validate.errors));
  }
});

test('shadow profile resolves structurally but strict runtime correctly remains HOLD until verified',()=>{
  const structural=resolveBinding({engine,adapters:[adapter],profile});
  assert.equal(structural.status,'RESOLVED');
  assert.equal(structural.selected_adapters[0].port_id,'quote.provider.calculate');

  const runtime=createPortRuntime({engine,adapters:[adapter],profile,implementations:{}});
  assert.equal(runtime.binding.status,'HOLD');
  assert.ok(runtime.binding.errors.includes('BINDING_PROFILE_VERIFICATION_NOT_RUN'));
});

test('Estimate authoritative provider policy remains one-attempt and fail-closed in Core shadow',()=>{
  assert.equal(adapter.retry_policy.max_attempts,1);
  assert.equal(adapter.retry_policy.backoff,'NONE');
  assert.equal(adapter.side_effects,false);
  assert.equal(adapter.timeout_ms,12000);
  assert.equal(adapter.failure_mapping.some(x=>x.provider_code==='PROVIDER_UNAVAILABLE'&&x.core_code==='UPSTREAM_UNAVAILABLE'),true);
});


test('Estimate Adapter declares only project-owned quote HTTP Connector operations',()=>{
  assert.equal(adapter.connector_binding.connector_id,'freepass-estimate.quote-http');
  assert.deepEqual(adapter.connector_binding.operation_ids,['quote.standard','quote.external']);
  assert.deepEqual(connector.operations.map(x=>x.operation_id),['quote.standard','quote.external']);
});
