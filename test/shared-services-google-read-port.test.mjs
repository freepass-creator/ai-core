import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createGoogleReadTransport } from '../shared-services/google/read-transport.mjs';

const readJson=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const types=readJson('contracts/core-types.schema.json');
const portSchema=readJson('contracts/core-port.schema.json');
const adapterSchema=readJson('contracts/core-adapter.schema.json');
const bindingSchema=readJson('contracts/core-binding-profile.schema.json');
const port=readJson('shared-services/google/ports/google-api-read.v1.json');
const adapter=readJson('shared-services/google/adapters/shared-google-read-shadow.v1.json');
const binding=readJson('shared-services/google/bindings/aiops-google-read-shadow.v1.json');

const ajv=new Ajv2020({allErrors:true,strict:false});
addFormats(ajv);
for(const schema of [types,portSchema,adapterSchema,bindingSchema]) ajv.addSchema(schema);

const response=(status,body)=>({
  status,
  ok:status>=200&&status<300,
  text:async()=>typeof body==='string'?body:JSON.stringify(body)
});

test('Google read Port, provider Adapter and AIOps Binding reuse canonical Core contracts',()=>{
  const validatePort=ajv.getSchema('https://schemas.freepass.ai/core/port/v1');
  const validateAdapter=ajv.getSchema('https://schemas.freepass.ai/core/adapter/v1');
  const validateBinding=ajv.getSchema('https://schemas.freepass.ai/core/binding-profile/v1');

  assert.equal(validatePort(port),true,JSON.stringify(validatePort.errors));
  assert.equal(validateAdapter(adapter),true,JSON.stringify(validateAdapter.errors));
  assert.equal(validateBinding(binding),true,JSON.stringify(validateBinding.errors));

  assert.equal(port.port_id,'google.api.read');
  assert.equal(port.direction,'READ');
  assert.equal(port.side_effects,false);
  assert.equal(adapter.port_id,port.port_id);
  assert.equal(adapter.side_effects,false);
  assert.equal(adapter.project_scope,null);

  const bound=binding.service_bindings[0].ports[0];
  assert.equal(bound.port_id,port.port_id);
  assert.equal(bound.adapter_id,adapter.adapter_id);
  assert.equal(binding.project_id,'aiops');
  assert.equal(binding.environment,'shadow-not-runtime');
  assert.equal(binding.verification_state,'PARTIAL');
});

test('Google read transport injects its bearer token and caller cannot override it',async()=>{
  const calls=[];
  const transport=createGoogleReadTransport({
    accessToken:'trusted-token',
    fetchImpl:async(url,opts)=>{calls.push({url,opts});return response(200,{ok:true});},
    sleep:async()=>{}
  });
  const result=await transport.call('https://www.googleapis.com/drive/v3/files',{
    headers:{Authorization:'Bearer attacker','x-test':'1'}
  });
  assert.deepEqual(result,{ok:true});
  assert.equal(calls.length,1);
  assert.equal(calls[0].opts.headers.Authorization,'Bearer trusted-token');
  assert.equal(calls[0].opts.headers['x-test'],'1');
});

test('Google read transport fails closed on writes before provider fetch',async()=>{
  let called=false;
  const transport=createGoogleReadTransport({
    accessToken:'token',
    fetchImpl:async()=>{called=true;return response(200,{})},
    sleep:async()=>{}
  });
  await assert.rejects(
    transport.call('https://sheets.googleapis.com/v4/spreadsheets/abc',{method:'POST'}),
    error=>error?.code==='GOOGLE_READ_METHOD_REQUIRED'
  );
  assert.equal(called,false);
});

test('Google read transport uses bounded fixed retries only for observed transient read statuses',async()=>{
  const statuses=[500,503,200];
  const waits=[];
  let calls=0;
  const transport=createGoogleReadTransport({
    accessToken:'token',
    fetchImpl:async()=>response(statuses[calls++],calls===3?{done:true}:{temporary:true}),
    sleep:async ms=>waits.push(ms),
    maxRetries:6,
    retryWaitMs:20000
  });
  const result=await transport.call('https://sheets.googleapis.com/v4/spreadsheets/abc');
  assert.deepEqual(result,{done:true});
  assert.equal(calls,3);
  assert.deepEqual(waits,[20000,20000]);
});

test('Google read transport does not retry non-transient failures',async()=>{
  let calls=0;
  const transport=createGoogleReadTransport({
    accessToken:'token',
    fetchImpl:async()=>{calls++;return response(404,{error:'missing'});},
    sleep:async()=>{throw new Error('sleep must not run');}
  });
  await assert.rejects(
    transport.call('https://www.googleapis.com/drive/v3/files/missing'),
    error=>error?.code==='GOOGLE_API_HTTP_ERROR'&&error?.status===404
  );
  assert.equal(calls,1);
});
