const ACTOR_PREFIXES = [
  'gpt/','claude/','codex/','cursor/','gemini/',
  'work/gpt/','work/claude/','work/codex/','work/cursor/','work/gemini/'
];

export function profilePolicy(policy, profile='STANDARD') {
  const selected=policy?.profiles?.[profile];
  if(!selected) throw new Error('CONTINUITY_PROFILE_UNKNOWN');
  return selected;
}

export function analyzeBranchInventory({branches=[], policy, profile='STANDARD', nowMs=Date.now()}={}) {
  const p=profilePolicy(policy, profile);
  const targetHours=policy?.branch_age_hours?.target ?? 24;
  const warnHours=policy?.branch_age_hours?.warn ?? 48;
  const criticalHours=policy?.branch_age_hours?.critical ?? 72;
  const recentProxyHours=policy?.audit_rules?.recent_unique_branch_proxy_hours ?? criticalHours;

  const normalized=branches
    .filter(b=>b && b.name && b.name!=='main')
    .map(b=>{
      const ageHours=Number.isFinite(b.age_hours)
        ? b.age_hours
        : Number.isFinite(b.commit_time_ms) ? Math.max(0,(nowMs-b.commit_time_ms)/3600000) : null;
      const ahead=Number.isInteger(b.ahead)?b.ahead:null;
      const behind=Number.isInteger(b.behind)?b.behind:null;
      const unique=ahead!==null ? ahead>0 : null;
      return {
        ...b, ahead, behind, age_hours:ageHours, unique,
        actor_prefixed:ACTOR_PREFIXES.some(prefix=>b.name.startsWith(prefix)),
      };
    });

  const knownUnique=normalized.filter(b=>b.unique===true);
  const mergedEquivalent=normalized.filter(b=>b.unique===false);
  const recentUnique=knownUnique.filter(b=>b.age_hours!==null && b.age_hours<=recentProxyHours);
  const staleUnique=knownUnique.filter(b=>b.age_hours!==null && b.age_hours>criticalHours);
  const actorPrefixedUnique=knownUnique.filter(b=>b.actor_prefixed);

  const ages=knownUnique.map(b=>b.age_hours).filter(Number.isFinite).sort((a,b)=>a-b);
  const percentile=q=>ages.length ? ages[Math.min(ages.length-1,Math.floor((ages.length-1)*q))] : null;

  const findings=[];
  if(recentUnique.length>p.hard_max_active_work_branches){
    findings.push({severity:'CRITICAL',code:'ACTIVE_BRANCH_BUDGET_EXCEEDED',actual:recentUnique.length,limit:p.hard_max_active_work_branches});
  } else if(recentUnique.length>p.target_active_work_branches){
    findings.push({severity:'WARN',code:'ACTIVE_BRANCH_TARGET_EXCEEDED',actual:recentUnique.length,target:p.target_active_work_branches});
  }
  if(staleUnique.length){
    findings.push({severity:staleUnique.length>=3?'CRITICAL':'WARN',code:'STALE_UNIQUE_BRANCHES',count:staleUnique.length});
  }
  if(mergedEquivalent.length){
    findings.push({severity:mergedEquivalent.length>=10?'CRITICAL':'WARN',code:'MERGED_BRANCH_CLEANUP_DEBT',count:mergedEquivalent.length});
  }
  if(actorPrefixedUnique.length){
    findings.push({severity:'WARN',code:'ACTOR_OWNED_UNIQUE_BRANCHES',count:actorPrefixedUnique.length});
  }
  if(knownUnique.some(b=>b.age_hours!==null && b.age_hours>warnHours && b.age_hours<=criticalHours)){
    findings.push({severity:'WARN',code:'BRANCH_LIFETIME_WARNING'});
  }

  const rank={PASS:0,WARN:1,CRITICAL:2};
  let status='PASS';
  for(const f of findings){
    const candidate=f.severity==='CRITICAL'?'CRITICAL':'WARN';
    if(rank[candidate]>rank[status]) status=candidate;
  }

  return {
    schema:'ai-core-development-continuity-audit/v1',
    profile,
    status,
    policy:{
      target_active_work_branches:p.target_active_work_branches,
      hard_max_active_work_branches:p.hard_max_active_work_branches,
      target_branch_lifetime_hours:targetHours,
      critical_branch_lifetime_hours:criticalHours,
    },
    metrics:{
      observed_non_main_branches:normalized.length,
      unique_ahead_branches:knownUnique.length,
      recent_unique_branch_proxy:recentUnique.length,
      merged_equivalent_branches:mergedEquivalent.length,
      stale_unique_branches:staleUnique.length,
      actor_prefixed_unique_branches:actorPrefixedUnique.length,
      unique_branch_age_p50_hours:percentile(.5),
      unique_branch_age_p90_hours:percentile(.9),
      unique_branch_age_max_hours:ages.length?ages[ages.length-1]:null,
    },
    findings,
    samples:{
      recent_unique:recentUnique.slice(0,20).map(b=>b.name),
      stale_unique:staleUnique.slice(0,20).map(b=>b.name),
      merged_equivalent:mergedEquivalent.slice(0,20).map(b=>b.name),
      actor_prefixed_unique:actorPrefixedUnique.slice(0,20).map(b=>b.name),
    }
  };
}
