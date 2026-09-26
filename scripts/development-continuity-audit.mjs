import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeBranchInventory, selectRetirableBranches } from '../src/development/continuity-audit.mjs';

const coreRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2);
const take=name=>{const i=argv.indexOf(name);return i>=0?argv[i+1]:null;};
const root=resolve(take('--root')??process.cwd());
const profile=take('--profile')??'STANDARD';
const gate=argv.includes('--gate');
const refresh=argv.includes('--fetch');
const cleanupContained=argv.includes('--cleanup-contained');
const minAgeRaw=take('--min-age-hours');
const minAgeHours=minAgeRaw===null?24:Number(minAgeRaw);
if(!Number.isFinite(minAgeHours) || minAgeHours<0) throw new Error('CONTINUITY_CLEANUP_MIN_AGE_INVALID');

const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();

if(refresh){
  git(['fetch','origin','+refs/heads/*:refs/remotes/origin/*','--prune']);
}

const policy=JSON.parse(await readFile(resolve(coreRoot,'registry/development-continuity-policy.json'),'utf8'));
const mainRef=(()=>{try{return git(['rev-parse','refs/remotes/origin/main']);}catch{return git(['rev-parse','main']);}})();
const refs=git(['for-each-ref','--format=%(refname:short)|%(objectname)|%(committerdate:unix)','refs/remotes/origin'])
  .split(/\r?\n/).filter(Boolean);

const nowMs=Date.now();
const branches=[];
for(const line of refs){
  const [short,sha,unix]=line.split('|');
  if(short==='origin/HEAD') continue;
  const name=short.replace(/^origin\//,'');
  if(name==='main') continue;
  let ahead=null,behind=null;
  try{
    const counts=git(['rev-list','--left-right','--count',`${mainRef}...${sha}`]).split(/\s+/).map(Number);
    behind=counts[0]; ahead=counts[1];
  }catch{}
  branches.push({name,sha,ahead,behind,commit_time_ms:Number(unix)*1000,age_hours:(nowMs-Number(unix)*1000)/3600000});
}

const report=analyzeBranchInventory({branches,policy,profile,nowMs});
report.repository=(()=>{try{return git(['remote','get-url','origin']);}catch{return null;}})();
report.main_revision=mainRef;
report.observed_at=new Date(nowMs).toISOString();

const cleanup={
  requested:cleanupContained,
  min_age_hours:minAgeHours,
  candidates:[],
  deleted:[],
  failed:[]
};

if(cleanupContained){
  const candidates=selectRetirableBranches({branches,minAgeHours,nowMs});
  cleanup.candidates=candidates.map(b=>b.name);

  for(const branch of candidates){
    try{
      git(['push','origin','--delete',branch.name]);
      cleanup.deleted.push(branch.name);
    }catch(error){
      const detail=String(error?.stderr ?? error?.message ?? error).slice(0,500);
      cleanup.failed.push({branch:branch.name,error:detail});
    }
  }
}

report.cleanup=cleanup;
report.metrics.merged_equivalent_after_cleanup_estimate=
  Math.max(0,report.metrics.merged_equivalent_branches-cleanup.deleted.length);

console.log(JSON.stringify(report,null,2));

if(cleanup.failed.length) process.exitCode=4;
else if(gate && report.status==='CRITICAL') process.exitCode=3;
