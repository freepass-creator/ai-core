import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { buildProofInputBinding, proofInputSetDigest, verifyProofInputBinding } from '../src/contracts/proof-input-binding.mjs';

const types=JSON.parse(await readFile(new URL('../contracts/core-types.schema.json',import.meta.url),'utf8'));
const proof=JSON.parse(await readFile(new URL('../contracts/core-proof-input-binding.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv); ajv.addSchema(types); ajv.addSchema(proof);
const validate=ajv.getSchema('https://schemas.freepass.ai/core/proof-input-binding/v1');

const inputs=[
  {role:'SOURCE',ref:'src/calc.ts',digest:'sha256:'+'a'.repeat(64),revision:'git:abc'},
  {role:'CHECKER',ref:'test/calc.test.ts',digest:'sha256:'+'b'.repeat(64),revision:'git:def'},
  {role:'FIXTURE',ref:'fixtures/cases.json',digest:'sha256:'+'c'.repeat(64),revision:null}
];

test('proof input binding is deterministic regardless of input ordering',()=>{
  const a=buildProofInputBinding(inputs);
  const b=buildProofInputBinding([...inputs].reverse());
  assert.equal(a.input_set_digest,b.input_set_digest);
  assert.equal(proofInputSetDigest(inputs),a.input_set_digest);
  assert.equal(validate(a),true);
});

test('changed checker implementation makes prior proof stale',()=>{
  const binding=buildProofInputBinding(inputs);
  const changed=structuredClone(inputs);
  changed[1].digest='sha256:'+'d'.repeat(64);
  const result=verifyProofInputBinding(binding,changed);
  assert.equal(result.status,'STALE');
  assert.equal(result.reason,'PROOF_INPUTS_CHANGED');
  assert.equal(result.changes.some(x=>x.key==='CHECKER::test/calc.test.ts'&&x.kind==='CHANGED'),true);
});

test('added or removed fixture invalidates prior proof',()=>{
  const binding=buildProofInputBinding(inputs);
  const removed=verifyProofInputBinding(binding,inputs.slice(0,2));
  assert.equal(removed.status,'STALE');
  assert.equal(removed.changes.some(x=>x.kind==='REMOVED'),true);
  const added=verifyProofInputBinding(binding,[...inputs,{role:'FIXTURE',ref:'fixtures/new.json',digest:'sha256:'+'e'.repeat(64),revision:null}]);
  assert.equal(added.status,'STALE');
  assert.equal(added.changes.some(x=>x.kind==='ADDED'),true);
});

test('tampered binding digest is invalid instead of stale',()=>{
  const binding=buildProofInputBinding(inputs);
  binding.input_set_digest='sha256:'+'f'.repeat(64);
  const result=verifyProofInputBinding(binding,inputs);
  assert.equal(result.status,'INVALID');
  assert.equal(result.reason,'BINDING_DIGEST_MISMATCH');
});
