import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationServiceRuntime } from '../src/engine/application-service-runtime.mjs';

const service={
  schema_version:'core-application-service-contract/v1',
  service_id:'demo.application.service',version:'1.0.0',
  source:{locator:'src/service.mjs',revision:'git:s1'},
  use_cases:[{
    name:'submit',input_contract:'SubmitInput',output_contract:'SubmitResult',
    side_effects:true,idempotency:'REQUIRED',actor_requirement:'REQUIRED',
    transaction_boundary:'REPOSITORY_ATOMIC',
    error_codes:['NOT_FOUND','PERSISTENCE_ERROR']
  }],
  required_ports:[
    {port_id:'entity.read',port_version:'v1'},
    {port_id:'entity.write',port_version:'v1'}
  ],
  verification_profile:['unit']
};
const base={
  schema_version:'core-adapter-contract/v1',adapter_version:'1.0.0',provider_scope:'demo',project_scope:'demo',
  source:{locator:'src/adapter.mjs',revision:'git:a1'},
  compatibility:{port_versions:['v1'],engine_versions:[]},
  mapping:[{canonical_field:'x',provider_field:'x',transformation:'identity',unit_conversion:null}],
  retry_policy:{max_attempts:1,backoff:'NONE',retryable_error_codes:[]},
  timeout_ms:1000,auth_boundary:'test',data_classification:['INTERNAL'],
  failure_mapping:[{provider_code:'ENOENT',core_code:'NOT_FOUND'}],
  health_check:'fixture',verification_profile:['contract']
};
const read={...base,adapter_id:'adapter.entity.read',port_id:'entity.read',side_effects:false,idempotency:'NOT_APPLICABLE'};
const write={...base,adapter_id:'adapter.entity.write',port_id:'entity.write',side_effects:true,idempotency:'REQUIRED'};
const profile={
  schema_version:'core-binding-profile/v1',profile_id:'binding.demo.service',project_id:'demo',environment:'test',
  subject_revision:'git:p1',engine_bindings:[],
  service_bindings:[{service_id:'demo.application.service',service_version:'1.0.0',ports:[
    {port_id:'entity.read',adapter_id:'adapter.entity.read'},
    {port_id:'entity.write',adapter_id:'adapter.entity.write'}
  ]}],
  config_refs:[],secret_refs:[],verification_state:'PASSED_WITHIN_SCOPE'
};

function runtime(){
  return createApplicationServiceRuntime({
    service,adapters:[read,write],profile,
    adapterImplementations:{
      'adapter.entity.read':async({input})=>({status:'SUCCEEDED',data:{id:input.id}}),
      'adapter.entity.write':async({input})=>({status:'SUCCEEDED',data:{saved:input.id}})
    },
    implementation:async({input,ports})=>{
      const existing=await ports.invoke('entity.read',{id:input.id});
      if(existing.status!=='SUCCEEDED') return {status:'FAILED',error_code:'NOT_FOUND'};
      const saved=await ports.invoke('entity.write',{id:input.id});
      return saved.status==='SUCCEEDED'
        ? {status:'SUCCEEDED',data:saved.data}
        : {status:'FAILED',error_code:'PERSISTENCE_ERROR'};
    }
  });
}

test('verified complete Service binding executes through shared Adapter runtime',async()=>{
  const result=await runtime().run('submit',{id:'x'},{
    actor:{id:'u1'},idempotency_key:'submission-1',correlation_id:'corr-1'
  });
  assert.equal(result.status,'SUCCEEDED');
  assert.deepEqual(result.result,{saved:'x'});
  assert.deepEqual(result.port_results.map(x=>x.port_id),['entity.read','entity.write']);
});

test('required actor blocks Service before implementation starts',async()=>{
  const result=await runtime().run('submit',{id:'x'},{idempotency_key:'submission-1',correlation_id:'corr-2'});
  assert.equal(result.status,'HOLD');
  assert.equal(result.reason,'SERVICE_ACTOR_REQUIRED');
  assert.equal(result.port_results.length,0);
});

test('required idempotency blocks Service before side-effect port opens',async()=>{
  const result=await runtime().run('submit',{id:'x'},{actor:{id:'u1'},correlation_id:'corr-3'});
  assert.equal(result.status,'HOLD');
  assert.equal(result.reason,'SERVICE_IDEMPOTENCY_KEY_REQUIRED');
  assert.equal(result.port_results.length,0);
});
