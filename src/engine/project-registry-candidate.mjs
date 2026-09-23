const need=(condition,code)=>{if(!condition) throw new Error(code);};
const nonempty=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const clean=value=>String(value??'').normalize('NFKC').trim();
const ORGS=new Set(['HEADQUARTERS','SUBSIDIARY']);

function commandAbsence(capsule){
  const out={};
  for(const key of ['install','test','build']){
    if(capsule.commands?.[key]==null){
      const reason=clean(capsule.commands?.absent_reason?.[key]);
      if(reason) out[key]=reason;
    }
  }
  return out;
}

function normalizeList(values,code){
  need(Array.isArray(values??[]),code);
  return [...new Set((values??[]).map(clean).filter(Boolean))];
}

export function buildProjectRegistryCandidate({capsule,profile,existingProject=null}={}){
  need(capsule?.schema==='ai-core-project-capsule/v1','PROJECT_CAPSULE_REQUIRED');
  need(profile&&typeof profile==='object'&&!Array.isArray(profile),'PROJECT_PROFILE_REQUIRED');
  need(capsule.readiness?.review_required===true,'PROJECT_CAPSULE_REVIEW_FLAG_REQUIRED');

  const name=clean(profile.name);
  const mission=clean(profile.mission);
  const organization=clean(profile.organization);
  need(nonempty(name),'PROJECT_NAME_REQUIRED');
  need(nonempty(mission),'PROJECT_MISSION_REQUIRED');
  need(ORGS.has(organization),'PROJECT_ORGANIZATION_INVALID');

  const profileProjectId=clean(profile.project_id)||capsule.project_id;
  need(profileProjectId===capsule.project_id,'PROJECT_ID_PROFILE_MISMATCH');
  const profileRepository=clean(profile.repository)||capsule.repository;
  need(profileRepository===capsule.repository,'PROJECT_REPOSITORY_PROFILE_MISMATCH');

  const localPath=profile.local_path===null?null:clean(profile.local_path)||null;
  const requiredApprovals=normalizeList(profile.required_approvals,'PROJECT_APPROVALS_INVALID');
  const declaredBlockers=normalizeList(profile.known_blockers,'PROJECT_BLOCKERS_INVALID');
  const capsuleBlockers=normalizeList(capsule.readiness?.blockers,'PROJECT_CAPSULE_BLOCKERS_INVALID');

  const candidate={
    project_id:capsule.project_id,
    name,
    organization,
    repository_lifecycle_status:'HOLD',
    execution_readiness_status:'HOLD',
    mission,
    repository:capsule.repository,
    default_branch:capsule.default_branch,
    local_path:localPath,
    head_revision:capsule.subject_revision,
    authoritative_sources:[{
      kind:'GIT',
      ref:capsule.repository,
      revision:capsule.subject_revision,
      observed_at:capsule.observed_at,
    }],
    commands:{
      install:capsule.commands?.install??null,
      test:capsule.commands?.test??null,
      build:capsule.commands?.build??null,
    },
    deploy_targets:[...(capsule.delivery?.targets??[])],
    required_approvals:requiredApprovals,
    known_blockers:[...new Set([
      ...capsuleBlockers.map(code=>`CAPSULE:${code}`),
      ...declaredBlockers,
      'REGISTRY_REVIEW_REQUIRED',
    ])],
  };

  const absent=commandAbsence(capsule);
  if(Object.keys(absent).length) candidate.commands_absent_reason=absent;

  const review={
    capsule_readiness:capsule.readiness.status,
    requested_repository_lifecycle_status:clean(profile.requested_repository_lifecycle_status)||null,
    requested_execution_readiness_status:clean(profile.requested_execution_readiness_status)||null,
    effective_repository_lifecycle_status:'HOLD',
    effective_execution_readiness_status:'HOLD',
    activation_allowed:false,
    reasons:[
      'Registry candidate generation never grants repository authority or ACTIVE execution readiness.',
      ...(capsule.readiness.status==='READY_FOR_REGISTRY_REVIEW'?[]:['Capsule is not ready for registry review.']),
      'Mission, organization, approvals, local path and blockers are human/project-owned declarations.',
    ],
  };

  let change='CREATE';
  if(existingProject){
    need(existingProject.project_id===candidate.project_id,'EXISTING_PROJECT_ID_MISMATCH');
    need(existingProject.repository===candidate.repository,'EXISTING_PROJECT_REPOSITORY_MISMATCH');
    change='UPDATE_REVIEW';
    review.existing_repository_lifecycle_status=existingProject.repository_lifecycle_status??null;
    review.existing_execution_readiness_status=existingProject.execution_readiness_status??null;
    review.existing_revision=existingProject.head_revision??null;
  }

  return {
    schema:'ai-core-project-registry-candidate/v1.1',
    change,
    candidate,
    review,
    evidence_refs:[...(capsule.evidence_refs??[])],
  };
}

export async function aiCoreProjectRegistryCandidate(input={}){
  try{
    const result=buildProjectRegistryCandidate(input);
    const blocked=result.review.capsule_readiness!=='READY_FOR_REGISTRY_REVIEW';
    return {
      status:blocked?'HOLD':'SUCCEEDED',
      summary:blocked
        ?'프로젝트 Capsule에 blocker가 남아 있어 Registry 후보를 HOLD/HOLD 상태로 만들었습니다.'
        :'프로젝트 Registry 검토 후보를 만들었습니다. 자동 등록·권위부여·활성화는 하지 않았습니다.',
      data:result,
      evidence:[...result.evidence_refs],
      artifacts:[],
      checks:[
        {name:'project-registry.capsule-readiness',status:blocked?'FAIL':'PASS',detail:result.review.capsule_readiness},
        {name:'project-registry.activation-boundary',status:'PASS',detail:'lifecycle=HOLD; execution=HOLD; activation_allowed=false'},
      ],
      blockers:blocked?['PROJECT_CAPSULE_NOT_READY']:[],
      next_action:'후보의 mission·조직·승인경계·blocker·lifecycle·execution readiness와 exact revision을 검토한 뒤 Registry 변경을 별도 승인합니다.',
      external_effect:false,
    };
  }catch(error){
    return {
      status:'HOLD',
      summary:'Project Registry 후보 입력 계약을 만족하지 못했습니다.',
      data:null,
      evidence:[],
      artifacts:[],
      checks:[{name:'project-registry.candidate',status:'FAIL',detail:error?.message??'PROJECT_REGISTRY_CANDIDATE_INVALID'}],
      blockers:[error?.message??'PROJECT_REGISTRY_CANDIDATE_INVALID'],
      next_action:'Project Capsule과 사람이 선언해야 하는 project profile을 분리해 입력합니다.',
      external_effect:false,
    };
  }
}
