import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { createApplicationServiceRuntime } from '../src/engine/application-service-runtime.mjs';
import { createConnectorRuntime } from '../src/engine/connector-runtime.mjs';

async function json(path){return JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));}

const [types,execution,proof,receiptSchema]=await Promise.all([
  json('contracts/core-types.schema.json'),
  json('contracts/core-execution-identity.schema.json'),
  json('contracts/core-proof-input-binding.schema.json'),
  json('contracts/core-receipt.schema.json')
]);
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv);
for(const schema of [types,execution,proof,receiptSchema]) ajv.addSchema(schema);
const validateReceipt=ajv.getSchema('https://schemas.freepass.ai/core/receipt/v1');

const service={
  schema_version:'core-application-service-contract/v1',
  service_id:'demo.receipt.service',version:'1.0.0',
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
  repository_id:'demo.receipt.repository',repository_version:'1.0.0',
  port_id:'entity.repository',port_version:'v1',project_scope:'demo',
  source:{locator:'src/repository.mjs',revision:'git:r1'},entity_scope:'entity',
  operations:[
    {operation_id:'entity.create',kind:'CREATE',side_effects:true,idempotency:'REQUIRED',expected_revision:'NOT_APPLICABLE'}
  ],
  atomicity:{scope:'SINGLE_AGGREGATE',partial_write_possible:false},
  concurrency:{mode:'PROCESS_SERIALIZED',lost_update_protection:true},
  revision_policy:'NONE',
  connector_binding:{
    connector_id:'demo.receipt.store',connector_version:'1.0.0',
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
  profile_id:'binding.demo.receipt',
  project_id:'demo',environment:'test',subject_revision:'git:p1',
  engine_bindings:[],
  service_bindings:[{
    service_id:'demo.receipt.service',service_version:'1.0.0',
    ports:[{port_id:'entity.repository',repository_id:'demo.receipt.repository'}]
  }],
  config_refs:[],secret_refs:[],verification_state:'PASSED_WITHIN_SCOPE'
};

const connector={
  schema_version:'core-connector-contract/v1',
  connector_id:'demo.receipt.store',connector_version:'1.0.0',
  transport:'DATABASE',provider_scope:'demo',
  source:{locator:'src/store.mjs',revision:'git:c1'},
  operations:[{operation_id:'entity.write',verb:'PUT',target_ref:'entities',side_effects:true}],
  auth:{mode:'NONE',credential_refs:[]},timeout_ms:1000,abort_supported:false,
  health_check:'ping',data_classification:['INTERNAL'],verification_profile:['contract']
};

function runtime({fail=false}={}){
  const transport=createConnectorRuntime({
    connector,
    implementation:async()=>({status:'SUCCEEDED',data:{ok:true},evidence_refs:['db:write']})
  });
  return createApplicationServiceRuntime({
    service,repositories:[repository],profile,
    repositoryImplementations:{
      'demo.receipt.repository':async({input,connector})=>{
        await connector.invoke('entity.write',input);
        return fail
          ? {status:'FAILED',error_code:'PERSISTENCE_ERROR',evidence_refs:['repo:failed']}
          : {status:'SUCCEEDED',data:{saved:input.id},revision:'r1',evidence_refs:['repo:saved']};
      }
    },
    connectors:{'demo.receipt.store':transport},
    implementation:async({input,ports})=>{
      const saved=await ports.invoke('entity.repository',{id:input.id},{
        repository_operation_id:'entity.create',
        proof_inputs:[{role:'SOURCE',ref:'repository',digest:'sha256:'+'a'.repeat(64),revision:'git:r1'}]
      });
      return saved.status==='SUCCEEDED'
        ? {status:'SUCCEEDED',data:saved.data}
        : {status:'FAILED',error_code:'PERSISTENCE_ERROR'};
    }
  });
}

test('Service runWithReceipt produces schema-valid parent and Repository child receipts',async()=>{
  const out=await runtime().runWithReceipt('submit',{id:'x'},{
    actor:{id:'u1'},
    idempotency_key:'submission-1',
    correlation_id:'corr-1',
    receipt:{
      receipt_id:'receipt.service.1',
      actor:'user:u1',
      reproducibility:{
        deterministic:true,
        executor_version:'1.0.0',
        environment_revision:'git:p1',
        command_ref:'submit'
      },
      proof_inputs:[
        {role:'SOURCE',ref:'service',digest:'sha256:'+'b'.repeat(64),revision:'git:s1'}
      ]
    }
  });

  assert.equal(out.service_result.status,'SUCCEEDED');
  assert.equal(out.child_receipts.length,1);
  assert.equal(validateReceipt(out.child_receipts[0]),true,JSON.stringify(validateReceipt.errors));
  assert.equal(validateReceipt(out.receipt),true,JSON.stringify(validateReceipt.errors));
  assert.equal(out.receipt.child_receipts.length,1);
  assert.equal(out.receipt.child_receipts[0].relation,'REPOSITORY');
  assert.equal(out.receipt.child_receipts[0].receipt_ref,out.child_receipts[0].receipt_id);
  assert.equal(out.receipt.metrics.child_receipt_count,1);
  assert.equal(out.child_receipts[0].proof_input_binding.schema_version,'core-proof-input-binding/v1');
  assert.equal(out.child_receipts[0].source_revision,'git:r1');
  assert.equal(out.child_receipts[0].metrics.repository_revision,'r1');
});

test('failed child Repository receipt remains linked when parent Service fails',async()=>{
  const out=await runtime({fail:true}).runWithReceipt('submit',{id:'x'},{
    actor:{id:'u1'},
    idempotency_key:'submission-2',
    correlation_id:'corr-2',
    receipt:{
      receipt_id:'receipt.service.2',
      actor:'user:u1',
      reproducibility:{
        deterministic:true,
        executor_version:'1.0.0',
        environment_revision:'git:p1',
        command_ref:'submit'
      }
    }
  });

  assert.equal(out.service_result.status,'FAILED');
  assert.equal(out.receipt.status,'FAILED');
  assert.equal(out.receipt.reason_code,'PERSISTENCE_ERROR');
  assert.equal(out.child_receipts.length,1);
  assert.equal(out.child_receipts[0].status,'FAILED');
  assert.equal(out.receipt.child_receipts[0].receipt_ref,out.child_receipts[0].receipt_id);
  assert.equal(validateReceipt(out.receipt),true,JSON.stringify(validateReceipt.errors));
});

test('pre-execution HOLD creates parent receipt with zero children',async()=>{
  const out=await runtime().runWithReceipt('submit',{id:'x'},{
    actor:null,
    idempotency_key:'submission-3',
    correlation_id:'corr-3',
    receipt:{
      receipt_id:'receipt.service.3',
      actor:'anonymous',
      reproducibility:{
        deterministic:true,
        executor_version:'1.0.0',
        environment_revision:'git:p1',
        command_ref:'submit'
      }
    }
  });
  assert.equal(out.service_result.status,'HOLD');
  assert.equal(out.child_receipts.length,0);
  assert.equal(out.receipt.child_receipts.length,0);
  assert.equal(validateReceipt(out.receipt),true,JSON.stringify(validateReceipt.errors));
});
