import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationServiceRuntime } from '../src/engine/application-service-runtime.mjs';
import { createConnectorRuntime } from '../src/engine/connector-runtime.mjs';

const service={
  schema_version:'core-application-service-contract/v1',
  service_id:'demo.repository-service',version:'1.0.0',
  source:{locator:'src/service.mjs',revision:'git:s1'},
  use_cases:[{
    name:'submit',input_contract:'SubmitInput',output_contract:'SubmitResult',
    side_effects:true,idempotency:'REQUIRED',actor_requirement:'REQUIRED',
    transaction_boundary:'REPOSITORY_ATOMIC',
    error_codes:['NOT_FOUND','PERSISTENCE_ERROR']
  }],
  required_ports:[{port_id:'entity.repository',port_version:'v1'}],
  verification_profile:['unit']
};

const repository={
  schema_version:'core-repository-contract/v1',
  repository_id:'demo.entity-repository',repository_version:'1.0.0',
  port_id:'entity.repository',port_version:'v1',project_scope:'demo',
  source:{locator:'src/repository.mjs',revision:'git:r1'},entity_scope:'entity',
  operations:[
    {operation_id:'entity.get',kind:'READ',side_effects:false,idempotency:'NOT_APPLICABLE',expected_revision:'NOT_APPLICABLE'},
    {operation_id:'entity.create',kind:'CREATE',side_effects:true,idempotency:'REQUIRED',expected_revision:'NOT_APPLICABLE'}
  ],
  atomicity:{scope:'SINGLE_AGGREGATE',partial_write_possible:false},
  concurrency:{mode:'PROCESS_SERIALIZED',lost_update_protection:true},
  revision_policy:'NONE',
  connector_binding:{
    connector_id:'demo.store',connector_version:'1.0.0',
    operation_map:[
      {repository_operation_id:'entity.get',connector_operation_ids:['entity.read']},
      {repository_operation_id:'entity.create',connector_operation_ids:['entity.read','entity.write']}
    ]
  },
  data_classification:['INTERNAL'],
  error_codes:['NOT_FOUND','PERSISTENCE_ERROR'],
  verification_profile:['contract']
};

const profile={
  schema_version:'core-binding-profile/v1',profile_id:'binding.demo.repository-service',
  project_id:'demo',environment:'test',subject_revision:'git:p1',engine_bindings:[],
  service_bindings:[{
    service_id:'demo.repository-service',service_version:'1.0.0',
    ports:[{port_id:'entity.repository',repository_id:'demo.entity-repository'}]
  }],
  config_refs:[],secret_refs:[],verification_state:'PASSED_WITHIN_SCOPE'
};

const connector={
  schema_version:'core-connector-contract/v1',
  connector_id:'demo.store',connector_version:'1.0.0',transport:'DATABASE',provider_scope:'demo',
  source:{locator:'src/store.mjs',revision:'git:c1'},
  operations:[
    {operation_id:'entity.read',verb:'GET',target_ref:'entities',side_effects:false},
    {operation_id:'entity.write',verb:'PUT',target_ref:'entities',side_effects:true}
  ],
  auth:{mode:'NONE',credential_refs:[]},timeout_ms:1000,abort_supported:false,
  health_check:'ping',data_classification:['INTERNAL'],verification_profile:['contract']
};

function runtime(){
  const transport=createConnectorRuntime({
    connector,
    implementation:async({operation,request})=>({status:'SUCCEEDED',data:{operation:operation.operation_id,request}})
  });
  return createApplicationServiceRuntime({
    service,
    repositories:[repository],
    profile,
    repositoryImplementations:{
      'demo.entity-repository':async({operation,input,connector})=>{
        if(operation.operation_id==='entity.get'){
          const transportResult=await connector.invoke('entity.read',input);
          return {status:'SUCCEEDED',data:{id:input.id,transport:transportResult.data.operation}};
        }
        const transportResult=await connector.invoke('entity.write',input);
        return {status:'SUCCEEDED',data:{saved:input.id,transport:transportResult.data.operation}};
      }
    },
    connectors:{'demo.store':transport},
    implementation:async({input,ports})=>{
      const existing=await ports.invoke('entity.repository',{id:input.id},{
        repository_operation_id:'entity.get'
      });
      if(existing.status!=='SUCCEEDED') return {status:'FAILED',error_code:'NOT_FOUND'};
      const saved=await ports.invoke('entity.repository',{id:input.id},{
        repository_operation_id:'entity.create'
      });
      return saved.status==='SUCCEEDED'
        ? {status:'SUCCEEDED',data:saved.data}
        : {status:'FAILED',error_code:'PERSISTENCE_ERROR'};
    }
  });
}

test('Application Service can bind a Port directly to Repository runtime',async()=>{
  const rt=runtime();
  assert.equal(rt.binding.status,'RESOLVED');
  assert.equal(rt.binding.selected_adapters.length,0);
  assert.equal(rt.binding.selected_repositories.length,1);

  const result=await rt.run('submit',{id:'x'},{
    actor:{id:'u1'},idempotency_key:'submission-1',correlation_id:'corr-1'
  });
  assert.equal(result.status,'SUCCEEDED');
  assert.deepEqual(result.result,{saved:'x',transport:'entity.write'});
  assert.deepEqual(result.port_results.map(x=>x.binding_kind),['REPOSITORY','REPOSITORY']);
});

test('Repository-bound Service inherits Service idempotency key for required write operation',async()=>{
  const result=await runtime().run('submit',{id:'x'},{
    actor:{id:'u1'},idempotency_key:'submission-2',correlation_id:'corr-2'
  });
  assert.equal(result.status,'SUCCEEDED');
});

test('Repository-bound Service cannot invoke an undeclared repository operation',async()=>{
  const rt=createApplicationServiceRuntime({
    service,repositories:[repository],profile,
    repositoryImplementations:{
      'demo.entity-repository':async()=>({status:'SUCCEEDED'})
    },
    implementation:async({ports})=>{
      await ports.invoke('entity.repository',{},{
        repository_operation_id:'entity.delete'
      });
      return {status:'SUCCEEDED'};
    }
  });
  const result=await rt.run('submit',{id:'x'},{
    actor:{id:'u1'},idempotency_key:'submission-3',correlation_id:'corr-3'
  });
  assert.equal(result.status,'FAILED');
  assert.equal(result.reason,'SERVICE_EXECUTION_FAILED');
});
