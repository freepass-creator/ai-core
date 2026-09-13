import test from 'node:test';
import assert from 'node:assert/strict';
import { baselineRoute, precisionSpeedPlan, qualityTier, taskSignature, learnRoutingPolicy, validateOutcomeRecord } from '../src/precision-speed-controller.mjs';

const task={goal:'ERP UI 수정',domain:'development',risk:'A',changed_files_estimate:2,cloud_reproducible:true};
const sig=taskSignature(task);
const rec=(route,overrides={})=>({task_signature:sig,route,subject_revision:'abc',verification_status:'VERIFIED',elapsed_seconds:100,rework_count:1,context_items_loaded:10,first_pass_success:true,false_pass:false,regression:false,...overrides});

test('small bounded task stays GPT_DIRECT by baseline',()=>{assert.equal(baselineRoute(task),'GPT_DIRECT');});
test('build or runtime work routes WORK_CODEX',()=>{assert.equal(baselineRoute({...task,needs_build:true}),'WORK_CODEX');});
test('external authority-sensitive action is HUMAN_GATE',()=>{assert.equal(baselineRoute({...task,risk:'D',external_effect:'production_data'}),'HUMAN_GATE');});
test('critical tier requires stronger verification',()=>{const p=precisionSpeedPlan({...task,risk:'C'},[]);assert.equal(p.quality.tier,'CRITICAL');assert.ok(p.quality.checks.includes('independent_review'));});
test('outcome record missing evidence is invalid',()=>{assert.equal(validateOutcomeRecord({route:'GPT_DIRECT'}).valid,false);});
test('insufficient history never changes route',()=>{const h=[rec('GPT_DIRECT'),rec('WORK_CODEX')];assert.equal(learnRoutingPolicy(task,h).status,'INSUFFICIENT_EVIDENCE');});
test('equally accurate faster route becomes shadow candidate only',()=>{
 const h=[];
 for(let i=0;i<5;i++) h.push(rec('GPT_DIRECT',{elapsed_seconds:120,rework_count:1,context_items_loaded:10}));
 for(let i=0;i<5;i++) h.push(rec('WORK_CODEX',{elapsed_seconds:70,rework_count:0,context_items_loaded:7}));
 const out=learnRoutingPolicy(task,h);
 assert.equal(out.status,'SHADOW_CANDIDATE');
 assert.equal(out.candidate_route,'WORK_CODEX');
 assert.equal(out.auto_adopt,false);
 assert.equal(out.authorization,'NOT_GRANTED');
});
test('any false pass disqualifies alternate route',()=>{
 const h=[];
 for(let i=0;i<5;i++) h.push(rec('GPT_DIRECT',{elapsed_seconds:120}));
 for(let i=0;i<5;i++) h.push(rec('WORK_CODEX',{elapsed_seconds:50,false_pass:i===0}));
 assert.equal(learnRoutingPolicy(task,h).status,'KEEP_CURRENT');
});
test('worse verified rate is not traded for speed',()=>{
 const h=[];
 for(let i=0;i<5;i++) h.push(rec('GPT_DIRECT',{elapsed_seconds:120}));
 for(let i=0;i<5;i++) h.push(rec('WORK_CODEX',{elapsed_seconds:40,verification_status:i===0?'FAILED':'VERIFIED'}));
 assert.equal(learnRoutingPolicy(task,h).status,'KEEP_CURRENT');
});
test('history from other task signature is ignored',()=>{
 const h=[];
 for(let i=0;i<8;i++) h.push({...rec('WORK_CODEX',{elapsed_seconds:20}),task_signature:'other|signature'});
 assert.equal(learnRoutingPolicy(task,h).status,'INSUFFICIENT_EVIDENCE');
});
test('hard invariants use zero tolerance',()=>{const p=precisionSpeedPlan(task,[]);assert.equal(p.hard_invariants.false_pass_tolerance,0);assert.equal(p.uncertainty_policy,'FAIL_CLOSED_OR_ESCALATE');});
