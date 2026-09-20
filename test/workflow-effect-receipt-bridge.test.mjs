import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { createExecutionIdentity, bindExecutionAttempt } from '../src/contracts/execution-identity.mjs';
import { createApplicationServiceRuntime } from '../src/engine/application-service-runtime.mjs';
import { createConnectorRuntime } from '../src/engine/connector-runtime.mjs';
import { bridgeReceiptsToEffectEvidence } from '../src/workflow/effect-receipt-bridge.mjs';
import { planEffectResume } from '../src/workflow/effect-resume-planner.mjs';

const types=JSON.parse(await readFile(new URL('../contracts/core-types.schema.json',import.meta.url),'utf8'));
const executionSchema=JSON.parse(await readFile(new URL('../contracts/core-execution-identity.schema.json',import.meta.url),'utf8'));
const proof=JSON.parse(await readFile(new URL('../contracts/core-proof-input-binding.schema.json',import.meta.url),'utf8'));
const receiptSchema=JSON.parse(await readFile(new URL('../contracts/core-receipt.schema.json',import.meta.url),'utf8'));
const bridgeSchema=JSON.parse(await readFile(new URL('../contracts/workflow-effect-receipt-binding.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv);
for(const schema of [types,executionSchema,proof,receiptSchema,bridgeSchema]) ajv.addSchema(schema);
const validateReceipt=ajv.getSchema('https://schemas.freepass.ai/core/receipt/v1');
const validateBinding=ajv.getSchema('https://freepass.local/contracts/workflow-effect-receipt-binding/v1');

const identity=createExecutionIdentity({
  logicalExecutionId:'logical.bridge.test',
  dimensions:{
    operation_kind:'workflow.bridge-test',
    logical_slot:'slot-1',
    subject_scope:{scope_type:'application',scope_key:'app-1'},
    semantic_input_digest:'sha256:'+'1'.repeat(64)
  },
  createdAt:'2026-09-20T11:00:00Z'
});
const attempt1=bindExecutionAttempt(identity,{
  attemptId:'attempt-bridge-1',attemptSequence:1,executionPath:'NATIVE'
});
const attempt2=bindExecutionAttempt(identity,{
  attemptId:'attempt-bridge-2',attemptSequence:2,executionPath:'FALLBACK',parentAttemptId:'attempt-bridge-1'
});

const service={
  schema_version:'core-application-service-contract/v1',
  service_id:'demo.bridge.service',version:'1.0.0',
  source:{locator:'src/service.mjs',revision:'git:s1'},
  use_cases:[{
    name:'submit',input_contract:'SubmitInput',output_contract:'SubmitResult',
    side_effects:true,idempotency:'REQUIRED',actor_requirement:'REQUIRED',
    transaction_boundary:'REPOSITORY_ATOMIC',
    error_codes:['PERSISTENCE_ERROR']
  }],
  required_ports:[{port_id:'entity.repository',port_version:'v1'}],
  verification_profile:['unit']
};

const repository={
  schema_version:'core-repository-contract/v1',
  repository_id:'demo.bridge.repository',repository_version:'1.0.0',
  port_id:'entity.repository',port_version:'v1',project_scope:'demo',
  source:{locator:'src/repository.mjs',revision:'git:r1'},entity_scope:'entity',
  operations:[
    {operation_id:'entity.create',kind:'CREATE',side_effects:true,idempotency:'REQUIRED',expected_revision:'NOT_APPLICABLE'}
  ],
  atomicity:{scope:'SINGLE_AGGREGATE',partial_write_possible:false},
  concurrency:{mode:'PROCESS_SERIALIZED',lost_update_protection:true},
  revision_policy:'NONE',
  connector_binding:{
    connector_id:'demo.bridge.store',connector_version:'1.0.0',
    operation_map:[
      {repository_operation_id:'entity.create',connector_operation_ids:['entity.write']}
    ]
  },
  data_classification:['INTERNAL'],
  error_codes:['PERSISTENCE_ERROR'],
  verification_profile:['contract']
};

const profile={
  schema_version:'core-binding-profile/v1',
  profile_id:'binding.demo.bridge',
  project_id:'demo',environment:'test',subject_revision:'git:p1',
  engine_bindings:[],
  service_bindings:[{
    service_id:'demo.bridge.service',service_version:'1.0.0',
    ports:[{port_id:'entity.repository',repository_id:'demo.bridge.repository'}]
  }],
  config_refs:[],secret_refs:[],verification_state:'PASSED_WITHIN_SCOPE'
};

const connector={
  schema_version:'core-connector-contract/v1',
  connector_id:'demo.bridge.store',connector_version:'1.0.0',
  transport:'DATABASE',provider_scope:'demo',
  source:{locator:'src/store.mjs',revision:'git:c1'},
  operations:[{operation_id:'entity.write',verb:'PUT',target_ref:'entities',side_effects:true}],
  auth:{mode:'NONE',credential_refs:[]},timeout_ms:1000,abort_supported:false,
  health_check:'ping',data_classification:['INTERNAL'],verification_profile:['contract']
};

function runtime({fail=false}={}){
  const transport=createConnectorRuntime({
    connector,
    implementation:async()=>({status:'SUCCEEDED',data:{ok:true}})
  });
  return createApplicationServiceRuntime({
    service,repositories:[repository],profile,
    repositoryImplementations:{
      'demo.bridge.repository':async({input,connector})=>{
        await connector.invoke('entity.write',input);
        return fail
          ? {status:'FAILED',error_code:'PERSISTENCE_ERROR'}
          : {status:'SUCCEEDED',data:{saved:input.id},revision:'r1'};
      }
    },
    connectors:{'demo.bridge.store':transport},
    implementation:async({input,ports})=>{
      const saved=await ports.invoke('entity.repository',{id:input.id},{
        repository_operation_id:'entity.create'
      });
      return saved.status==='SUCCEEDED'
        ? {status:'SUCCEEDED',data:saved.data}
        : {status:'FAILED',error_code:'PERSISTENCE_ERROR'};
    }
  });
}

const bindings=[{
  schema_version:'workflow-effect-receipt-binding/v1',
  binding_id:'bridge.entity-create',
  effect_id:'create-entity',
  phase:'EFFECT',
  selector:{
    operation_kind:'entity.create',
    executor:'demo.bridge.repository'
  },
  child_relation:'REPOSITORY',
  require_execution_binding:true,
  partial_policy:'HOLD',
  proof_policy:'PRESERVE_AND_REVERIFY'
}];

const effects=[
  {effect_id:'create-entity',compensation_mode:'REQUIRED',compensation_action:'undo.create-entity'},
  {effect_id:'notify',compensation_mode:'NOT_REQUIRED',non_compensated_reason:'notification is append-only'}
];

test('binding fixture satisfies bridge schema',()=>{
  assert.equal(validateBinding(bindings[0]),true,JSON.stringify(validateBinding.errors));
});

test('real Service Repository child receipt is projected into workflow.effect evidence',async()=>{
  const out=await runtime().runWithReceipt('submit',{id:'x'},{
    actor:{id:'u1'},idempotency_key:'submission-1',correlation_id:'corr-1',execution:attempt1,
    receipt:{
      receipt_id:'receipt.service.bridge.1',
      actor:'user:u1',
      reproducibility:{
        deterministic:true,executor_version:'1.0.0',environment_revision:'git:p1',command_ref:'submit'
      }
    }
  });
  assert.equal(out.child_receipts.length,1);
  assert.deepEqual(out.receipt.execution,attempt1);
  assert.deepEqual(out.child_receipts[0].execution,attempt1);

  const bridged=bridgeReceiptsToEffectEvidence({
    bindings,
    receipts:[out.receipt,...out.child_receipts],
    target_execution:attempt2
  });
  assert.equal(bridged.status,'READY');
  assert.equal(bridged.evidence_records.length,1);
  const projected=bridged.evidence_records[0].receipt;
  assert.equal(projected.operation_kind,'workflow.effect');
  assert.equal(projected.metrics.effect_id,'create-entity');
  assert.equal(projected.metrics.bridge_binding_id,'bridge.entity-create');
  assert.equal(projected.child_receipts[0].receipt_ref,out.child_receipts[0].receipt_id);
  assert.equal(projected.child_receipts[0].relation,'REPOSITORY');
  assert.deepEqual(projected.execution,attempt1);
  assert.equal(validateReceipt(projected),true,JSON.stringify(validateReceipt.errors));

  const plan=planEffectResume({
    effects,
    target_execution:attempt2,
    evidence_records:bridged.evidence_records
  });
  assert.equal(plan.status,'RESUMABLE');
  assert.deepEqual(plan.actions.map(x=>[x.effect_id,x.action]),[
    ['create-entity','SKIP_ALREADY_APPLIED'],
    ['notify','RUN']
  ]);
});

test('failed Repository receipt projects FAILED effect evidence so effect remains runnable',async()=>{
  const out=await runtime({fail:true}).runWithReceipt('submit',{id:'x'},{
    actor:{id:'u1'},idempotency_key:'submission-2',correlation_id:'corr-2',execution:attempt1,
    receipt:{
      receipt_id:'receipt.service.bridge.2',
      actor:'user:u1',
      reproducibility:{
        deterministic:true,executor_version:'1.0.0',environment_revision:'git:p1',command_ref:'submit'
      }
    }
  });
  const bridged=bridgeReceiptsToEffectEvidence({
    bindings,receipts:[out.receipt,...out.child_receipts],target_execution:attempt2
  });
  assert.equal(bridged.status,'READY');
  assert.equal(bridged.evidence_records[0].receipt.status,'FAILED');

  const plan=planEffectResume({effects,target_execution:attempt2,evidence_records:bridged.evidence_records});
  assert.equal(plan.status,'RESUMABLE');
  assert.equal(plan.resume_from_effect_id,'create-entity');
  assert.equal(plan.actions[0].reason,'PRIOR_EFFECT_FAILED');
});

test('receipt missing execution identity blocks projection instead of guessing',async()=>{
  const out=await runtime().runWithReceipt('submit',{id:'x'},{
    actor:{id:'u1'},idempotency_key:'submission-3',correlation_id:'corr-3',
    receipt:{
      receipt_id:'receipt.service.bridge.3',
      actor:'user:u1',
      reproducibility:{
        deterministic:true,executor_version:'1.0.0',environment_revision:'git:p1',command_ref:'submit'
      }
    }
  });
  const bridged=bridgeReceiptsToEffectEvidence({
    bindings,receipts:out.child_receipts,target_execution:attempt2
  });
  assert.equal(bridged.status,'HOLD');
  assert.equal(bridged.reason,'SOURCE_RECEIPT_EXECUTION_BINDING_MISSING');
});

test('one source receipt cannot be claimed by two different effects',async()=>{
  const out=await runtime().runWithReceipt('submit',{id:'x'},{
    actor:{id:'u1'},idempotency_key:'submission-4',correlation_id:'corr-4',execution:attempt1,
    receipt:{
      receipt_id:'receipt.service.bridge.4',
      actor:'user:u1',
      reproducibility:{
        deterministic:true,executor_version:'1.0.0',environment_revision:'git:p1',command_ref:'submit'
      }
    }
  });
  const conflicting=[bindings[0],{
    ...bindings[0],
    binding_id:'bridge.entity-create-second',
    effect_id:'another-effect'
  }];
  const bridged=bridgeReceiptsToEffectEvidence({
    bindings:conflicting,receipts:out.child_receipts,target_execution:attempt2
  });
  assert.equal(bridged.status,'HOLD');
  assert.ok(bridged.blocking.some(x=>x.reason==='SOURCE_RECEIPT_MULTI_EFFECT_BINDING'));
});

test('same selector producing multiple receipts in one attempt is ambiguous and held',async()=>{
  const out=await runtime().runWithReceipt('submit',{id:'x'},{
    actor:{id:'u1'},idempotency_key:'submission-5',correlation_id:'corr-5',execution:attempt1,
    receipt:{
      receipt_id:'receipt.service.bridge.5',
      actor:'user:u1',
      reproducibility:{
        deterministic:true,executor_version:'1.0.0',environment_revision:'git:p1',command_ref:'submit'
      }
    }
  });
  const duplicate=structuredClone(out.child_receipts[0]);
  duplicate.receipt_id='receipt.repository.duplicate';
  const bridged=bridgeReceiptsToEffectEvidence({
    bindings,receipts:[out.child_receipts[0],duplicate],target_execution:attempt2
  });
  assert.equal(bridged.status,'HOLD');
  assert.ok(bridged.blocking.some(x=>x.reason==='AMBIGUOUS_EFFECT_SOURCE_RECEIPTS'));
});

test('foreign logical execution receipt is ignored rather than projected',async()=>{
  const otherIdentity=createExecutionIdentity({
    logicalExecutionId:'logical.bridge.other',
    dimensions:{
      operation_kind:'workflow.bridge-test',
      logical_slot:'slot-other',
      subject_scope:{scope_type:'application',scope_key:'app-1'},
      semantic_input_digest:'sha256:'+'2'.repeat(64)
    },
    createdAt:'2026-09-20T11:00:00Z'
  });
  const otherAttempt=bindExecutionAttempt(otherIdentity,{
    attemptId:'attempt-other',attemptSequence:1,executionPath:'NATIVE'
  });
  const out=await runtime().runWithReceipt('submit',{id:'x'},{
    actor:{id:'u1'},idempotency_key:'submission-6',correlation_id:'corr-6',execution:otherAttempt,
    receipt:{
      receipt_id:'receipt.service.bridge.6',
      actor:'user:u1',
      reproducibility:{
        deterministic:true,executor_version:'1.0.0',environment_revision:'git:p1',command_ref:'submit'
      }
    }
  });
  const bridged=bridgeReceiptsToEffectEvidence({
    bindings,receipts:out.child_receipts,target_execution:attempt2
  });
  assert.equal(bridged.status,'READY');
  assert.equal(bridged.evidence_records.length,0);
  assert.equal(bridged.foreign_receipt_count,1);
});
