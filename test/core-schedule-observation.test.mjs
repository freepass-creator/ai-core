import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';

const types=JSON.parse(await readFile(new URL('../contracts/core-types.schema.json',import.meta.url),'utf8'));
const execution=JSON.parse(await readFile(new URL('../contracts/core-execution-identity.schema.json',import.meta.url),'utf8'));
const observation=JSON.parse(await readFile(new URL('../contracts/core-schedule-observation.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv); ajv.addSchema(types); ajv.addSchema(execution); ajv.addSchema(observation);
const validate=ajv.getSchema('https://schemas.freepass.ai/core/schedule-observation/v1');

test('schedule observation keeps logical slot, dispatch, attempt and completion distinct',()=>{
  const value={
    schema_version:'core-schedule-observation/v1',observation_id:'sched_001',operation_kind:'erp5.refresh',
    slot:{logical_slot:'2026-09-20T18:05:00+09:00',expected_at:'2026-09-20T18:05:00+09:00'},
    dispatch:{dispatch_id:'run_001',dispatched_at:'2026-09-20T19:02:00+09:00',provider_run_ref:'gha:123'},
    execution:{logical_execution_id:'exec_001',identity_digest:'sha256:'+'a'.repeat(64),attempt_id:'attempt_001',attempt_sequence:1,execution_path:'NATIVE',parent_attempt_id:null},
    completion:{status:'SUCCEEDED',completed_at:'2026-09-20T19:04:00+09:00',receipt_ref:'receipt:123'},
    timing_assessment:{classification:'LATE',policy_ref:'D:erp5.refresh-sla/v1',assessed_at:'2026-09-20T19:04:00+09:00',lateness_ms:3420000},
    observed_at:'2026-09-20T19:04:01+09:00'
  };
  assert.equal(validate(value),true,JSON.stringify(validate.errors));
});

test('missed slot can be represented without inventing a dispatch',()=>{
  const value={
    schema_version:'core-schedule-observation/v1',observation_id:'sched_002',operation_kind:'erp5.refresh',
    slot:{logical_slot:'2026-09-20T18:05:00+09:00',expected_at:'2026-09-20T18:05:00+09:00'},
    dispatch:null,execution:null,completion:null,
    timing_assessment:{classification:'MISSED',policy_ref:'D:erp5.refresh-sla/v1',assessed_at:'2026-09-20T18:35:00+09:00',lateness_ms:1800000},
    observed_at:'2026-09-20T18:35:00+09:00'
  };
  assert.equal(validate(value),true,JSON.stringify(validate.errors));
});

test('timing classification cannot exist without a policy reference',()=>{
  const value={
    schema_version:'core-schedule-observation/v1',observation_id:'sched_003',operation_kind:'erp5.refresh',
    slot:{logical_slot:'slot-1',expected_at:'2026-09-20T18:05:00+09:00'},dispatch:null,execution:null,completion:null,
    timing_assessment:{classification:'LATE',assessed_at:'2026-09-20T18:35:00+09:00',lateness_ms:1800000},
    observed_at:'2026-09-20T18:35:00+09:00'
  };
  assert.equal(validate(value),false);
});
