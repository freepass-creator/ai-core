import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {fileURLToPath} from 'node:url';
import {finalizeCoreHubReceipt} from '../src/engine/core-hub-receipt.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(relative)=>JSON.parse(fs.readFileSync(path.join(ROOT,relative),'utf8'));
const specialized=[
  'data-receipt.schema.json','delivery-receipt.schema.json','design-adoption-receipt.schema.json',
  'design-visual-receipt.schema.json','document-receipt.schema.json','quality-receipt.schema.json'
];

test('all hub receipt schemas extend the single core receipt envelope',()=>{
  const ajv=new Ajv2020({allErrors:true,strict:false});
  addFormats(ajv);
  ajv.addSchema(read('contracts/core-types.schema.json'));
  ajv.addSchema(read('contracts/core-execution-identity.schema.json'));
  ajv.addSchema(read('contracts/core-receipt.schema.json'));
  for(const file of specialized){
    const schema=read(`devcenter/contracts/${file}`);
    assert.equal(schema.allOf[0].$ref,'https://schemas.freepass.ai/core/receipt/v1');
    assert.doesNotThrow(()=>ajv.compile(schema),file);
  }
});

test('hub finalizer emits deterministic core fields and preserves specialized payload',()=>{
  const input={subject:{revision:'1'.repeat(40)},checks:[{status:'HOLD',evidence:['evidence/check.json']}],result:{status:'HOLD'}};
  const receipt=finalizeCoreHubReceipt({kind:'data',prefix:'data',payload:input,legacyContract:'devcenter-data-receipt/v1',createdAt:'2026-09-22T00:00:00.000Z'});
  assert.equal(receipt.schema_version,'core-receipt/v1');
  assert.equal(receipt.receipt_kind,'hub.data');
  assert.equal(receipt.status,'HOLD');
  assert.equal(receipt.source_revision,'1'.repeat(40));
  assert.equal(receipt.payload.legacy_contract,'devcenter-data-receipt/v1');
  assert.deepEqual(receipt.payload.checks,input.checks);
  assert.match(receipt.input.digest,/^sha256:[a-f0-9]{64}$/);
  assert.ok(receipt.evidence_refs.includes('evidence/check.json'));
});
