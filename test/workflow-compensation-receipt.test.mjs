import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { executeCompensatedEffectsWithReceipts } from '../src/workflow/compensation-receipt-runtime.mjs';

const types=JSON.parse(await readFile(new URL('../contracts/core-types.schema.json',import.meta.url),'utf8'));
const execution=JSON.parse(await readFile(new URL('../contracts/core-execution-identity.schema.json',import.meta.url),'utf8'));
const proof=JSON.parse(await readFile(new URL('../contracts/core-proof-input-binding.schema.json',import.meta.url),'utf8'));
const receiptSchema=JSON.parse(await readFile(new URL('../contracts/core-receipt.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv);
for(const schema of [types,execution,proof,receiptSchema]) ajv.addSchema(schema);
const validate=ajv.getSchema('https://schemas.freepass.ai/core/receipt/v1');

const effects=[
  {effect_id:'write-a',compensation_mode:'REQUIRED',compensation_action:'undo-a'},
  {effect_id:'write-b',compensation_mode:'REQUIRED',compensation_action:'undo-b'}
];

const receiptOptions=(id)=>({
  receipt_id:id,
  actor:'system:test',
  executor:'workflow.compensated-multiwrite',
  source_revision:'git:workflow',
  reproducibility:{
    deterministic:false,
    executor_version:'1.0.0',
    environment_revision:'env:test',
    command_ref:'compensated-multiwrite'
  },
  proof_inputs:[
    {role:'SOURCE',ref:'workflow-policy',digest:'sha256:'+'a'.repeat(64),revision:'git:workflow'}
  ]
});

function assertReceipt(value){
  assert.equal(validate(value),true,JSON.stringify(validate.errors));
}

test('all-success multi-effect execution emits parent plus EFFECT receipts',async()=>{
  const out=await executeCompensatedEffectsWithReceipts({
    effects,
    correlation_id:'corr-success',
    receipt:receiptOptions('receipt.multi.success'),
    execute_effect:async(effect)=>({
      status:'SUCCEEDED',
      data:{effect:effect.effect_id},
      evidence_refs:['effect:'+effect.effect_id]
    }),
    execute_compensation:async()=>{throw new Error('must not run');},
    clock:()=>Date.parse('2026-09-20T09:00:00Z')
  });

  assert.equal(out.execution_result.status,'SUCCEEDED');
  assert.equal(out.receipt.status,'SUCCEEDED');
  assert.equal(out.action_receipts.length,2);
  assert.deepEqual(out.receipt.child_receipts.map(x=>x.relation),['EFFECT','EFFECT']);
  assertReceipt(out.receipt);
  out.action_receipts.forEach(assertReceipt);
});

test('later failure plus successful compensation preserves original failure and receipt lineage',async()=>{
  const out=await executeCompensatedEffectsWithReceipts({
    effects,
    correlation_id:'corr-compensated',
    receipt:receiptOptions('receipt.multi.compensated'),
    execute_effect:async(effect)=>effect.effect_id==='write-a'
      ? {status:'SUCCEEDED',data:{written:'a'},receipt_ref:'receipt.repository.a'}
      : {status:'FAILED',error_code:'SECOND_WRITE_FAILED'},
    execute_compensation:async(step)=>({
      status:'SUCCEEDED',
      data:{undone:step.effect_id},
      receipt_ref:'receipt.repository.undo-a'
    }),
    clock:()=>Date.parse('2026-09-20T09:01:00Z')
  });

  assert.equal(out.execution_result.status,'FAILED');
  assert.equal(out.execution_result.action,'RETHROW_ORIGINAL_FAILURE');
  assert.equal(out.receipt.status,'FAILED');
  assert.equal(out.receipt.reason_code,'SECOND_WRITE_FAILED');
  assert.deepEqual(out.receipt.child_receipts.map(x=>x.relation),['EFFECT','EFFECT','COMPENSATION']);
  assert.equal(out.action_receipts[0].child_receipts[0].receipt_ref,'receipt.repository.a');
  assert.equal(out.action_receipts[2].child_receipts[0].receipt_ref,'receipt.repository.undo-a');
  assertReceipt(out.receipt);
  out.action_receipts.forEach(assertReceipt);
});

test('failed compensation yields PARTIAL parent receipt and explicit compensation evidence',async()=>{
  const out=await executeCompensatedEffectsWithReceipts({
    effects,
    correlation_id:'corr-partial',
    receipt:receiptOptions('receipt.multi.partial'),
    execute_effect:async(effect)=>effect.effect_id==='write-a'
      ? {status:'SUCCEEDED',data:{written:'a'}}
      : {status:'FAILED',error_code:'SECOND_WRITE_FAILED'},
    execute_compensation:async()=>({
      status:'FAILED',
      error_code:'COMPENSATION_STORE_FAILED',
      evidence_refs:['compensation:error']
    }),
    clock:()=>Date.parse('2026-09-20T09:02:00Z')
  });

  assert.equal(out.execution_result.status,'PARTIAL_STATE');
  assert.equal(out.execution_result.action,'ESCALATE');
  assert.equal(out.receipt.status,'PARTIAL');
  assert.equal(out.receipt.reason_code,'SECOND_WRITE_FAILED');
  assert.equal(out.receipt.child_receipts.at(-1).relation,'COMPENSATION');
  assert.equal(out.action_receipts.at(-1).reason_code,'COMPENSATION_STORE_FAILED');
  assertReceipt(out.receipt);
  out.action_receipts.forEach(assertReceipt);
});

test('action receipt preserves downstream execution receipt as child evidence',async()=>{
  const out=await executeCompensatedEffectsWithReceipts({
    effects:[{effect_id:'write-a',compensation_mode:'NOT_REQUIRED',non_compensated_reason:'append-only'}],
    correlation_id:'corr-child',
    receipt:receiptOptions('receipt.multi.child'),
    execute_effect:async()=>({
      status:'SUCCEEDED',
      data:{ok:true},
      receipt:{receipt_id:'receipt.service.downstream'}
    }),
    execute_compensation:async()=>({status:'SUCCEEDED'}),
    clock:()=>Date.parse('2026-09-20T09:03:00Z')
  });

  assert.equal(out.action_receipts.length,1);
  assert.deepEqual(out.action_receipts[0].child_receipts,[{
    receipt_ref:'receipt.service.downstream',
    relation:'OTHER'
  }]);
  assert.equal(out.receipt.child_receipts[0].relation,'EFFECT');
  assertReceipt(out.action_receipts[0]);
  assertReceipt(out.receipt);
});
