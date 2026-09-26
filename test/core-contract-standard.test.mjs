import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { resolveBinding } from '../src/contracts/engine-adapter-contract.mjs';

const registry=JSON.parse(await readFile(new URL('../registry/core-contracts.json',import.meta.url),'utf8'));
const schemas=await Promise.all(registry.contracts.map(async contract=>JSON.parse(await readFile(new URL('../'+contract.path,import.meta.url),'utf8'))));
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv);
for(const schema of schemas) ajv.addSchema(schema);
const schema=id=>ajv.getSchema(id);

test('core money uses minor units plus ISO currency and percentage is percentage-points',()=>{
  const types=schemas.find(x=>x.$id==='https://schemas.freepass.ai/core/types/v1');
  const money=ajv.compile({$ref:'https://schemas.freepass.ai/core/types/v1#/$defs/money'});
  assert.equal(money({amount_minor:125000,currency:'KRW'}),true);
  assert.equal(money({amount_minor:1250.5,currency:'KRW'}),false);
  assert.match(types.$defs.percentage.description,/10 means 10%/);
});

test('provenance requires an authoritative source revision or immutable checksum',()=>{
  const validate=schema('https://schemas.freepass.ai/core/provenance/v1');
  const base={
    schema_version:'core-provenance/v1',
    canonical_owner:'vehicle-master',
    canonical_writer:'erp4-publisher',
    subject:{entity_type:'vehicle_trim',id:'trim_123',revision:'r42'},
    source:{source_id:'supplier_1',source_type:'SHEET',source_ref:'sheet:cars!A2:Z2',observed_at:'2026-09-19T12:00:00Z'},
    normalization:{normalizer_id:'supplier-row',normalizer_version:'2.1.0'}
  };
  assert.equal(validate({...base,source:{...base.source,source_revision:'sheet-rev-7'}}),true);
  assert.equal(validate(base),false);
});

test('adapter result makes retryability, version and evidence explicit',()=>{
  const validate=schema('https://schemas.freepass.ai/core/adapter-result/v1');
  const good={
    schema_version:'core-adapter-result/v1',adapter_id:'welrix.quote',adapter_version:'1.4.0',
    provider_id:'welrix',source_revision:'catalog-88',correlation_id:'corr_001',
    status:'SUCCEEDED',retryable:false,data:{monthly_rent:500000},issues:[],
    evidence_refs:['provider-response:sha256:abc'],started_at:'2026-09-19T12:00:00Z',ended_at:'2026-09-19T12:00:01Z'
  };
  assert.equal(validate(good),true);
  const bad={...good}; delete bad.adapter_version;
  assert.equal(validate(bad),false);
});

test('error contract rejects project-local string-only errors',()=>{
  const validate=schema('https://schemas.freepass.ai/core/error/v1');
  assert.equal(validate({error:'lock_conflict'}),false);
  assert.equal(validate({
    type:'https://errors.freepass.ai/core/version-mismatch',title:'Version conflict',status:409,
    code:'VERSION_MISMATCH',category:'USER',correlation_id:'corr_002',retryable:false,
    meta:{expected_revision:'r1',current_revision:'r2'}
  }),true);
});

test('event envelope has correlation, causation, producer, versions and subject revision without owning workflow state',()=>{
  const validate=schema('https://schemas.freepass.ai/core/event/v1');
  const event={
    schema_version:'core-event/v1',event_id:'evt_001',event_type:'freepass.quote.created',event_version:'v1',
    producer:'freepass-sales',occurred_at:'2026-09-19T12:00:00Z',recorded_at:'2026-09-19T12:00:00Z',
    correlation_id:'corr_003',causation_id:null,subject:{type:'quote',id:'quote_001',revision:'r1'},
    payload:{quote_id:'quote_001'},evidence_refs:['receipt:quote_001']
  };
  assert.equal(validate(event),true);
  assert.equal('state' in event,false);
});

test('receipt preserves input/output digests, executor revision and evidence',()=>{
  const validate=schema('https://schemas.freepass.ai/core/receipt/v1');
  const receipt={
    schema_version:'core-receipt/v1',receipt_id:'rcpt_001',operation_id:'op_001',operation_kind:'quote.calculate',
    actor:'user:123',executor:'freepass-estimate',correlation_id:'corr_004',status:'SUCCEEDED',reason_code:null,
    input:{digest:'sha256:'+'a'.repeat(64),refs:['quote-input:1']},
    output:{digest:'sha256:'+'b'.repeat(64),refs:['quote-output:1']},source_revision:'git:abc',
    started_at:'2026-09-19T12:00:00Z',ended_at:'2026-09-19T12:00:01Z',evidence_refs:['artifact:quote.json'],
    reproducibility:{deterministic:true,executor_version:'1.0.0',environment_revision:'node-24',command_ref:'quote.calculate/v1'}
  };
  assert.equal(validate(receipt),true);
  const bad=structuredClone(receipt); bad.input.digest='abc';
  assert.equal(validate(bad),false);
});


test('snapshot pins subject and source revisions with immutable payload digest',()=>{
  const validate=schema('https://schemas.freepass.ai/core/snapshot/v1');
  const snapshot={
    schema_version:'core-snapshot/v1',snapshot_id:'snap_001',subject_type:'quote',subject_id:'quote_001',
    subject_revision:'r7',source_revision:'catalog-r12',created_at:'2026-09-19T12:30:00Z',
    payload:{monthly_rent:500000},payload_digest:'sha256:'+'c'.repeat(64)
  };
  assert.equal(validate(snapshot),true);
  const broken={...snapshot}; delete broken.subject_revision;
  assert.equal(validate(broken),false);
});

test('request idempotency binds key to semantic payload digest and expected revision',()=>{
  const validate=schema('https://schemas.freepass.ai/core/request-context/v1');
  const ctx={
    schema_version:'core-request-context/v1',request_id:'req_001',correlation_id:'corr_005',
    actor:{actor_id:'service:freepass-sales',actor_type:'SERVICE'},expected_revision:'r3',
    idempotency:{mode:'REQUIRED',key:'idem_001',semantic_payload_digest:'sha256:'+'d'.repeat(64)}
  };
  assert.equal(validate(ctx),true);
  const broken=structuredClone(ctx); delete broken.idempotency.semantic_payload_digest;
  assert.equal(validate(broken),false);
});

test('query contract keeps filters and sort structured and cursor pagination bounded',()=>{
  const validate=schema('https://schemas.freepass.ai/core/query/v1');
  const query={
    schema_version:'core-query/v1',search:'ev3',
    filters:[{field:'vehicle.availability',operator:'EQ',value:'AVAILABLE'}],
    sort:[{field:'created_at',direction:'DESC'}],
    page:{cursor:null,limit:100}
  };
  assert.equal(validate(query),true);
  const broken=structuredClone(query); broken.page.limit=1000;
  assert.equal(validate(broken),false);
});

test('event type contract declares consumers duplicate handling and replay policy',()=>{
  const validate=schema('https://schemas.freepass.ai/core/event-type/v1');
  const type={
    schema_version:'core-event-type-contract/v1',event_type:'freepass.quote.created',event_version:'v1',
    producer:'freepass-sales',payload_schema:'quote-created-payload/v1',consumers:['analytics'],
    duplicate_policy:'IDEMPOTENT_BY_EVENT_ID',replay_policy:'REPLAYABLE',retention:{minimum_days:30}
  };
  assert.equal(validate(type),true);
  const broken={...type,duplicate_policy:'IGNORE_SOMETIMES'};
  assert.equal(validate(broken),false);
});

test('generic result distinguishes successful data from structured failure',()=>{
  const validate=schema('https://schemas.freepass.ai/core/result/v1');
  assert.equal(validate({
    schema_version:'core-result/v1',status:'SUCCEEDED',data:{id:'x'},error:null,
    meta:{correlation_id:'corr_006',generated_at:'2026-09-19T12:31:00Z',receipt_ref:'receipt:x'}
  }),true);
  assert.equal(validate({
    schema_version:'core-result/v1',status:'FAILED',data:null,error:null,
    meta:{correlation_id:'corr_007',generated_at:'2026-09-19T12:31:00Z',receipt_ref:null}
  }),false);
});

test('code-set contract separates code lifecycle from mutable display labels',()=>{
  const validate=schema('https://schemas.freepass.ai/core/code-set/v1');
  assert.equal(validate({
    schema_version:'core-code-set/v1',set_id:'vehicle.condition',version:'v1',owner:'vehicle-domain',
    open_enum:true,values:[{code:'NORMAL',status:'ACTIVE',deprecated_since:null,replacement_code:null}]
  }),true);
});


test('receipt accepts compact operation metrics without project-specific schema pollution',()=>{
  const validate=schema('https://schemas.freepass.ai/core/receipt/v1');
  const receipt={
    schema_version:'core-receipt/v1',receipt_id:'rcpt_batch_001',operation_id:'op_batch_001',operation_kind:'inventory.refresh',
    actor:'system:scheduler',executor:'erp5-refresh',correlation_id:'corr_batch_001',status:'PARTIAL',reason_code:'SUPPLIER_BATCH_PARTIAL',
    input:{digest:'sha256:'+'e'.repeat(64),refs:['source-registry:v1']},
    output:{digest:'sha256:'+'f'.repeat(64),refs:['erp5:products']},source_revision:'git:abc',
    started_at:'2026-09-19T12:00:00Z',ended_at:'2026-09-19T12:01:00Z',evidence_refs:['run:1'],
    metrics:{phase:'APPLY',supplier_success:22,supplier_failed:2,supplier_total:24},
    reproducibility:{deterministic:false,executor_version:'abc',environment_revision:'run:1',command_ref:'inventory.refresh'}
  };
  assert.equal(validate(receipt),true);
});


test('application service contract keeps orchestration separate from domain engine',()=>{
  const validate=schema('https://schemas.freepass.ai/core/application-service/v1');
  const service={
    schema_version:'core-application-service-contract/v1',
    service_id:'freepass.application.submit',version:'1.0.0',
    source:{locator:'src/services/applications.ts',revision:'git:abc'},
    use_cases:[
      {
        name:'submit',input_contract:'SubmitApplicationInput',output_contract:'SubmitResult',
        side_effects:true,idempotency:'REQUIRED',actor_requirement:'REQUIRED',
        transaction_boundary:'REPOSITORY_ATOMIC',error_codes:['NOT_FOUND','VERSION_MISMATCH']
      },
      {
        name:'cancel',input_contract:'CancelInput',output_contract:'CancelResult',
        side_effects:true,idempotency:'SUPPORTED',actor_requirement:'REQUIRED',
        transaction_boundary:'REPOSITORY_ATOMIC',error_codes:['NOT_FOUND','CANCELLED']
      }
    ],
    required_ports:[
      {port_id:'application.repository',port_version:'v1'},
      {port_id:'product.repository',port_version:'v1'},
      {port_id:'actor.provider',port_version:'v1'}
    ],
    verification_profile:['service-unit','repository-contract']
  };
  assert.equal(validate(service),true);
});


test('mixed repository port and service-only binding profile are valid',()=>{
  const port=schema('https://schemas.freepass.ai/core/port/v1');
  assert.equal(port({
    schema_version:'core-port-contract/v1',port_id:'application.repository',port_version:'v1',
    semantics:'Atomic application persistence and lookup',direction:'MIXED',
    input_schema:null,output_schema:null,side_effects:true,idempotency:'REQUIRED',
    error_codes:['NOT_FOUND','CONFLICT','PERSISTENCE_ERROR']
  }),true);

  const binding=schema('https://schemas.freepass.ai/core/binding-profile/v1');
  assert.equal(binding({
    schema_version:'core-binding-profile/v1',profile_id:'freepass-admin.dev',project_id:'freepass-admin',
    environment:'development',subject_revision:'git:abc',engine_bindings:[],
    service_bindings:[{
      service_id:'freepass.application.service',service_version:'1.0.0',
      ports:[{port_id:'application.repository',adapter_id:'freepass-admin.file-application'}]
    }],
    config_refs:[],secret_refs:[],verification_state:'PARTIAL'
  }),true);
});

test('binding fails closed when an adapter id is ambiguous',()=>{
  const engine={
    schema_version:'core-engine-contract/v1',engine_id:'quote.core',version:'1.0.0',
    source:{locator:'src/quote.mjs',revision:'git:engine'},
    invariants:['binding identity is deterministic'],verification_profile:['contract'],
    effect_model:'PORT_MEDIATED',required_ports:[{port_id:'vehicle.read',port_version:'v1'}]
  };
  const adapter={
    schema_version:'core-adapter-contract/v1',adapter_id:'adapter.vehicle.read',adapter_version:'1.0.0',
    port_id:'vehicle.read',source:{locator:'src/read-a.mjs',revision:'git:a'},
    compatibility:{port_versions:['v1'],engine_versions:['1.0.0']},
    mapping:[{canonical_field:'vehicle.id',provider_field:'id',transformation:'identity',unit_conversion:null}],
    side_effects:false,idempotency:'NOT_APPLICABLE',timeout_ms:1000,
    auth_boundary:'none',data_classification:['INTERNAL'],
    failure_mapping:[{provider_code:'not_found',core_code:'NOT_FOUND'}],health_check:'fixture'
  };
  const duplicate={...structuredClone(adapter),adapter_version:'2.0.0',source:{locator:'src/read-b.mjs',revision:'git:b'}};
  const profile={subject_revision:'git:project',engine_bindings:[{
    engine_id:'quote.core',engine_version:'1.0.0',ports:[{port_id:'vehicle.read',adapter_id:'adapter.vehicle.read'}]
  }]};
  const result=resolveBinding({engine,adapters:[adapter,duplicate],profile});
  assert.equal(result.status,'HOLD');
  assert.deepEqual(result.selected_adapters,[]);
  assert.ok(result.errors.includes('ADAPTER_DUPLICATE_ID:adapter.vehicle.read'));
});

test('activation decision keeps complete observation separate from activation authority',()=>{
  const validate=schema('https://schemas.freepass.ai/governance/activation-decision/v1');
  const base={
    schema_version:'governance-activation-decision/v1',
    subject:{type:'catalog',id:'freepass-products',revision:'sha256:catalog-r1'},
    observation:{status:'COMPLETE',evidence_refs:['capture:full-r1']},
    review:{status:'HOLD',evidence_refs:[]},
    release:{status:'NOT_BUILT',release_id:null,evidence_refs:[]},
    decision:'HOLD',
    reasons:['REVIEW_NOT_APPROVED','CANONICAL_RELEASE_NOT_BUILT'],
    decided_at:'2026-09-26T05:00:00Z'
  };
  assert.equal(validate(base),true);

  const falsePromotion=structuredClone(base);
  falsePromotion.decision='AUTHORIZED';
  falsePromotion.reasons=[];
  assert.equal(validate(falsePromotion),false,'complete observation alone must never authorize activation');

  const authorized={
    ...base,
    review:{status:'APPROVED',evidence_refs:['review:approval-r1']},
    release:{status:'BUILT',release_id:'release-r1',evidence_refs:['release:manifest-r1']},
    decision:'AUTHORIZED',
    reasons:[]
  };
  assert.equal(validate(authorized),true);

  const unexplainedHold={...base,reasons:[]};
  assert.equal(validate(unexplainedHold),false,'HOLD must explain why authority is withheld');
});
