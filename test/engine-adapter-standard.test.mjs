import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEngineContract, validateAdapterContract, resolveBinding } from '../src/contracts/engine-adapter-contract.mjs';

const engine={
  schema_version:'core-engine-contract/v1',
  engine_id:'rental.quote',version:'2.0.0',
  source:{locator:'src/quote-engine.mjs',revision:'git:abc123'},
  inputs:['schema:quote-input/v1'],outputs:['schema:quote-output/v1'],
  invariants:['same canonical input preserves pricing meaning'],
  required_ports:[{port_id:'vehicle.read',port_version:'v1'},{port_id:'quote.write',port_version:'v1'}],
  effect_model:'PORT_MEDIATED',error_codes:['VALIDATION_ERROR'],verification_profile:['unit','contract','integration']
};
const readAdapter={
  schema_version:'core-adapter-contract/v1',adapter_id:'adapter.vehicle.mock',adapter_version:'1.0.0',
  port_id:'vehicle.read',provider_scope:'mock',project_scope:null,
  source:{locator:'test/mock-vehicle.mjs',revision:'git:def456'},
  compatibility:{port_versions:['v1'],engine_versions:['2.0.0']},
  mapping:[{canonical_field:'vehicle.id',provider_field:'id',transformation:'identity',unit_conversion:null}],
  side_effects:false,idempotency:'NOT_APPLICABLE',
  retry_policy:{max_attempts:1,backoff:'NONE',retryable_error_codes:[]},timeout_ms:1000,
  auth_boundary:'none',data_classification:['INTERNAL'],
  failure_mapping:[{provider_code:'not_found',core_code:'NOT_FOUND'}],
  health_check:'fixture-load',verification_profile:['contract']
};
const writeAdapter={
  ...structuredClone(readAdapter),adapter_id:'adapter.quote.mock',port_id:'quote.write',
  mapping:[{canonical_field:'quote.amount',provider_field:'amount',transformation:'identity',unit_conversion:null}],
  side_effects:true,idempotency:'REQUIRED',
  failure_mapping:[{provider_code:'write_failed',core_code:'PERSISTENCE_ERROR'}]
};
const profile={
  schema_version:'core-binding-profile/v1',profile_id:'profile.freepass.test',project_id:'freepass',environment:'test',
  subject_revision:'git:abc123',
  engine_bindings:[{engine_id:'rental.quote',engine_version:'2.0.0',ports:[
    {port_id:'vehicle.read',adapter_id:'adapter.vehicle.mock'},
    {port_id:'quote.write',adapter_id:'adapter.quote.mock'}
  ]}],
  config_refs:[],secret_refs:[],verification_state:'NOT_RUN'
};

test('engine contract requires revision, invariants and explicit effect model',()=>{
  assert.equal(validateEngineContract(engine).status,'VALID');
  assert.throws(()=>validateEngineContract({...engine,required_ports:[]}),/ENGINE_PORT_REQUIRED/);
});

test('side-effect adapter cannot declare idempotency unsupported',()=>{
  assert.equal(validateAdapterContract(writeAdapter).status,'VALID');
  assert.throws(()=>validateAdapterContract({...writeAdapter,idempotency:'UNSUPPORTED'}),/SIDE_EFFECT_ADAPTER_IDEMPOTENCY_UNSUPPORTED/);
});

test('binding resolves exact port versions and never grants execution authority',()=>{
  const result=resolveBinding({engine,adapters:[readAdapter,writeAdapter],profile});
  assert.equal(result.status,'RESOLVED');
  assert.equal(result.authorization,'NOT_GRANTED');
  assert.deepEqual(result.errors,[]);
  assert.equal(result.selected_adapters.length,2);
});

test('missing or incompatible binding goes HOLD with machine reason',()=>{
  const broken=structuredClone(profile);
  broken.engine_bindings[0].ports=broken.engine_bindings[0].ports.filter(x=>x.port_id!=='quote.write');
  assert.ok(resolveBinding({engine,adapters:[readAdapter,writeAdapter],profile:broken}).errors.includes('PORT_UNRESOLVED:quote.write'));

  const incompatible={...writeAdapter,compatibility:{port_versions:['v2'],engine_versions:['2.0.0']}};
  assert.ok(resolveBinding({engine,adapters:[readAdapter,incompatible],profile}).errors.includes('ADAPTER_PORT_VERSION_MISMATCH:adapter.quote.mock'));
});
