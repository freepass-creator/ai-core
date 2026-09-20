import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnectorRuntime } from '../src/engine/connector-runtime.mjs';
import { createRepositoryRuntime } from '../src/engine/repository-runtime.mjs';
import { validateRepositoryContract } from '../src/contracts/repository-contract.mjs';

const repository={
  schema_version:'core-repository-contract/v1',
  repository_id:'demo.entity-repository',
  repository_version:'1.0.0',
  port_id:'entity.repository',
  port_version:'v1',
  project_scope:'demo',
  source:{locator:'src/repository.mjs',revision:'git:r1'},
  entity_scope:'entity',
  operations:[
    {operation_id:'entity.get',kind:'READ',side_effects:false,idempotency:'NOT_APPLICABLE',expected_revision:'NOT_APPLICABLE'},
    {operation_id:'entity.create',kind:'CREATE',side_effects:true,idempotency:'REQUIRED',expected_revision:'NOT_APPLICABLE'},
    {operation_id:'entity.update',kind:'MUTATE',side_effects:true,idempotency:'CALLER_ENFORCED',expected_revision:'REQUIRED'}
  ],
  atomicity:{scope:'SINGLE_AGGREGATE',partial_write_possible:false},
  concurrency:{mode:'OPTIMISTIC_REVISION',lost_update_protection:true},
  revision_policy:'EXPECTED_REVISION',
  connector_binding:{
    connector_id:'demo.store',
    connector_version:'1.0.0',
    operation_map:[
      {repository_operation_id:'entity.get',connector_operation_ids:['entity.read']},
      {repository_operation_id:'entity.create',connector_operation_ids:['entity.read','entity.write']},
      {repository_operation_id:'entity.update',connector_operation_ids:['entity.read','entity.write']}
    ]
  },
  data_classification:['INTERNAL'],
  error_codes:['NOT_FOUND','VERSION_MISMATCH','CONFLICT','PERSISTENCE_ERROR'],
  verification_profile:['contract']
};

const connector={
  schema_version:'core-connector-contract/v1',
  connector_id:'demo.store',connector_version:'1.0.0',transport:'DATABASE',provider_scope:'demo',
  source:{locator:'src/store.mjs',revision:'git:c1'},
  operations:[
    {operation_id:'entity.read',verb:'GET',target_ref:'entities',side_effects:false},
    {operation_id:'entity.write',verb:'PUT',target_ref:'entities',side_effects:true},
    {operation_id:'admin.drop',verb:'DROP',target_ref:'entities',side_effects:true}
  ],
  auth:{mode:'NONE',credential_refs:[]},timeout_ms:1000,abort_supported:false,
  health_check:'ping',data_classification:['INTERNAL'],verification_profile:['contract']
};

function connectorRuntime(){
  return createConnectorRuntime({
    connector,
    implementation:async({operation,request})=>({status:'SUCCEEDED',data:{operation:operation.operation_id,request}})
  });
}

test('Repository contract requires explicit concurrency and write integrity semantics',()=>{
  assert.equal(validateRepositoryContract(repository).status,'VALID');
  assert.throws(
    ()=>validateRepositoryContract({...repository,concurrency:{mode:'NONE',lost_update_protection:false}}),
    /REPOSITORY_WRITE_CONCURRENCY_REQUIRED/
  );
});

test('Repository required idempotency blocks before implementation',async()=>{
  let calls=0;
  const runtime=createRepositoryRuntime({
    repository,project_id:'demo',connectors:{'demo.store':connectorRuntime()},
    implementation:async()=>{calls++;return{status:'SUCCEEDED'};}
  });
  await assert.rejects(
    ()=>runtime.invoke('entity.create',{id:'1'},{correlation_id:'corr-1'}),
    /REPOSITORY_IDEMPOTENCY_KEY_REQUIRED/
  );
  assert.equal(calls,0);
});

test('Repository expected revision blocks before implementation',async()=>{
  let calls=0;
  const runtime=createRepositoryRuntime({
    repository,project_id:'demo',connectors:{'demo.store':connectorRuntime()},
    implementation:async()=>{calls++;return{status:'SUCCEEDED'};}
  });
  await assert.rejects(
    ()=>runtime.invoke('entity.update',{id:'1'},{correlation_id:'corr-2',idempotency_key:'caller-1'}),
    /REPOSITORY_EXPECTED_REVISION_REQUIRED/
  );
  assert.equal(calls,0);
});

test('read operation receives only its mapped Connector operation',async()=>{
  const runtime=createRepositoryRuntime({
    repository,project_id:'demo',connectors:{'demo.store':connectorRuntime()},
    implementation:async({connector,input})=>{
      assert.deepEqual(connector.operation_ids,['entity.read']);
      const transport=await connector.invoke('entity.read',input);
      return {status:'SUCCEEDED',data:transport.data,revision:'r7',evidence_refs:['db:read']};
    }
  });
  const result=await runtime.invoke('entity.get',{id:'1'},{correlation_id:'corr-3'});
  assert.equal(result.status,'SUCCEEDED');
  assert.equal(result.revision,'r7');
  assert.deepEqual(result.evidence_refs,['db:read']);
});

test('read operation cannot escalate itself to a write Connector operation',async()=>{
  const runtime=createRepositoryRuntime({
    repository,project_id:'demo',connectors:{'demo.store':connectorRuntime()},
    implementation:async({connector})=>{
      await connector.invoke('entity.write',{id:'1'});
      return {status:'SUCCEEDED'};
    }
  });
  const result=await runtime.invoke('entity.get',{id:'1'},{correlation_id:'corr-4'});
  assert.equal(result.status,'FAILED');
  assert.equal(result.error_code,'PERSISTENCE_ERROR');
});

test('declared repository failure is preserved, undeclared failure maps to persistence error',async()=>{
  const declared=createRepositoryRuntime({
    repository,project_id:'demo',connectors:{'demo.store':connectorRuntime()},
    implementation:async()=>({status:'FAILED',error_code:'NOT_FOUND'})
  });
  const a=await declared.invoke('entity.get',{id:'404'},{correlation_id:'corr-5'});
  assert.equal(a.error_code,'NOT_FOUND');

  const unknown=createRepositoryRuntime({
    repository,project_id:'demo',connectors:{'demo.store':connectorRuntime()},
    implementation:async()=>({status:'FAILED',error_code:'PROVIDER_WEIRD'})
  });
  const b=await unknown.invoke('entity.get',{id:'x'},{correlation_id:'corr-6'});
  assert.equal(b.error_code,'PERSISTENCE_ERROR');
});
