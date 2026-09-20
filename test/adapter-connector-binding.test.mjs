import test from 'node:test';
import assert from 'node:assert/strict';
import { createPortRuntime } from '../src/engine/port-runtime.mjs';
import { createConnectorRuntime } from '../src/engine/connector-runtime.mjs';

const engine={
  schema_version:'core-engine-contract/v1',
  engine_id:'quote.engine',version:'1.0.0',
  source:{locator:'src/engine.mjs',revision:'git:e1'},
  inputs:['in'],outputs:['out'],invariants:['provider-neutral'],
  required_ports:[{port_id:'quote.provider.calculate',port_version:'v1'}],
  effect_model:'PORT_MEDIATED',error_codes:['UPSTREAM_UNAVAILABLE'],verification_profile:['unit']
};

const adapter={
  schema_version:'core-adapter-contract/v1',
  adapter_id:'adapter.quote.http',adapter_version:'1.0.0',
  port_id:'quote.provider.calculate',provider_scope:'provider',project_scope:'demo',
  source:{locator:'src/adapter.mjs',revision:'git:a1'},
  compatibility:{port_versions:['v1'],engine_versions:['1.0.0']},
  mapping:[{canonical_field:'quote.request',provider_field:'body',transformation:'serialize',unit_conversion:null}],
  side_effects:false,idempotency:'NOT_APPLICABLE',
  retry_policy:{max_attempts:1,backoff:'NONE',retryable_error_codes:['UPSTREAM_UNAVAILABLE']},
  timeout_ms:1000,auth_boundary:'credential-ref',data_classification:['INTERNAL'],
  failure_mapping:[{provider_code:'PROVIDER_DOWN',core_code:'UPSTREAM_UNAVAILABLE'}],
  health_check:'connector-health',verification_profile:['contract'],
  connector_binding:{connector_id:'connector.quote.http',connector_version:'1.0.0',operation_ids:['quote.standard','quote.external']}
};

const profile={
  schema_version:'core-binding-profile/v1',profile_id:'binding.demo.quote',project_id:'demo',environment:'test',
  subject_revision:'git:p1',verification_state:'PASSED_WITHIN_SCOPE',config_refs:[],secret_refs:[],
  engine_bindings:[{engine_id:'quote.engine',engine_version:'1.0.0',ports:[
    {port_id:'quote.provider.calculate',adapter_id:'adapter.quote.http'}
  ]}]
};

const connector={
  schema_version:'core-connector-contract/v1',
  connector_id:'connector.quote.http',connector_version:'1.0.0',transport:'HTTP',provider_scope:'provider',
  source:{locator:'src/http.mjs',revision:'git:c1'},
  operations:[
    {operation_id:'quote.standard',verb:'POST',target_ref:'/standard',side_effects:false},
    {operation_id:'quote.external',verb:'POST',target_ref:'/external',side_effects:false}
  ],
  auth:{mode:'CREDENTIAL_REF',credential_refs:['secret:provider']},
  timeout_ms:1000,abort_supported:true,health_check:'GET /health',data_classification:['INTERNAL'],verification_profile:['contract']
};

function runtime(){
  const connectorRuntime=createConnectorRuntime({
    connector,
    implementation:async({operation,request})=>({status:'SUCCEEDED',data:{operation:operation.operation_id,request}})
  });
  return createPortRuntime({
    engine,adapters:[adapter],profile,connectors:{'connector.quote.http':connectorRuntime},
    implementations:{
      'adapter.quote.http':async({input,connector})=>{
        const transport=await connector.invoke('quote.external',{payload:input});
        return {status:transport.status,data:transport.data};
      }
    }
  });
}

test('adapter can call only declared Connector operations',async()=>{
  const result=await runtime().invoke('quote.provider.calculate',{vehicle:'v1'},{correlation_id:'corr-1'});
  assert.equal(result.status,'SUCCEEDED');
  assert.equal(result.data.operation,'quote.external');
});

test('adapter cannot escape its declared Connector operation set',async()=>{
  const connectorRuntime=createConnectorRuntime({
    connector:{...connector,operations:[...connector.operations,{operation_id:'admin.delete',verb:'DELETE',target_ref:'/admin',side_effects:true}]},
    implementation:async()=>({status:'SUCCEEDED'})
  });
  const rt=createPortRuntime({
    engine,adapters:[adapter],profile,connectors:{'connector.quote.http':connectorRuntime},
    implementations:{
      'adapter.quote.http':async({connector})=>{
        await connector.invoke('admin.delete',{});
        return {status:'SUCCEEDED'};
      }
    }
  });
  const result=await rt.invoke('quote.provider.calculate',{}, {correlation_id:'corr-2'});
  assert.equal(result.status,'FAILED');
  assert.equal(result.issues[0].code,'UPSTREAM_INVALID_RESPONSE');
});

test('binding fails closed when Connector runtime version drifts',async()=>{
  const bad=createConnectorRuntime({connector:{...connector,connector_version:'2.0.0'},implementation:async()=>({status:'SUCCEEDED'})});
  const rt=createPortRuntime({
    engine,adapters:[adapter],profile,connectors:{'connector.quote.http':bad},
    implementations:{'adapter.quote.http':async()=>({status:'SUCCEEDED'})}
  });
  const result=await rt.invoke('quote.provider.calculate',{}, {correlation_id:'corr-3'});
  assert.equal(result.status,'FAILED');
  assert.equal(result.issues[0].code,'UPSTREAM_INVALID_RESPONSE');
});
