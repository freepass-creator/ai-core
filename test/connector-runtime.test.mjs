import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnectorRuntime } from '../src/engine/connector-runtime.mjs';

const connector={
  schema_version:'core-connector-contract/v1',
  connector_id:'provider.http',
  connector_version:'1.0.0',
  transport:'HTTP',
  provider_scope:'test-provider',
  source:{locator:'src/provider-http.mjs',revision:'git:abc'},
  operations:[{operation_id:'quote.calculate',verb:'POST',target_ref:'/quote',side_effects:false}],
  auth:{mode:'CREDENTIAL_REF',credential_refs:['secret:provider-api']},
  timeout_ms:20,
  abort_supported:true,
  health_check:'GET /health',
  data_classification:['INTERNAL'],
  verification_profile:['contract']
};

test('connector success stays transport-only',async()=>{
  const runtime=createConnectorRuntime({
    connector,
    implementation:async()=>({status:'SUCCEEDED',data:{ok:true},evidence_refs:['http:200']})
  });
  const result=await runtime.invoke('quote.calculate',{x:1},{correlation_id:'corr-1'});
  assert.equal(result.schema_version,'core-connector-result/v1');
  assert.equal(result.status,'SUCCEEDED');
  assert.equal(result.failure_kind,null);
  assert.deepEqual(result.evidence_refs,['http:200']);
});

test('connector failure does not invent adapter retry semantics',async()=>{
  const runtime=createConnectorRuntime({
    connector,
    implementation:async()=>({status:'FAILED',failure_kind:'UNAVAILABLE',data:null})
  });
  const result=await runtime.invoke('quote.calculate',{}, {correlation_id:'corr-2'});
  assert.equal(result.status,'FAILED');
  assert.equal(result.failure_kind,'UNAVAILABLE');
  assert.equal(Object.prototype.hasOwnProperty.call(result,'retryable'),false);
});

test('connector timeout is normalized and abort signal is provided',async()=>{
  let sawSignal=false;
  const runtime=createConnectorRuntime({
    connector:{...connector,timeout_ms:5},
    implementation:async({signal})=>{
      sawSignal=signal instanceof AbortSignal;
      await new Promise(resolve=>setTimeout(resolve,30));
      return {status:'SUCCEEDED'};
    }
  });
  const result=await runtime.invoke('quote.calculate',{}, {correlation_id:'corr-3'});
  assert.equal(sawSignal,true);
  assert.equal(result.status,'FAILED');
  assert.equal(result.failure_kind,'TIMEOUT');
});

test('unknown operation fails before transport invocation',async()=>{
  let calls=0;
  const runtime=createConnectorRuntime({connector,implementation:async()=>{calls++;return{status:'SUCCEEDED'};}});
  await assert.rejects(()=>runtime.invoke('unknown.op',{}, {correlation_id:'corr-4'}),/CONNECTOR_OPERATION_UNKNOWN/);
  assert.equal(calls,0);
});
