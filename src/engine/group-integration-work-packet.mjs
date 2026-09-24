const need=(condition,code)=>{if(!condition) throw new Error(code);};
const clean=value=>String(value??'').normalize('NFKC').trim();
const nonempty=value=>typeof value==='string'&&value.trim()===value&&value.length>0;

const ACTION_BY_CLASSIFICATION=Object.freeze({
  MERGE_PHYSICAL:'CROSS_REPO_WRITE',
  COLOCATE_ONLY:'FILESYSTEM_RELOCATION',
  EXTRACT_SHARED:'CROSS_REPO_WRITE',
  KEEP_SEPARATE:'METADATA_ONLY',
  RETIRE:'RETIRE_RESOURCE',
});

function packetId(prefix,index,assetId){
  const safe=clean(assetId).replace(/[^a-zA-Z0-9._-]+/g,'-');
  return `${prefix}-${String(index+1).padStart(3,'0')}-${safe}`;
}

function requiredVerification(item){
  const base=[
    'SOURCE_REVISION_UNCHANGED',
    'DIRTY_STATE_RECHECK',
    'PLAN_ITEM_STILL_READY',
  ];
  if(item.classification==='MERGE_PHYSICAL') return [...base,'IMPORT_CONTENT_POLICY_CHECK','CANONICAL_AUTHORITY_COLLISION_CHECK','SOURCE_RUNTIME_DEPENDENCY_CHECK','TARGET_PARITY_CHECK','ROLLBACK_PATH_VERIFIED'];
  if(item.classification==='COLOCATE_ONLY') return [...base,'PATH_DEPENDENCY_CHECK'];
  if(item.classification==='EXTRACT_SHARED') return [...base,'IMPORT_CONTENT_POLICY_CHECK','CANONICAL_AUTHORITY_COLLISION_CHECK','SOURCE_RUNTIME_DEPENDENCY_CHECK','SOURCE_PROJECT_PARITY_CHECK','CONSUMER_COMPATIBILITY_CHECK','ROLLBACK_PATH_VERIFIED'];
  if(item.classification==='RETIRE') return [...base,'NON_USE_OR_REPLACEMENT_VERIFIED','RECOVERY_PATH_VERIFIED'];
  return [...base,'PROJECT_AUTHORITY_UNCHANGED'];
}

function forbiddenActions(item){
  const common=[
    'CHANGE_UNRELATED_PROJECTS',
    'CHANGE_PRODUCTION_DATA',
    'CHANGE_SECRETS_OR_CREDENTIALS',
    'SKIP_REVISION_REVALIDATION',
    'AUTO_CLOSE_WORK',
  ];
  if(item.classification!=='RETIRE') common.push('DELETE_OR_RETIRE_SOURCE');
  if(item.classification==='KEEP_SEPARATE') common.push('MERGE_GIT_HISTORY');
  if(['MERGE_PHYSICAL','EXTRACT_SHARED'].includes(item.classification)){
    common.push(
      'COPY_SECRETS_OR_CREDENTIALS',
      'COPY_OPERATIONAL_DATA_OR_LOGS',
      'COPY_COMPETING_CANONICAL_AUTHORITY',
      'COPY_DEPLOYMENT_BOUNDARY_CONFIG'
    );
  }
  return common;
}

export function compileIntegrationWorkPackets(plan,{packet_prefix='INT-WP'}={}){
  need(plan?.schema==='ai-core-group-integration-plan/v1','GROUP_INTEGRATION_PLAN_REQUIRED');
  need(Array.isArray(plan.items),'GROUP_INTEGRATION_PLAN_ITEMS_REQUIRED');
  need(nonempty(packet_prefix),'WORK_PACKET_PREFIX_REQUIRED');

  const eligible=plan.items.filter(item=>item.execution_readiness==='READY_FOR_REVIEWED_EXECUTION');
  eligible.forEach(item=>need(Boolean(ACTION_BY_CLASSIFICATION[item.classification]),'WORK_PACKET_CLASSIFICATION_INVALID'));

  const packets=eligible.map((item,index)=>({
    schema:'ai-core-integration-work-packet/v1',
    packet_id:packetId(packet_prefix,index,item.asset_id),
    plan_id:plan.plan_id,
    asset_id:item.asset_id,
    project_id:item.project_id,
    repository:item.repository,
    expected_revision:item.revision,
    classification:item.classification,
    action_kind:ACTION_BY_CLASSIFICATION[item.classification],
    current_path:item.current_path,
    planned_steps:[...(item.planned_steps??[])],
    preconditions:{
      dirty_state:'CLEAN',
      reviewer_consensus:[item.reviewer_consensus],
      evidence_refs:[...(item.evidence_refs??[])],
      required_approvals:[...(item.required_approvals??[])],
      approval_refs:[...(item.approval_refs??[])],
      unknowns_must_be_empty:true,
    },
    authority:{
      required:true,
      status:'PENDING',
      execution_authorized:false,
      scope:[
        `repository:${item.repository}`,
        `revision:${item.revision}`,
        `classification:${item.classification}`,
      ],
    },
    revalidation:{
      immediately_before_execution:true,
      required_checks:requiredVerification(item),
    },
    verification:{
      required:true,
      checks:requiredVerification(item),
      evidence_must_bind_revision:true,
    },
    rollback:{
      required:['MERGE_PHYSICAL','EXTRACT_SHARED','RETIRE'].includes(item.classification),
      ready:item.rollback_ready===true,
    },
    forbidden_actions:forbiddenActions(item),
    completion:{
      auto_complete:false,
      requires_verification_evidence:true,
      requires_work_ledger_result:true,
    },
  }));

  return {
    schema:'ai-core-integration-work-packet-set/v1',
    plan_id:plan.plan_id,
    source_plan_summary:{...plan.summary},
    packet_count:packets.length,
    skipped_hold_count:plan.items.length-packets.length,
    execution_authorized:false,
    packets,
  };
}

export async function aiCoreIntegrationWorkPackets(input={}){
  try{
    const set=compileIntegrationWorkPackets(input.plan??input,{packet_prefix:input.packet_prefix??'INT-WP'});
    return {
      status:'SUCCEEDED',
      summary:`통합 실행 패킷 ${set.packet_count}건을 준비했습니다. HOLD 항목 ${set.skipped_hold_count}건은 패킷으로 만들지 않았습니다.`,
      data:set,
      evidence:set.packets.flatMap(packet=>packet.preconditions.evidence_refs),
      artifacts:[],
      checks:[
        {name:'integration-work-packet.hold-filter',status:'PASS',detail:`skipped_hold=${set.skipped_hold_count}`},
        {name:'integration-work-packet.authority-boundary',status:'PASS',detail:'execution_authorized=false; authority=PENDING'},
      ],
      blockers:[],
      next_action:set.packet_count
        ?'각 패킷 실행 직전에 revision/dirty/approval/검증 조건을 다시 확인하고 별도 authority를 받아야 합니다.'
        :'실행 검토 가능한 통합 항목이 없습니다. Plan의 HOLD blocker를 먼저 해소합니다.',
      external_effect:false,
    };
  }catch(error){
    return {
      status:'HOLD',
      summary:'통합 Work Packet 입력 계약을 만족하지 못했습니다.',
      data:null,
      evidence:[],
      artifacts:[],
      checks:[{name:'integration-work-packet.compile',status:'FAIL',detail:error?.message??'INTEGRATION_WORK_PACKET_INVALID'}],
      blockers:[error?.message??'INTEGRATION_WORK_PACKET_INVALID'],
      next_action:'ai-core-group-integration-plan/v1 결과를 입력합니다.',
      external_effect:false,
    };
  }
}
