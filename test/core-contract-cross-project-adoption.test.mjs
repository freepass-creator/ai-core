import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { bridgeLegacyAdapterResult } from '../src/contracts/legacy-adapter-bridge.mjs';

const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const [types,sourceSchema,adapterResultSchema,receiptSchema,erpSource,estimateFixture,errorRegistry]=await Promise.all([
  read('contracts/core-types.schema.json'),
  read('contracts/core-source-registry.schema.json'),
  read('contracts/core-adapter-result.schema.json'),
  read('contracts/core-receipt.schema.json'),
  read('registry/adoption/freepasserp4-products.source-registry.json'),
  read('registry/adoption/freepass-estimate-quote-execution.fixture.json'),
  read('registry/core-error-codes.json')
]);
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv);
for(const s of [types,sourceSchema,adapterResultSchema,receiptSchema]) ajv.addSchema(s);

test('ERP4 documented ERP5 product SSOT is representable as a scoped Core source registry without fallback',()=>{
  const validate=ajv.getSchema('https://schemas.freepass.ai/core/source-registry/v1');
  assert.equal(validate(erpSource),true);
  assert.equal(erpSource.canonical_owner,'freepasserp5');
  assert.equal(erpSource.sources.filter(x=>x.role==='CANONICAL').length,1);
  assert.equal(erpSource.fallback_policy.mode,'NONE');
});

test('Estimate freepass-quote-execution/v1 shape shadow-projects to Core adapter result preserving HOLD evidence',()=>{
  const q=estimateFixture.execution;
  const canonical=bridgeLegacyAdapterResult({
    legacy:q,
    adapterId:'freepass-estimate.quote-provider',
    adapterVersion:'shadow-v1',
    providerId:q.provider,
    sourceRevision:q.subject_revision,
    correlationId:q.request_id,
    retryable:true,
    startedAt:q.started_at,
    endedAt:q.ended_at
  });
  const validate=ajv.getSchema('https://schemas.freepass.ai/core/adapter-result/v1');
  assert.equal(validate(canonical),true);
  assert.equal(canonical.status,'HOLD');
  assert.equal(canonical.provider_id,'external:welrix');
  assert.ok(canonical.issues.some(x=>x.message==='PROVIDER_UNAVAILABLE'));
  assert.deepEqual(canonical.evidence_refs,['provider-policy:fail-closed']);
});

test('Core receipt can preserve launched/committed/confirmed evidence milestones without defining workflow state',()=>{
  const validate=ajv.getSchema('https://schemas.freepass.ai/core/receipt/v1');
  const receipt={
    schema_version:'core-receipt/v1',receipt_id:'sales_rcpt_001',operation_id:'sales_sms_001',
    operation_kind:'sales.message.send',actor:'user:staff',executor:'freepass-sales',correlation_id:'corr_sales_001',
    status:'SUCCEEDED',reason_code:null,
    input:{digest:'sha256:'+'a'.repeat(64),refs:['lead:01000000000']},
    output:{digest:'sha256:'+'b'.repeat(64),refs:['firestore:promotion-message']},
    source_revision:'fe69f76d81f4b9acd6f67f7b3f4ef5619f5e33d1',
    started_at:'2026-09-19T12:50:00Z',ended_at:'2026-09-19T12:50:02Z',
    evidence_refs:['server:promotion-message'],
    milestones:[
      {stage:'LAUNCHED',observed_at:'2026-09-19T12:50:00Z',evidence_refs:['intent:sms-app']},
      {stage:'SERVER_COMMITTED',observed_at:'2026-09-19T12:50:01Z',evidence_refs:['firestore:write']},
      {stage:'BUSINESS_CONFIRMED',observed_at:'2026-09-19T12:50:02Z',evidence_refs:['server:promotion-message']}
    ],
    reproducibility:{deterministic:false,executor_version:'v240',environment_revision:'web-v240',command_ref:'promotion.send'}
  };
  assert.equal(validate(receipt),true);
});

test('Admin CANCELLED can map to a stable Core machine error family',()=>{
  const cancelled=errorRegistry.codes.find(x=>x.code==='CANCELLED');
  assert.deepEqual(cancelled,{code:'CANCELLED',category:'USER',default_http_status:409,retryable:false});
});
