import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBranchInventory, selectRetirableBranches } from '../src/development/continuity-audit.mjs';

const policy={
  profiles:{
    SIMPLE:{target_active_work_branches:1,hard_max_active_work_branches:2},
    STANDARD:{target_active_work_branches:2,hard_max_active_work_branches:3},
    COMPLEX:{target_active_work_branches:2,hard_max_active_work_branches:3}
  },
  branch_age_hours:{target:24,warn:48,critical:72},
  audit_rules:{recent_unique_branch_proxy_hours:72}
};

test('complex repo stays PASS with two short-lived work branches',()=>{
  const r=analyzeBranchInventory({policy,profile:'COMPLEX',branches:[
    {name:'work/p/DEV-1',ahead:2,behind:0,age_hours:6},
    {name:'work/p/DEV-2',ahead:1,behind:0,age_hours:12}
  ]});
  assert.equal(r.status,'PASS');
  assert.equal(r.metrics.recent_unique_branch_proxy,2);
});

test('more than three recent unique branches is CRITICAL for complex repo',()=>{
  const r=analyzeBranchInventory({policy,profile:'COMPLEX',branches:[
    {name:'work/p/DEV-1',ahead:1,behind:0,age_hours:2},
    {name:'work/p/DEV-2',ahead:1,behind:0,age_hours:3},
    {name:'work/p/DEV-3',ahead:1,behind:0,age_hours:4},
    {name:'work/p/DEV-4',ahead:1,behind:0,age_hours:5}
  ]});
  assert.equal(r.status,'CRITICAL');
  assert(r.findings.some(x=>x.code==='ACTIVE_BRANCH_BUDGET_EXCEEDED'));
});

test('merged branches and actor-owned branches are explicit debt',()=>{
  const r=analyzeBranchInventory({policy,profile:'STANDARD',branches:[
    {name:'gpt/new-ui',ahead:2,behind:1,age_hours:5},
    {name:'old-merged',ahead:0,behind:30,age_hours:200}
  ]});
  assert.equal(r.metrics.actor_prefixed_unique_branches,1);
  assert.equal(r.metrics.merged_equivalent_branches,1);
  assert(r.findings.some(x=>x.code==='ACTOR_OWNED_UNIQUE_BRANCHES'));
  assert(r.findings.some(x=>x.code==='MERGED_BRANCH_CLEANUP_DEBT'));
});

test('stale unique work is never silently treated as healthy',()=>{
  const r=analyzeBranchInventory({policy,profile:'SIMPLE',branches:[
    {name:'work/p/DEV-OLD',ahead:3,behind:40,age_hours:100}
  ]});
  assert.equal(r.metrics.stale_unique_branches,1);
  assert.notEqual(r.status,'PASS');
});

test('cleanup selector returns old contained branches and exact merged PR heads',()=>{
  const selected=selectRetirableBranches({minAgeHours:24,branches:[
    {name:'old-contained',ahead:0,behind:50,age_hours:72},
    {name:'fresh-contained',ahead:0,behind:1,age_hours:2},
    {name:'old-unique',ahead:1,behind:50,age_hours:100},
    {name:'just-merged-squash',ahead:5,behind:12,age_hours:0.1,merged_pr_head_exact:true},
    {name:'moved-after-merge',ahead:6,behind:12,age_hours:100,merged_pr_head_exact:false},
    {name:'main',ahead:0,behind:0,age_hours:1000},
    {name:'protected-contained',ahead:0,behind:50,age_hours:72,protected:true}
  ]});
  assert.deepEqual(selected.map(x=>x.name),['old-contained','just-merged-squash']);
});

test('exact merged PR head is classified as merged-equivalent rather than unique debt',()=>{
  const r=analyzeBranchInventory({policy,profile:'COMPLEX',branches:[
    {name:'work/p/DONE',ahead:9,behind:20,age_hours:1,merged_pr_head_exact:true},
    {name:'work/p/ACTIVE',ahead:2,behind:0,age_hours:1}
  ]});
  assert.equal(r.metrics.merged_pr_head_exact_branches,1);
  assert.equal(r.metrics.merged_equivalent_branches,1);
  assert.equal(r.metrics.unique_ahead_branches,1);
  assert.deepEqual(r.samples.merged_pr_head_exact,['work/p/DONE']);
});

test('cleanup selector rejects an invalid minimum age',()=>{
  assert.throws(()=>selectRetirableBranches({branches:[],minAgeHours:-1}),/CONTINUITY_CLEANUP_MIN_AGE_INVALID/);
});
