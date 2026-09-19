import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';

const registry=JSON.parse(await readFile(new URL('../registry/core-contracts.json',import.meta.url),'utf8'));
const schemas=await Promise.all(registry.contracts.map(async contract=>JSON.parse(await readFile(new URL('../'+contract.path,import.meta.url),'utf8'))));
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv);
for(const schema of schemas) ajv.addSchema(schema);
const schema=id=>ajv.getSchema(id);

test('core money uses minor units plus ISO currency and percentage is percentage-points',()=>{
  const types=schemas.find(x=>x.$id==='https://schemas.freepass.ai/core/types/v1');
  const money=ajv.compile({$ref:'https://schemas.freepass.ai/core/types/v1#/$defs/money'});
  assert.equal(money({amount_minor:125000,currency:'KRW'}),true);
  assert.equal(money({amount_minor:1250.5,currency:'KRW'}),false);
  assert.match(types.$defs.percentage.description,/10 means 10%/);
});

test('provenance requires an authoritative source revision or immutable checksum',()=>{
  const validate=schema('https://schemas.freepass.ai/core/provenance/v1');
  const base={
    schema_version:'core-provenance/v1',
    canonical_owner:'vehicle-master',
    canonical_writer:'erp4-publisher',
    subject:{entity_type:'vehicle_trim',id:'trim_123',revision:'r42'},
    source:{source_id:'supplier_1',source_type:'SHEET',source_ref:'sheet:cars!A2:Z2',observed_at:'2026-09-19T12:00:00Z'},
    normalization:{normalizer_id:'supplier-row',normalizer_version:'2.1.0'}
  };
  assert.equal(validate({...base,source:{...base.source,source_revision:'sheet-rev-7'}}),true);
  assert.equal(validate(base),false);
});

test('adapter result makes retryability, version and evidence explicit',()=>{
  const validate=schema('https://schemas.freepass.ai/core/adapter-result/v1');
  const good={
    schema_version:'core-adapter-result/v1',adapter_id:'welrix.quote',adapter_version:'1.4.0',
    provider_id:'welrix',source_revision:'catalog-88',correlation_id:'corr_001',
    status:'SUCCEEDED',retryable:false,data:{monthly_rent:500000},issues:[],
    evidence_refs:['provider-response:sha256:abc'],started_at:'2026-09-19T12:00:00Z',ended_at:'2026-09-19T12:00:01Z'
  };
  assert.equal(validate(good),true);
  const bad={...good}; delete bad.adapter_version;
  assert.equal(validate(bad),false);
});

test('error contract rejects project-local string-only errors',()=>{
  const validate=schema('https://schemas.freepass.ai/core/error/v1');
  assert.equal(validate({error:'lock_conflict'}),false);
  assert.equal(validate({
    type:'https://errors.freepass.ai/core/version-mismatch',title:'Version conflict',status:409,
    code:'VERSION_MISMATCH',category:'USER',correlation_id:'corr_002',retryable:false,
    meta:{expected_revision:'r1',current_revision:'r2'}
  }),true);
});

test('event envelope has correlation, causation, producer, versions and subject revision without owning workflow state',()=>{
  const validate=schema('https://schemas.freepass.ai/core/event/v1');
  const event={
    schema_version:'core-event/v1',event_id:'evt_001',event_type:'freepass.quote.created',event_version:'v1',
    producer:'freepass-sales',occurred_at:'2026-09-19T12:00:00Z',recorded_at:'2026-09-19T12:00:00Z',
    correlation_id:'corr_003',causation_id:null,subject:{type:'quote',id:'quote_001',revision:'r1'},
    payload:{quote_id:'quote_001'},evidence_refs:['receipt:quote_001']
  };
  assert.equal(validate(event),true);
  assert.equal('state' in event,false);
});

test('receipt preserves input/output digests, executor revision and evidence',()=>{
  const validate=schema('https://schemas.freepass.ai/core/receipt/v1');
  const receipt={
    schema_version:'core-receipt/v1',receipt_id:'rcpt_001',operation_id:'op_001',operation_kind:'quote.calculate',
    actor:'user:123',executor:'freepass-estimate',correlation_id:'corr_004',status:'SUCCEEDED',reason_code:null,
    input:{digest:'sha256:'+'a'.repeat(64),refs:['quote-input:1']},
    output:{digest:'sha256:'+'b'.repeat(64),refs:['quote-output:1']},source_revision:'git:abc',
    started_at:'2026-09-19T12:00:00Z',ended_at:'2026-09-19T12:00:01Z',evidence_refs:['artifact:quote.json'],
    reproducibility:{deterministic:true,executor_version:'1.0.0',environment_revision:'node-24',command_ref:'quote.calculate/v1'}
  };
  assert.equal(validate(receipt),true);
  const bad=structuredClone(receipt); bad.input.digest='abc';
  assert.equal(validate(bad),false);
});
