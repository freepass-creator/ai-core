const need=(condition,code)=>{if(!condition) throw new Error(code);};

export function validateSourceRegistry(registry){
  need(registry?.schema_version==='core-source-registry/v1','SOURCE_REGISTRY_VERSION_INVALID');
  need(typeof registry.canonical_owner==='string'&&registry.canonical_owner.length>0,'CANONICAL_OWNER_REQUIRED');
  need(typeof registry.canonical_writer==='string'&&registry.canonical_writer.length>0,'CANONICAL_WRITER_REQUIRED');
  need(Array.isArray(registry.sources)&&registry.sources.length>0,'SOURCE_REQUIRED');

  const ids=new Set(), priorities=new Set();
  for(const source of registry.sources){
    need(typeof source.source_id==='string'&&source.source_id.length>0,'SOURCE_ID_REQUIRED');
    need(!ids.has(source.source_id),`SOURCE_ID_DUPLICATE:${source.source_id}`);
    ids.add(source.source_id);
    need(Number.isInteger(source.priority)&&source.priority>0,'SOURCE_PRIORITY_INVALID');
    need(!priorities.has(source.priority),`SOURCE_PRIORITY_DUPLICATE:${source.priority}`);
    priorities.add(source.priority);
  }

  const canonical=registry.sources.filter(x=>x.role==='CANONICAL');
  need(canonical.length===1,'CANONICAL_SOURCE_COUNT_INVALID');
  need(canonical[0].priority===1,'CANONICAL_SOURCE_PRIORITY_MUST_BE_1');
  need(canonical[0].authoritative===true,'CANONICAL_SOURCE_MUST_BE_AUTHORITATIVE');

  need(['NONE','EXPLICIT_ONLY'].includes(registry?.fallback_policy?.mode),'FALLBACK_POLICY_INVALID');
  need(registry.fallback_policy.requires_explicit_activation===true,'SILENT_FALLBACK_FORBIDDEN');
  need(registry.fallback_policy.evidence_required===true,'FALLBACK_EVIDENCE_REQUIRED');
  return {status:'VALID',canonical_source_id:canonical[0].source_id};
}

function indexOf(stages,value){return stages.indexOf(value);}
function before(stages,a,b){const ai=indexOf(stages,a), bi=indexOf(stages,b); return ai>=0&&bi>=0&&ai<bi;}

export function validateDataPipeline(pipeline){
  need(pipeline?.schema_version==='core-data-pipeline-contract/v1','PIPELINE_VERSION_INVALID');
  need(Array.isArray(pipeline.stages)&&pipeline.stages.length>0,'PIPELINE_STAGES_REQUIRED');
  need(new Set(pipeline.stages).size===pipeline.stages.length,'PIPELINE_STAGE_DUPLICATE');
  need(pipeline.receipt_required===true,'PIPELINE_RECEIPT_REQUIRED');
  need(['NOT_APPLICABLE','FAIL_BEFORE_COMMIT','ROLLBACK_REQUIRED','ALLOW_PARTIAL_WITH_RECEIPT'].includes(pipeline.partial_failure_policy),'PIPELINE_PARTIAL_FAILURE_POLICY_INVALID');
  if(pipeline.commit_policy==='BEST_EFFORT_BATCH') need(pipeline.partial_failure_policy==='ALLOW_PARTIAL_WITH_RECEIPT','BEST_EFFORT_BATCH_REQUIRES_PARTIAL_RECEIPT');
  if(['ATOMIC','TRANSACTIONAL_BATCH'].includes(pipeline.commit_policy)) need(pipeline.partial_failure_policy!=='ALLOW_PARTIAL_WITH_RECEIPT','ATOMIC_PIPELINE_CANNOT_ALLOW_PARTIAL');

  if(pipeline.direction==='IMPORT'){
    for(const stage of ['RAW_SNAPSHOT','PARSE','NORMALIZE','VALIDATE','COMMIT']){
      need(pipeline.stages.includes(stage),`IMPORT_STAGE_REQUIRED:${stage}`);
    }
    need(pipeline.stages[0]==='RAW_SNAPSHOT','IMPORT_RAW_SNAPSHOT_MUST_BE_FIRST');
    need(before(pipeline.stages,'PARSE','NORMALIZE'),'IMPORT_PARSE_BEFORE_NORMALIZE');
    need(before(pipeline.stages,'NORMALIZE','VALIDATE'),'IMPORT_NORMALIZE_BEFORE_VALIDATE');
    need(before(pipeline.stages,'VALIDATE','COMMIT'),'IMPORT_VALIDATE_BEFORE_COMMIT');
    need(indexOf(pipeline.stages,'COMMIT')===pipeline.stages.length-1,'IMPORT_COMMIT_MUST_BE_LAST');
  }else if(pipeline.direction==='EXPORT'){
    need(pipeline.stages.includes('PROJECT'),'EXPORT_PROJECT_REQUIRED');
    need(pipeline.stages.includes('SERIALIZE'),'EXPORT_SERIALIZE_REQUIRED');
    need(before(pipeline.stages,'PROJECT','SERIALIZE'),'EXPORT_PROJECT_BEFORE_SERIALIZE');
    need(!pipeline.stages.includes('COMMIT'),'EXPORT_COMMIT_FORBIDDEN');
    if(pipeline.stages.includes('DELIVER')) need(before(pipeline.stages,'SERIALIZE','DELIVER'),'EXPORT_SERIALIZE_BEFORE_DELIVER');
  }else{
    throw new Error('PIPELINE_DIRECTION_INVALID');
  }
  return {status:'VALID'};
}
