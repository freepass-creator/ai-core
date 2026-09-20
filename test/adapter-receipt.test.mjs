import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { buildAdapterReceipt, canonicalDigest } from '../src/contracts/adapter-receipt.mjs';

const types=JSON.parse(await readFile(new URL('../contracts/core-types.schema.json',import.meta.url),'utf8'));
const execution=JSON.parse(await readFile(new URL('../contracts/core-execution-identity.schema.json',import.meta.url),'utf8'));
const proof=JSON.parse(await readFile(new URL('../contracts/core-proof-input-binding.schema.json',import.meta.url),'utf8'));
const receipt=JSON.parse(await readFile(new URL('../contracts/core-receipt.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv);
for(const schema of [types,execution,proof,receipt]) ajv.addSchema(schema);
const validate=ajv.getSchema('https://schemas.freepass.ai/core/receipt/v1');

const result={
  schema_version:'core-adapter-result/v1',
  adapter_id:'freepass-estimate.quote-provider',
  adapter_version:'freepass-quote-provider/v1',
  provider_id:'external:erp:test',
  source_revision:'b526fdc73e812dcb0594d10caf2123bbade1d38b',
  correlation_id:'quote-1',
  status:'SUCCEEDED',
  retryable:false,
  data:{monthlyRent:123400},
  issues:[],
  evidence_refs:['provider:test'],
  started_at:'2026-09-20T08:00:00Z',
  ended_at:'2026-09-20T08:00:01Z'
};

test('adapter result becomes a schema-valid receipt with deterministic input/output digests',()=>{
  const value=buildAdapterReceipt({
    receipt_id:'receipt.quote.1',
    operation_id:'quote-1',
    operation_kind:'quote.calculate',
    actor:'user',
    executor:'freepass-estimate.quote-provider',
    adapter_result:result,
    input:{vehicle:'v1',term:36},
    input_refs:['request:quote-1'],
    output_refs:['quote:result-1'],
    proof_inputs:[
      {role:'SOURCE',ref:'quote-engine',digest:'sha256:'+'a'.repeat(64),revision:'git:engine'},
      {role:'CONFIG',ref:'provider-profile',digest:'sha256:'+'b'.repeat(64),revision:'git:config'}
    ],
    reproducibility:{deterministic:false,executor_version:'freepass-quote-provider/v1',environment_revision:'env:shadow',command_ref:'quote.calculate'}
  });
  assert.equal(validate(value),true,JSON.stringify(validate.errors));
  assert.equal(value.input.digest,canonicalDigest({vehicle:'v1',term:36}));
  assert.equal(value.output.digest,canonicalDigest({monthlyRent:123400}));
  assert.equal(value.proof_input_binding.schema_version,'core-proof-input-binding/v1');
  assert.equal(value.reason_code,null);
});

test('failed adapter result carries stable reason and no fabricated output digest',()=>{
  const failed={...result,status:'FAILED',data:null,retryable:true,issues:[{code:'UPSTREAM_UNAVAILABLE',severity:'ERROR'}]};
  const value=buildAdapterReceipt({
    receipt_id:'receipt.quote.2',operation_id:'quote-2',operation_kind:'quote.calculate',
    actor:'user',executor:'freepass-estimate.quote-provider',adapter_result:failed,input:{vehicle:'v1'},
    reproducibility:{deterministic:false,executor_version:'v1',environment_revision:null,command_ref:null}
  });
  assert.equal(value.reason_code,'UPSTREAM_UNAVAILABLE');
  assert.equal(value.output.digest,null);
  assert.equal(validate(value),true,JSON.stringify(validate.errors));
});

test('canonical digest is key-order independent',()=>{
  assert.equal(canonicalDigest({a:1,b:2}),canonicalDigest({b:2,a:1}));
});
