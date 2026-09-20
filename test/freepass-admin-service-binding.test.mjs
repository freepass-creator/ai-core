import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { resolveServiceBinding } from '../src/contracts/engine-adapter-contract.mjs';
import { createApplicationServiceRuntime } from '../src/engine/application-service-runtime.mjs';

async function json(path){return JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));}

const [
  types, serviceSchema, portSchema, adapterSchema, connectorSchema, bindingSchema,
  service, applicationPort, productPort, actorPort, appAdapter, productAdapter, connector, profile
]=await Promise.all([
  json('contracts/core-types.schema.json'),
  json('contracts/core-application-service.schema.json'),
  json('contracts/core-port.schema.json'),
  json('contracts/core-adapter.schema.json'),
  json('contracts/core-connector.schema.json'),
  json('contracts/core-binding-profile.schema.json'),
  json('registry/adoption/freepass-admin-application.service.json'),
  json('registry/adoption/freepass-admin-application-repository.port.json'),
  json('registry/adoption/freepass-admin-product-read.port.json'),
  json('registry/adoption/freepass-admin-actor-provider.port.json'),
  json('registry/adoption/freepass-admin-file-application.adapter.json'),
  json('registry/adoption/freepass-admin-file-product-read.adapter.json'),
  json('registry/adoption/freepass-admin-json-file.connector.json'),
  json('registry/adoption/freepass-admin-application.binding-profile.json')
]);

const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv); ajv.addSchema(types);
for(const schema of [serviceSchema,portSchema,adapterSchema,connectorSchema,bindingSchema]) ajv.addSchema(schema);

test('Admin current-head SHADOW artifacts satisfy Core schemas',()=>{
  const pairs=[
    ['https://schemas.freepass.ai/core/application-service/v1',service],
    ['https://schemas.freepass.ai/core/port/v1',applicationPort],
    ['https://schemas.freepass.ai/core/port/v1',productPort],
    ['https://schemas.freepass.ai/core/port/v1',actorPort],
    ['https://schemas.freepass.ai/core/adapter/v1',appAdapter],
    ['https://schemas.freepass.ai/core/adapter/v1',productAdapter],
    ['https://schemas.freepass.ai/core/connector/v1',connector],
    ['https://schemas.freepass.ai/core/binding-profile/v1',profile]
  ];
  for(const [id,value] of pairs){
    const validate=ajv.getSchema(id);
    assert.ok(validate,id);
    assert.equal(validate(value),true,JSON.stringify(validate.errors));
  }
});

test('Admin Service binding is truthfully HOLD because actor.provider is unresolved',()=>{
  const result=resolveServiceBinding({
    service,adapters:[appAdapter,productAdapter],profile,requireVerified:false
  });
  assert.equal(result.status,'HOLD');
  assert.ok(result.errors.includes('PORT_UNRESOLVED:actor.provider'));
  assert.equal(result.selected_adapters.length,2);
});

test('strict Admin Service runtime also preserves PARTIAL verification as a blocker',async()=>{
  let calls=0;
  const runtime=createApplicationServiceRuntime({
    service,adapters:[appAdapter,productAdapter],profile,
    adapterImplementations:{},
    implementation:async()=>{calls++;return{status:'SUCCEEDED',data:{}};}
  });
  assert.equal(runtime.binding.status,'HOLD');
  assert.ok(runtime.binding.errors.includes('BINDING_PROFILE_VERIFICATION_PARTIAL'));
  assert.ok(runtime.binding.errors.includes('PORT_UNRESOLVED:actor.provider'));
  const result=await runtime.run('submit_application',{},{correlation_id:'admin-shadow-1',actor:{id:'u1'},idempotency_key:'sub-1'});
  assert.equal(result.status,'HOLD');
  assert.equal(result.reason,'SERVICE_RUNTIME_BINDING_HOLD');
  assert.equal(calls,0);
});

test('Admin file adapters declare only their own filesystem operations',()=>{
  assert.deepEqual(appAdapter.connector_binding.operation_ids,['application.read','application.mutate']);
  assert.deepEqual(productAdapter.connector_binding.operation_ids,['product.read']);
  assert.equal(connector.transport,'FILESYSTEM');
});
