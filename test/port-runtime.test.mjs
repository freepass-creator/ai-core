import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortRuntime } from '../src/engine/port-runtime.mjs';
import { resolveBinding } from '../src/contracts/engine-adapter-contract.mjs';

const engine={
  schema_version:'core-engine-contract/v1',
  engine_id:'rental.quote',version:'2.0.0',
  source:{locator:'src/quote-engine.mjs',revision:'git:engine'},
  inputs:['schema:in/v1'],outputs:['schema:out/v1'],
  invariants:['pricing meaning is stable'],
  required_ports:[{port_id:'vehicle.read',port_version:'v1'},{port_id:'quote.write',port_version:'v1'}],
  effect_model:'PORT_MEDIATED',error_codes:['UPSTREAM_UNAVAILABLE'],verification_profile:['unit']
};
const base={
  schema_version:'core-adapter-contract/v1',adapter_version:'1.0.0',provider_scope:'mock',project_scope:'freepass',
  source:{locator:'test/mock.mjs',revision:'git:adapter'},compatibility:{port_versions:['v1'],engine_versions:['2.0.0']},
  mapping:[{canonical_field:'x',provider_field:'x',transformation:'identity',unit_conversion:null}],
  retry_policy:{max_attempts:2,backoff:'NONE',retryable_error_codes:['UPSTREAM_UNAVAILABLE']},
  timeout_ms:20,auth_boundary:'test',data_classification:['INTERNAL'],
  failure_mapping:[{provider_code:'TEMP_DOWN',core_code:'UPSTREAM_UNAVAILABLE'}],
  health_check:'fixture',verification_profile:['contract']
};
const read={...base,adapter_id:'adapter.vehicle.mock',port_id:'vehicle.read',side_effects:false,idempotency:'NOT_APPLICABLE'};
const write={...base,adapter_id:'adapter.quote.mock',port_id:'quote.write',side_effects:true,idempotency:'REQUIRED'};
const profile={
  schema_version:'core-binding-profile/v1',profile_id:'profile.freepass.test',project_id:'freepass',environment:'test',
  subject_revision:'git:project',verification_state:'PASSED_WITHIN_SCOPE',config_refs:[],secret_refs:[],
  engine_bindings:[{engine_id:'rental.quote',engine_version:'2.0.0',ports:[
    {port_id:'vehicle.read',adapter_id:'adapter.vehicle.mock'},
    {port_id:'quote.write',adapter_id:'adapter.quote.mock'}
  ]}]
};

test('pure engine resolves without synthetic adapter binding',()=>{
  const pure={...engine,engine_id:'pricing.pure',required_ports:[],effect_model:'PURE'};
  const result=resolveBinding({engine:pure,adapters:[],profile:{...profile,engine_bindings:[]}});
  assert.equal(result.status,'RESOLVED');
  assert.deepEqual(result.selected_adapters,[]);
});

test('runtime requires a verified binding for invocation',()=>{
  const runtime=createPortRuntime({engine,adapters:[read,write],profile:{...profile,verification_state:'STALE'},implementations:{}});
  assert.equal(runtime.binding.status,'HOLD');
  assert.ok(runtime.binding.errors.includes('BINDING_PROFILE_VERIFICATION_STALE'));
});

test('side effect port requires an idempotency key',async()=>{
  const runtime=createPortRuntime({
    engine,adapters:[read,write],profile,
    implementations:{'adapter.vehicle.mock':async()=>({status:'SUCCEEDED',data:{id:1}}),'adapter.quote.mock':async()=>({status:'SUCCEEDED'})}
  });
  await assert.rejects(()=>runtime.invoke('quote.write',{amount:1},{correlation_id:'corr-1'}),/IDEMPOTENCY_KEY_REQUIRED/);
});

test('provider failure maps to canonical core code and retryable flag',async()=>{
  const runtime=createPortRuntime({
    engine,adapters:[read,write],profile,
    implementations:{'adapter.vehicle.mock':async()=>({status:'FAILED',provider_code:'TEMP_DOWN'})}
  });
  const result=await runtime.invoke('vehicle.read',{}, {correlation_id:'corr-2'});
  assert.equal(result.schema_version,'core-adapter-result/v1');
  assert.equal(result.status,'FAILED');
  assert.equal(result.retryable,true);
  assert.equal(result.issues[0].code,'UPSTREAM_UNAVAILABLE');
});

test('successful result carries binding revision and adapter identity',async()=>{
  const runtime=createPortRuntime({
    engine,adapters:[read,write],profile,
    implementations:{'adapter.vehicle.mock':async()=>({status:'SUCCEEDED',data:{id:'v1'},evidence_refs:['fixture:vehicle']})}
  });
  const result=await runtime.invoke('vehicle.read',{}, {correlation_id:'corr-3'});
  assert.equal(result.status,'SUCCEEDED');
  assert.equal(result.adapter_id,'adapter.vehicle.mock');
  assert.equal(result.source_revision,'git:adapter');
  assert.deepEqual(result.evidence_refs,['fixture:vehicle']);
});

test('project-scoped adapter cannot bind into another project profile',()=>{
  const wrong={...profile,project_id:'other'};
  const result=resolveBinding({engine,adapters:[read,write],profile:wrong,requireVerified:true});
  assert.equal(result.status,'HOLD');
  assert.ok(result.errors.includes('ADAPTER_PROJECT_SCOPE_MISMATCH:adapter.vehicle.mock'));
});
