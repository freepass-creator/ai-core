import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { claimRemote, finishRemote, evaluateClaim, readRemoteRegistry } from './a-session-claim.mjs';
import { reapRemote } from './a-session-claim-health.mjs';

const run=promisify(execFile);
const SESSIONS=['B','C','D'];
const DEFAULT_COORD_REPO=process.env.AI_CORE_COORDINATION_REPOSITORY || 'freepass-creator/ai-core';
const DEFAULT_BRANCH=process.env.AI_CORE_COORDINATION_BRANCH || 'main';
const POLICY_PATH='docs/research/a-session-review-allocation-policy.v1.json';
const queuePath=(s)=>`docs/research/a-session-review-queue-${s}.v1.json`;

async function ghApi(args){
  return (await run('gh',['api',...args],{encoding:'utf8',maxBuffer:32*1024*1024})).stdout;
}
async function readRemoteJson(repo,path,branch){
  const raw=JSON.parse(await ghApi([`repos/${repo}/contents/${path}`,'-X','GET','-f',`ref=${branch}`]));
  return JSON.parse(Buffer.from(raw.content.replace(/\n/g,''),'base64').toString('utf8'));
}

export function scoreReviewItem(item,policy){
  const w=policy.weights;
  const migration=item.evidence_bundle?.migration;
  const components={
    classification:w.classification[item.classification] ?? 0,
    evidence_level:w.evidence_level[item.evidence_level] ?? 0,
    route_priority:w.route_priority[item.route_priority ?? 'NONE'] ?? 0,
    breaking_impact:(migration?.breaking_impact?.length ?? 0) * w.breaking_impact_each,
    verification_need:(migration?.verification_needs?.length ?? 0) * w.verification_need_each
  };
  return { score:Object.values(components).reduce((a,b)=>a+b,0), components };
}

export function reviewClaimRequest(item,owner){
  if(!/^[0-9a-f]{40}$/.test(item.review_revision ?? '')) throw new Error('REVIEW_REVISION_INVALID');
  return {
    repository:'freepass-creator/ai-core',
    revision:item.review_revision,
    scope:`review/${item.route_id}`,
    owner
  };
}

export function rankReviewItems(queues,policy,{session='ANY'}={}){
  if(session!=='ANY' && !SESSIONS.includes(session)) throw new Error('SESSION_INVALID');
  const items=[];
  for(const s of SESSIONS){
    if(session!=='ANY' && s!==session) continue;
    for(const item of queues[s]?.items ?? []){
      if(item.queue_status!==policy.candidate_status) continue;
      const scored=scoreReviewItem(item,policy);
      items.push({...item,allocation_score:scored.score,allocation_components:scored.components});
    }
  }
  items.sort((a,b)=>{
    if(b.allocation_score!==a.allocation_score) return b.allocation_score-a.allocation_score;
    const aAck=Date.parse(a.receiver_snapshot?.acknowledgement?.observed_at ?? '9999-12-31T23:59:59Z');
    const bAck=Date.parse(b.receiver_snapshot?.acknowledgement?.observed_at ?? '9999-12-31T23:59:59Z');
    if(aAck!==bAck) return aAck-bAck;
    return a.route_id.localeCompare(b.route_id);
  });
  return items;
}

export function availableReviewItems(ranked,claims,now=new Date()){
  return ranked.filter((item)=>evaluateClaim(claims,reviewClaimRequest(item,'availability-check'),now).action==='ACQUIRE');
}

export function validateReviewAllocatorState(queues,policy){
  const errors=[];
  if(policy?.schema!=='ai-core-a-session-review-allocation-policy/v1') errors.push('POLICY_SCHEMA_INVALID');
  if(policy?.status!=='RESEARCH_REVIEW_ALLOCATION_NOT_CANONICAL') errors.push('POLICY_BOUNDARY_INVALID');
  const seen=new Set();
  for(const s of SESSIONS){
    if(queues[s]?.session!==s) errors.push(`QUEUE_SESSION_INVALID:${s}`);
    for(const item of queues[s]?.items ?? []){
      if(seen.has(item.route_id)) errors.push(`ROUTE_DUPLICATE:${item.route_id}`);
      seen.add(item.route_id);
      if(item.target_session!==s) errors.push(`TARGET_SESSION_MISMATCH:${item.route_id}`);
      if(!/^[0-9a-f]{40}$/.test(item.review_revision ?? '')) errors.push(`REVIEW_REVISION_INVALID:${item.route_id}`);
      if(item.authority?.automatic_decision_forbidden!==true) errors.push(`AUTO_DECISION_BOUNDARY_INVALID:${item.route_id}`);
      const scored=scoreReviewItem(item,policy);
      if(!Number.isFinite(scored.score)) errors.push(`SCORE_INVALID:${item.route_id}`);
    }
  }
  return {status:errors.length?'INVALID':'VALID',errors,ready_count:rankReviewItems(queues,policy).length};
}

export async function allocateReviewNext({
  session='ANY',owner,leaseMinutes=60,coordRepo=DEFAULT_COORD_REPO,branch=DEFAULT_BRANCH,dryRun=false
}={}){
  if(!owner) throw new Error('OWNER_REQUIRED');
  if(session!=='ANY' && !SESSIONS.includes(session)) throw new Error('SESSION_INVALID');

  const policy=await readRemoteJson(coordRepo,POLICY_PATH,branch);
  const queues={};
  for(const s of SESSIONS) queues[s]=await readRemoteJson(coordRepo,queuePath(s),branch);
  const ranked=rankReviewItems(queues,policy,{session});

  const claims=(await readRemoteRegistry(coordRepo,branch)).registry;
  const available=availableReviewItems(ranked,claims,new Date());
  if(dryRun){
    return {
      status:'DRY_RUN',
      session,
      ready_count:ranked.length,
      available_count:available.length,
      ranking:available.map((x)=>({
        route_id:x.route_id,target_session:x.target_session,score:x.allocation_score,
        components:x.allocation_components,review_revision:x.review_revision
      }))
    };
  }

  await reapRemote({coordRepo,branch});

  for(const candidate of ranked){
    const request=reviewClaimRequest(candidate,owner);
    const result=await claimRemote(request,{leaseMinutes,coordRepo,branch});
    if(result.action==='SKIP_DUPLICATE' || result.action==='SKIP_ALREADY_COMPLETED') continue;
    if(result.action!=='ACQUIRED') continue;

    const refreshed=await readRemoteJson(coordRepo,queuePath(candidate.target_session),branch);
    const current=refreshed.items.find((x)=>x.route_id===candidate.route_id);
    if(!current || current.queue_status!==policy.candidate_status || current.review_revision!==candidate.review_revision){
      await finishRemote(result.claim.claim_id,'SUPERSEDED',{coordRepo,branch});
      continue;
    }

    return {
      status:'ASSIGNED',
      session:candidate.target_session,
      route_id:candidate.route_id,
      finding_id:candidate.finding_id,
      classification:candidate.classification,
      evidence_level:candidate.evidence_level,
      review_revision:candidate.review_revision,
      score:candidate.allocation_score,
      score_components:candidate.allocation_components,
      review_questions:candidate.review_questions,
      claim:result.claim,
      coordination_commit:result.commit_sha ?? null
    };
  }

  return {
    status:ranked.length?'NO_UNCLAIMED_REVIEW_ITEM':'NO_READY_REVIEW_ITEM',
    session,
    ready_count:ranked.length
  };
}

function value(args,name){const i=args.indexOf(name);return i<0?null:(args[i+1]??null);}

if(process.argv[1]?.endsWith('a-session-review-next.mjs')){
  const args=process.argv.slice(2);
  const localCheck=args.includes('--local-check');
  try{
    if(localCheck){
      const {readFile}=await import('node:fs/promises');
      const policy=JSON.parse(await readFile(POLICY_PATH,'utf8'));
      const queues={};
      for(const s of SESSIONS) queues[s]=JSON.parse(await readFile(queuePath(s),'utf8'));
      const result=validateReviewAllocatorState(queues,policy);
      console.log(JSON.stringify(result,null,2));
      if(result.status!=='VALID') process.exitCode=1;
    }else{
      const result=await allocateReviewNext({
        session:value(args,'--session') || 'ANY',
        owner:value(args,'--owner') || process.env.AI_CORE_ACTOR || 'A_REVIEW',
        leaseMinutes:Number(value(args,'--lease-minutes') || 60),
        coordRepo:value(args,'--coord-repo') || DEFAULT_COORD_REPO,
        branch:value(args,'--branch') || DEFAULT_BRANCH,
        dryRun:args.includes('--dry-run')
      });
      console.log(JSON.stringify(result,null,2));
      if(result.status==='NO_UNCLAIMED_REVIEW_ITEM') process.exitCode=3;
    }
  }catch(error){
    console.error(`A review allocator error: ${error.message}`);
    process.exit(1);
  }
}
