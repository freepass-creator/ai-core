import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSourceRegistry, validateDataPipeline } from '../src/contracts/data-contract.mjs';

const sourceRegistry={
  schema_version:'core-source-registry/v1',
  subject_type:'vehicle.trim',
  canonical_owner:'vehicle-master',
  canonical_writer:'erp4-publisher',
  sources:[
    {source_id:'vehicle-master-db',role:'CANONICAL',priority:1,authoritative:true,freshness:{max_age_seconds:3600,on_stale:'HOLD'}},
    {source_id:'supplier-sheet',role:'UPSTREAM',priority:2,authoritative:true,freshness:{max_age_seconds:7200,on_stale:'REJECT'}},
    {source_id:'legacy-json',role:'RECOVERY_ONLY',priority:3,authoritative:false,freshness:{max_age_seconds:null,on_stale:'ALLOW_WITH_WARNING'}}
  ],
  fallback_policy:{mode:'EXPLICIT_ONLY',requires_explicit_activation:true,evidence_required:true}
};

test('SSOT source registry has exactly one canonical source at priority 1',()=>{
  assert.equal(validateSourceRegistry(sourceRegistry).canonical_source_id,'vehicle-master-db');
  const duplicate=structuredClone(sourceRegistry);
  duplicate.sources[1].role='CANONICAL';
  assert.throws(()=>validateSourceRegistry(duplicate),/CANONICAL_SOURCE_COUNT_INVALID/);
});

test('SSOT source priority collision is rejected',()=>{
  const broken=structuredClone(sourceRegistry);
  broken.sources[2].priority=2;
  assert.throws(()=>validateSourceRegistry(broken),/SOURCE_PRIORITY_DUPLICATE:2/);
});

test('silent fallback is rejected even when a recovery source exists',()=>{
  const broken=structuredClone(sourceRegistry);
  broken.fallback_policy.requires_explicit_activation=false;
  assert.throws(()=>validateSourceRegistry(broken),/SILENT_FALLBACK_FORBIDDEN/);
});

test('import pipeline preserves raw snapshot and validates before atomic commit',()=>{
  const pipeline={
    schema_version:'core-data-pipeline-contract/v1',pipeline_id:'vehicle.import',direction:'IMPORT',version:'1.0.0',
    source:'supplier-sheet',target:'vehicle-master',
    stages:['RAW_SNAPSHOT','PARSE','NORMALIZE','VALIDATE','IDENTITY_RESOLVE','REVIEW','COMMIT'],
    commit_policy:'ATOMIC',receipt_required:true
  };
  assert.equal(validateDataPipeline(pipeline).status,'VALID');
  const broken={...pipeline,stages:['PARSE','RAW_SNAPSHOT','NORMALIZE','VALIDATE','COMMIT']};
  assert.throws(()=>validateDataPipeline(broken),/IMPORT_RAW_SNAPSHOT_MUST_BE_FIRST/);
});

test('export pipeline projects before serialization and cannot commit canonical data',()=>{
  const pipeline={
    schema_version:'core-data-pipeline-contract/v1',pipeline_id:'catalog.export',direction:'EXPORT',version:'1.0.0',
    source:'vehicle-master',target:'public-catalog',
    stages:['PROJECT','PRIVACY_FILTER','SERIALIZE','DELIVER'],
    commit_policy:'READ_ONLY',receipt_required:true
  };
  assert.equal(validateDataPipeline(pipeline).status,'VALID');
  const broken={...pipeline,stages:['PROJECT','COMMIT','SERIALIZE']};
  assert.throws(()=>validateDataPipeline(broken),/EXPORT_COMMIT_FORBIDDEN/);
});
