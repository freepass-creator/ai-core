import { createHash } from 'node:crypto';

const need=(condition,code)=>{if(!condition) throw new Error(code);};
const clean=value=>String(value??'').normalize('NFKC').trim();
const SHA40=/^[0-9a-f]{40}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const digest=value=>`sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;

function normalizeContract(value){
  need(value&&typeof value==='object'&&!Array.isArray(value),'SHARED_SEMANTIC_CONTRACT_REQUIRED');
  const out={};
  for(const [key,raw] of Object.entries(value)){
    const name=clean(key);
    need(name,'SHARED_SEMANTIC_CONTRACT_KEY_INVALID');
    if(raw&&typeof raw==='object') out[name]=canonical(raw);
    else out[name]=clean(raw);
  }
  need(Object.keys(out).length>0,'SHARED_SEMANTIC_CONTRACT_EMPTY');
  return canonical(out);
}

function normalizeCases(values){
  need(Array.isArray(values)&&values.length>0,'SHARED_BEHAVIOR_CASES_REQUIRED');
  const ids=new Set();
  return values.map(item=>{
    need(item&&typeof item==='object'&&!Array.isArray(item),'SHARED_BEHAVIOR_CASE_INVALID');
    const caseId=clean(item.case_id);
    need(ID.test(caseId),'SHARED_BEHAVIOR_CASE_ID_INVALID');
    need(!ids.has(caseId),'SHARED_BEHAVIOR_CASE_ID_DUPLICATE');
    ids.add(caseId);
    need(Object.prototype.hasOwnProperty.call(item,'input'),'SHARED_BEHAVIOR_CASE_INPUT_REQUIRED');
    const hasOutput=Object.prototype.hasOwnProperty.call(item,'output');
    const hasError=clean(item.error_code);
    need(hasOutput||hasError,'SHARED_BEHAVIOR_CASE_OUTCOME_REQUIRED');
    need(!(hasOutput&&hasError),'SHARED_BEHAVIOR_CASE_OUTCOME_AMBIGUOUS');
    return {
      case_id:caseId,
      input:canonical(item.input),
      ...(hasOutput?{output:canonical(item.output)}:{}),
      ...(hasError?{error_code:hasError}:{}),
    };
  }).sort((a,b)=>a.case_id.localeCompare(b.case_id));
}

function normalizeImplementation(value){
  need(value&&typeof value==='object'&&!Array.isArray(value),'SHARED_IMPLEMENTATION_INVALID');
  const projectId=clean(value.project_id);
  const repository=clean(value.repository);
  const revision=clean(value.revision);
  const sourceRef=clean(value.source_ref);
  const exportName=clean(value.export_name);
  const sourceBlobSha=clean(value.source_blob_sha);
  need(projectId,'SHARED_PROJECT_ID_REQUIRED');
  need(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository),'SHARED_REPOSITORY_INVALID');
  need(SHA40.test(revision),'SHARED_REVISION_INVALID');
  need(sourceRef,'SHARED_SOURCE_REF_REQUIRED');
  need(exportName,'SHARED_EXPORT_NAME_REQUIRED');
  need(SHA40.test(sourceBlobSha),'SHARED_SOURCE_BLOB_SHA_INVALID');
  return {
    project_id:projectId,
    repository,
    revision,
    source_ref:sourceRef,
    source_blob_sha:sourceBlobSha,
    export_name:exportName,
    semantic_contract:normalizeContract(value.semantic_contract),
    behavior_cases:normalizeCases(value.behavior_cases),
    evidence_refs:[...new Set((value.evidence_refs??[]).map(clean).filter(Boolean))],
  };
}

function contractMismatches(implementations){
  const [base,...rest]=implementations;
  const blockers=[];
  const allKeys=[...new Set(implementations.flatMap(x=>Object.keys(x.semantic_contract)))].sort();
  for(const key of allKeys){
    const baseDigest=digest(base.semantic_contract[key]??null);
    if(rest.some(row=>digest(row.semantic_contract[key]??null)!==baseDigest)){
      blockers.push(`CONTRACT_MISMATCH:${key}`);
    }
  }
  return blockers;
}

function behaviorMismatches(implementations){
  const blockers=[];
  const allCaseIds=[...new Set(implementations.flatMap(x=>x.behavior_cases.map(c=>c.case_id)))].sort();
  for(const caseId of allCaseIds){
    const cases=implementations.map(row=>row.behavior_cases.find(c=>c.case_id===caseId)??null);
    if(cases.some(x=>x===null)){
      blockers.push(`BEHAVIOR_CASE_MISSING:${caseId}`);
      continue;
    }
    const inputDigests=cases.map(x=>digest(x.input));
    if(new Set(inputDigests).size!==1){
      blockers.push(`BEHAVIOR_INPUT_MISMATCH:${caseId}`);
      continue;
    }
    const outcomes=cases.map(x=>digest(Object.prototype.hasOwnProperty.call(x,'output')
      ?{output:x.output}
      :{error_code:x.error_code}));
    if(new Set(outcomes).size!==1) blockers.push(`BEHAVIOR_MISMATCH:${caseId}`);
  }
  return blockers;
}

export function compileSharedExtractionCandidate(input={}){
  need(input&&typeof input==='object'&&!Array.isArray(input),'SHARED_EXTRACTION_INPUT_INVALID');
  const candidateId=clean(input.candidate_id);
  const capabilityKey=clean(input.capability_key);
  const targetPackage=clean(input.target_package);
  need(ID.test(candidateId),'SHARED_CANDIDATE_ID_INVALID');
  need(capabilityKey,'SHARED_CAPABILITY_KEY_REQUIRED');
  need(targetPackage,'SHARED_TARGET_PACKAGE_REQUIRED');
  need(Array.isArray(input.implementations)&&input.implementations.length>=2,'SHARED_TWO_IMPLEMENTATIONS_REQUIRED');

  const implementations=input.implementations.map(normalizeImplementation);
  const projectIds=implementations.map(x=>x.project_id);
  need(new Set(projectIds).size>=2,'SHARED_TWO_PROJECTS_REQUIRED');

  const identityPairs=new Set();
  for(const item of implementations){
    const key=`${item.project_id}|${item.repository}|${item.source_ref}|${item.export_name}`;
    need(!identityPairs.has(key),'SHARED_IMPLEMENTATION_DUPLICATE');
    identityPairs.add(key);
  }

  const blockers=[
    ...contractMismatches(implementations),
    ...behaviorMismatches(implementations),
  ];

  const missingEvidence=implementations.filter(x=>x.evidence_refs.length===0).map(x=>x.project_id);
  if(missingEvidence.length) blockers.push(...missingEvidence.map(id=>`EVIDENCE_MISSING:${id}`));

  const uniqueBlockers=[...new Set(blockers)].sort();
  const ready=uniqueBlockers.length===0;

  return {
    schema:'ai-core-shared-extraction-candidate/v1',
    candidate_id:candidateId,
    capability_key:capabilityKey,
    target_package:targetPackage,
    source_project_count:new Set(projectIds).size,
    implementation_count:implementations.length,
    implementations:implementations.map(item=>({
      project_id:item.project_id,
      repository:item.repository,
      revision:item.revision,
      source_ref:item.source_ref,
      source_blob_sha:item.source_blob_sha,
      export_name:item.export_name,
      semantic_contract_digest:digest(item.semantic_contract),
      behavior_digest:digest(item.behavior_cases),
      evidence_refs:item.evidence_refs,
    })),
    assessment:{
      status:ready?'READY_FOR_EXTRACTION_REVIEW':'HOLD',
      blockers:uniqueBlockers,
      semantic_contract_equal:!uniqueBlockers.some(x=>x.startsWith('CONTRACT_MISMATCH:')),
      behavior_equal:!uniqueBlockers.some(x=>x.startsWith('BEHAVIOR_')),
      evidence_complete:!uniqueBlockers.some(x=>x.startsWith('EVIDENCE_MISSING:')),
      extraction_allowed:false,
      package_promotion_allowed:false,
      source_authority_transfer:false,
    },
    review:{
      required:true,
      next_action:ready
        ?'독립 검토에서 소비자·버전·rollback 계획을 확인한 뒤 extraction Work Packet을 별도로 만듭니다.'
        :'계약/행동 차이를 먼저 해소하거나 adapter-separable 차이로 명시하기 전에는 공통 추출하지 않습니다.',
    },
  };
}

export async function aiCoreSharedExtractionCandidate(input={}){
  try{
    const candidate=compileSharedExtractionCandidate(input);
    return {
      status:candidate.assessment.status==='HOLD'?'HOLD':'SUCCEEDED',
      summary:candidate.assessment.status==='HOLD'
        ?`공통 추출 후보는 HOLD입니다. 차이/증거 blocker ${candidate.assessment.blockers.length}건이 있습니다.`
        :'공통 추출 후보가 계약·행동 동등성 검토를 통과했습니다. 실제 추출은 아직 허용되지 않습니다.',
      data:candidate,
      evidence:candidate.implementations.flatMap(x=>x.evidence_refs),
      artifacts:[],
      checks:[
        {name:'shared-extraction.semantic-contract',status:candidate.assessment.semantic_contract_equal?'PASS':'FAIL',detail:candidate.assessment.blockers.filter(x=>x.startsWith('CONTRACT_MISMATCH:')).join(',')||'equal'},
        {name:'shared-extraction.behavior',status:candidate.assessment.behavior_equal?'PASS':'FAIL',detail:candidate.assessment.blockers.filter(x=>x.startsWith('BEHAVIOR_')).join(',')||'equal'},
        {name:'shared-extraction.promotion-boundary',status:'PASS',detail:'extraction_allowed=false; package_promotion_allowed=false'},
      ],
      blockers:[...candidate.assessment.blockers],
      next_action:candidate.review.next_action,
      external_effect:false,
    };
  }catch(error){
    return {
      status:'HOLD',
      summary:'공통 추출 후보 입력 계약을 만족하지 못했습니다.',
      data:null,
      evidence:[],
      artifacts:[],
      checks:[{name:'shared-extraction.candidate',status:'FAIL',detail:error?.message??'SHARED_EXTRACTION_CANDIDATE_INVALID'}],
      blockers:[error?.message??'SHARED_EXTRACTION_CANDIDATE_INVALID'],
      next_action:'서로 다른 2개 이상 프로젝트의 exact revision, source ref, semantic contract, behavior cases와 evidence를 제공합니다.',
      external_effect:false,
    };
  }
}
