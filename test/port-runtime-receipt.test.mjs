import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortRuntime } from '../src/engine/port-runtime.mjs';

const engine={
  schema_version:'core-engine-contract/v1',engine_id:'demo.engine',version:'1.0.0',
  source:{locator:'src/engine.mjs',revision:'git:e1'},inputs:['in'],outputs:['out'],
  invariants:['stable'],required_ports:[{port_id:'demo.read',port_version:'v1'}],
  effect_model:'PORT_MEDIATED',error_codes:['UPSTREAM_UNAVAILABLE'],verification_profile:['unit']
};
const adapter={
  schema_version:'core-adapter-contract/v1',adapter_id:'adapter.demo.read',adapter_version:'1.0.0',
  port_id:'demo.read',provider_scope:'demo',project_scope:'demo',
  source:{locator:'src/adapter.mjs',revision:'git:a1'},
  compatibility:{port_versions:['v1'],engine_versions:['1.0.0']},
  mapping:[{canonical_field:'x',provider_field:'x',transformation:'identity',unit_conversion:null}],
  side_effects:false,idempotency:'NOT_APPLICABLE',
  retry_policy:{max_attempts:1,backoff:'NONE',retryable_error_codes:['UPSTREAM_UNAVAILABLE']},
  timeout_ms:1000,auth_boundary:'none',data_classification:['INTERNAL'],
  failure_mapping:[{provider_code:'DOWN',core_code:'UPSTREAM_UNAVAILABLE'}],
  health_check:'fixture',verification_profile:['contract']
};
const profile={
  schema_version:'core-binding-profile/v1',profile_id:'binding.demo',project_id:'demo',environment:'test',
  subject_revision:'git:p1',verification_state:'PASSED_WITHIN_SCOPE',config_refs:[],secret_refs:[],
  engine_bindings:[{engine_id:'demo.engine',engine_version:'1.0.0',ports:[{port_id:'demo.read',adapter_id:'adapter.demo.read'}]}]
};

test('invokeWithReceipt returns the exact adapter result plus receipt bound to the same input',async()=>{
  const runtime=createPortRuntime({
    engine,adapters:[adapter],profile,
    implementations:{'adapter.demo.read':async()=>({status:'SUCCEEDED',data:{value:7},evidence_refs:['fixture:1']})}
  });
  const out=await runtime.invokeWithReceipt('demo.read',{id:'x'},{
    correlation_id:'corr-1',
    receipt:{
      receipt_id:'receipt.demo.1',operation_id:'op-1',operation_kind:'demo.read',
      actor:'tester',executor:'adapter.demo.read',
      reproducibility:{deterministic:true,executor_version:'1.0.0',environment_revision:'git:p1',command_ref:'demo.read'},
      proof_inputs:[{role:'SOURCE',ref:'adapter',digest:'sha256:'+'a'.repeat(64),revision:'git:a1'}]
    }
  });
  assert.equal(out.adapter_result.status,'SUCCEEDED');
  assert.equal(out.receipt.status,'SUCCEEDED');
  assert.equal(out.receipt.correlation_id,'corr-1');
  assert.equal(out.receipt.evidence_refs.includes('fixture:1'),true);
  assert.equal(out.receipt.proof_input_binding.schema_version,'core-proof-input-binding/v1');
});
