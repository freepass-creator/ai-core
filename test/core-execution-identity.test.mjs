import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import {
  bindExecutionAttempt,
  createExecutionIdentity,
  sameLogicalExecution
} from '../src/contracts/execution-identity.mjs';

const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const [types,executionSchema,requestSchema,adapterSchema,receiptSchema,eventSchema]=await Promise.all([
  read('contracts/core-types.schema.json'),
  read('contracts/core-execution-identity.schema.json'),
  read('contracts/core-request-context.schema.json'),
  read('contracts/core-adapter-result.schema.json'),
  read('contracts/core-receipt.schema.json'),
  read('contracts/core-event.schema.json')
]);

const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv);
for(const schema of [types,executionSchema,requestSchema,adapterSchema,receiptSchema,eventSchema]) ajv.addSchema(schema);

const dimensions={
  operation_kind:'erp4.settlement.recover',
  logical_slot:'2026-09-20',
  subject_scope:{scope_type:'supplier',scope_key:'supplier_001'},
  semantic_input_digest:'sha256:'+'a'.repeat(64)
};
const identity=createExecutionIdentity({
  logicalExecutionId:'lexec_001',
  dimensions,
  createdAt:'2026-09-20T00:00:00Z'
});
const native=bindExecutionAttempt(identity,{
  attemptId:'attempt_native_001',
  attemptSequence:1,
  executionPath:'NATIVE'
});
const fallback=bindExecutionAttempt(identity,{
  attemptId:'attempt_fallback_001',
  attemptSequence:2,
  executionPath:'FALLBACK',
  parentAttemptId:'attempt_native_001'
});

test('logical execution identity is stable across native and fallback attempts',()=>{
  const validate=ajv.getSchema('https://schemas.freepass.ai/core/execution-identity/v1');
  assert.equal(validate(identity),true);
  assert.equal(sameLogicalExecution(native,fallback),true);
  assert.equal(native.attempt_id===fallback.attempt_id,false);
});

test('identity digest changes when a logical dimension changes',()=>{
  const changed=createExecutionIdentity({
    logicalExecutionId:'lexec_001',
    dimensions:{...dimensions,logical_slot:'2026-09-21'},
    createdAt:'2026-09-20T00:00:00Z'
  });
  assert.equal(sameLogicalExecution(identity,changed),false);
});

test('request context can bind an attempt without replacing request or idempotency identity',()=>{
  const validate=ajv.getSchema('https://schemas.freepass.ai/core/request-context/v1');
  const request={
    schema_version:'core-request-context/v1',
    request_id:'req_001',
    correlation_id:'corr_001',
    actor:{actor_id:'system:recovery',actor_type:'SYSTEM'},
    expected_revision:null,
    idempotency:{
      mode:'REQUIRED',
      key:'idem_attempt_fallback_001',
      semantic_payload_digest:'sha256:'+'b'.repeat(64)
    },
    execution: fallback
  };
  assert.equal(validate(request),true);
  assert.notEqual(request.request_id,request.execution.logical_execution_id);
  assert.notEqual(request.idempotency.key,request.execution.logical_execution_id);
});

test('adapter result, receipt and event can carry the same logical execution binding',()=>{
  const adapter=ajv.getSchema('https://schemas.freepass.ai/core/adapter-result/v1');
  assert.equal(adapter({
    schema_version:'core-adapter-result/v1',
    adapter_id:'erp4.recovery',
    adapter_version:'1.0.0',
    provider_id:'supplier',
    source_revision:'source-r1',
    correlation_id:'corr_001',
    execution:fallback,
    status:'SUCCEEDED',
    retryable:false,
    data:{recovered:true},
    issues:[],
    evidence_refs:['receipt:recovery'],
    started_at:'2026-09-20T00:00:00Z',
    ended_at:'2026-09-20T00:00:02Z'
  }),true);

  const receipt=ajv.getSchema('https://schemas.freepass.ai/core/receipt/v1');
  assert.equal(receipt({
    schema_version:'core-receipt/v1',
    receipt_id:'rcpt_001',
    operation_id:'op_001',
    operation_kind:'erp4.settlement.recover',
    actor:'system:recovery',
    executor:'erp4',
    correlation_id:'corr_001',
    execution:fallback,
    status:'SUCCEEDED',
    reason_code:null,
    input:{digest:'sha256:'+'b'.repeat(64),refs:['slot:2026-09-20']},
    output:{digest:'sha256:'+'c'.repeat(64),refs:['settlement:001']},
    source_revision:'source-r1',
    started_at:'2026-09-20T00:00:00Z',
    ended_at:'2026-09-20T00:00:02Z',
    evidence_refs:['provider:success'],
    reproducibility:{
      deterministic:false,
      executor_version:'1.0.0',
      environment_revision:'prod-r1',
      command_ref:'settlement.recover'
    }
  }),true);

  const event=ajv.getSchema('https://schemas.freepass.ai/core/event/v1');
  assert.equal(event({
    schema_version:'core-event/v1',
    event_id:'evt_001',
    event_type:'freepass.settlement.recovery_completed',
    event_version:'v1',
    producer:'erp4',
    occurred_at:'2026-09-20T00:00:02Z',
    recorded_at:'2026-09-20T00:00:02Z',
    correlation_id:'corr_001',
    causation_id:'attempt_fallback_001',
    execution:fallback,
    subject:{type:'settlement',id:'settlement_001',revision:'r2'},
    payload:{result:'SUCCEEDED'},
    evidence_refs:['receipt:rcpt_001']
  }),true);
});
