const need=(condition,code)=>{if(!condition) throw new Error(code);};
const clean=value=>String(value??'').normalize('NFKC').trim();
const nonempty=value=>typeof value==='string'&&value.trim()===value&&value.length>0;

const CLASSIFICATIONS=new Set([
  'MERGE_PHYSICAL',
  'COLOCATE_ONLY',
  'EXTRACT_SHARED',
  'KEEP_SEPARATE',
  'RETIRE',
]);

const DIRTY_STATES=new Set(['CLEAN','DIRTY','UNKNOWN']);
const CONSENSUS_STATES=new Set(['CONSENSUS','ADJUSTED_CONSENSUS','HOLD','NOT_REVIEWED']);

const unique=values=>[...new Set((values??[]).map(clean).filter(Boolean))];

function normalizeAsset(asset,index){
  need(asset&&typeof asset==='object'&&!Array.isArray(asset),'INTEGRATION_ASSET_INVALID');
  const assetId=clean(asset.asset_id)||`asset-${index+1}`;
  const repository=clean(asset.repository);
  const revision=clean(asset.revision);
  const classification=clean(asset.classification);
  const dirtyState=clean(asset.dirty_state)||'UNKNOWN';
  const consensus=clean(asset.reviewer_consensus)||'NOT_REVIEWED';

  need(nonempty(repository),'INTEGRATION_REPOSITORY_REQUIRED');
  need(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository),'INTEGRATION_REPOSITORY_INVALID');
  need(/^[0-9a-f]{40}$/.test(revision),'INTEGRATION_REVISION_REQUIRED');
  need(CLASSIFICATIONS.has(classification),'INTEGRATION_CLASSIFICATION_INVALID');
  need(DIRTY_STATES.has(dirtyState),'INTEGRATION_DIRTY_STATE_INVALID');
  need(CONSENSUS_STATES.has(consensus),'INTEGRATION_CONSENSUS_INVALID');

  return {
    asset_id:assetId,
    current_path:clean(asset.current_path)||null,
    project_id:clean(asset.project_id)||null,
    repository,
    revision,
    role:clean(asset.role)||null,
    data_ssot:clean(asset.data_ssot)||null,
    deploy_targets:unique(asset.deploy_targets),
    dirty_state:dirtyState,
    classification,
    reviewer_consensus:consensus,
    rollback_ready:asset.rollback_ready===true,
    evidence_refs:unique(asset.evidence_refs),
    required_approvals:unique(asset.required_approvals),
    approval_refs:unique(asset.approval_refs),
    source_project_ids:unique(asset.source_project_ids),
    user_decision_ref:clean(asset.user_decision_ref)||null,
    unknowns:unique(asset.unknowns),
  };
}

function blockersFor(asset){
  const blockers=[];
  if(asset.dirty_state!=='CLEAN') blockers.push(asset.dirty_state==='DIRTY'?'WORKTREE_DIRTY':'DIRTY_STATE_UNKNOWN');
  if(asset.evidence_refs.length===0) blockers.push('REVISION_EVIDENCE_REQUIRED');
  if(!['CONSENSUS','ADJUSTED_CONSENSUS'].includes(asset.reviewer_consensus)) blockers.push('REVIEW_CONSENSUS_REQUIRED');
  if(asset.unknowns.length) blockers.push('UNRESOLVED_UNKNOWNS');

  if(asset.classification==='MERGE_PHYSICAL'){
    if(!asset.rollback_ready) blockers.push('ROLLBACK_PLAN_REQUIRED');
    if(asset.required_approvals.length&&!asset.approval_refs.length) blockers.push('REQUIRED_APPROVAL_EVIDENCE_MISSING');
  }

  if(asset.classification==='EXTRACT_SHARED'){
    if(asset.source_project_ids.length<2) blockers.push('MULTI_PROJECT_EVIDENCE_REQUIRED');
    if(!asset.rollback_ready) blockers.push('EXTRACTION_ROLLBACK_PLAN_REQUIRED');
  }

  if(asset.classification==='RETIRE'){
    if(!asset.user_decision_ref) blockers.push('USER_RETIRE_DECISION_REQUIRED');
    if(!asset.rollback_ready) blockers.push('RETIRE_RECOVERY_PLAN_REQUIRED');
  }

  return [...new Set(blockers)];
}

function plannedSteps(asset){
  const common=[
    'PIN_SOURCE_REVISION',
    'PRESERVE_ORIGINAL',
  ];
  if(asset.classification==='MERGE_PHYSICAL') return [
    ...common,
    'PREPARE_TARGET_LOCATION',
    'REPLAY_OR_MOVE_CONTENT',
    'VERIFY_EQUIVALENCE',
    'CUTOVER_AFTER_APPROVAL',
    'OBSERVE_BEFORE_RETIRE_OLD_LOCATION',
  ];
  if(asset.classification==='COLOCATE_ONLY') return [
    ...common,
    'PREPARE_GROUP_WORKSPACE_LOCATION',
    'KEEP_GIT_SSOT_AND_DEPLOY_BOUNDARY',
    'VERIFY_PATH_DEPENDENCIES',
  ];
  if(asset.classification==='EXTRACT_SHARED') return [
    ...common,
    'IDENTIFY_SHARED_CONTRACT',
    'EXTRACT_WITH_VERSIONED_BOUNDARY',
    'PILOT_IN_SOURCE_PROJECTS',
    'VERIFY_PARITY_AND_ROLLBACK',
  ];
  if(asset.classification==='KEEP_SEPARATE') return [
    ...common,
    'REGISTER_POINTERS_ONLY',
    'PRESERVE_PROJECT_AUTHORITY',
  ];
  return [
    ...common,
    'FREEZE_NEW_DEPENDENCIES',
    'VERIFY_REPLACEMENT_OR_NON_USE',
    'RETIRE_AFTER_EXPLICIT_APPROVAL',
  ];
}

export function compileGroupIntegrationPlan(input={}){
  need(input&&typeof input==='object'&&!Array.isArray(input),'INTEGRATION_PLAN_INPUT_INVALID');
  need(Array.isArray(input.assets)&&input.assets.length>0,'INTEGRATION_ASSETS_REQUIRED');

  const assets=input.assets.map(normalizeAsset);
  const seen=new Set();
  for(const asset of assets){
    need(!seen.has(asset.asset_id),'INTEGRATION_ASSET_ID_DUPLICATE');
    seen.add(asset.asset_id);
  }

  const items=assets.map(asset=>{
    const blockers=blockersFor(asset);
    return {
      ...asset,
      execution_readiness:blockers.length?'HOLD':'READY_FOR_REVIEWED_EXECUTION',
      blockers,
      planned_steps:plannedSteps(asset),
      execution_authorized:false,
    };
  });

  const counts={};
  for(const name of CLASSIFICATIONS) counts[name]=items.filter(item=>item.classification===name).length;

  return {
    schema:'ai-core-group-integration-plan/v1',
    plan_id:clean(input.plan_id)||'group-integration-plan',
    objective:clean(input.objective)||'Safely integrate or co-locate group assets without creating a second SSOT.',
    policy:{
      mode:'PLAN_ONLY',
      classification_inference:false,
      auto_execution:false,
      auto_retire:false,
      source_of_truth:'docs/AI_CORE_INTEGRATION_EXECUTION_DIRECTIVE.md',
    },
    summary:{
      total:items.length,
      ready_for_reviewed_execution:items.filter(item=>item.execution_readiness==='READY_FOR_REVIEWED_EXECUTION').length,
      hold:items.filter(item=>item.execution_readiness==='HOLD').length,
      by_classification:counts,
    },
    items,
  };
}

export async function aiCoreGroupIntegrationPlan(input={}){
  try{
    const plan=compileGroupIntegrationPlan(input);
    return {
      status:'SUCCEEDED',
      summary:`통합 계획 ${plan.summary.total}건을 분류했습니다. 실행 검토 가능 ${plan.summary.ready_for_reviewed_execution}건, HOLD ${plan.summary.hold}건입니다.`,
      data:plan,
      evidence:plan.items.flatMap(item=>item.evidence_refs),
      artifacts:[],
      checks:[
        {name:'group-integration.classification-explicit',status:'PASS',detail:'classification_inference=false'},
        {name:'group-integration.execution-boundary',status:'PASS',detail:'execution_authorized=false'},
      ],
      blockers:[],
      next_action:plan.summary.hold
        ?'HOLD 항목의 revision evidence, dirty state, consensus, rollback 또는 승인 근거를 채웁니다.'
        :'각 항목의 planned_steps를 별도 Work Packet으로 만들고 실제 실행 권한을 다시 확인합니다.',
      external_effect:false,
    };
  }catch(error){
    return {
      status:'HOLD',
      summary:'그룹 통합 계획 입력 계약을 만족하지 못했습니다.',
      data:null,
      evidence:[],
      artifacts:[],
      checks:[{name:'group-integration.plan',status:'FAIL',detail:error?.message??'INTEGRATION_PLAN_INVALID'}],
      blockers:[error?.message??'INTEGRATION_PLAN_INVALID'],
      next_action:'자산별 exact revision, explicit classification, dirty state와 evidence를 채웁니다.',
      external_effect:false,
    };
  }
}
