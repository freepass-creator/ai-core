import test from 'node:test';
import assert from 'node:assert/strict';
import { inferDomain, questionGate, prioritizeQuestions, humanOrchestrationPlan } from '../src/human-orchestrator.mjs';

test('legal intent selects legal domain',()=>{assert.equal(inferDomain('소송 대응 준비하자'),'legal');});
test('travel intent selects travel domain',()=>{assert.equal(inferDomain('가족 여행 일정 짜줘'),'travel');});
test('known question is not asked again',()=>{assert.equal(questionGate({already_known:true,decision_impact:5,irreversibility:5,uncertainty:5}).ask,false);});
test('sourceable factual question is resolved before asking user',()=>{const q=questionGate({externally_resolvable:true,user_preference_required:false,decision_impact:5,irreversibility:3,uncertainty:5});assert.equal(q.ask,false);assert.equal(q.reason,'RESOLVE_WITH_SOURCE_FIRST');});
test('user preference question is asked',()=>{assert.equal(questionGate({user_preference_required:true,changes_decision:true,decision_impact:4,irreversibility:2,uncertainty:5,user_effort:1}).ask,true);});
test('low decision value question is suppressed',()=>{assert.equal(questionGate({changes_decision:false,decision_impact:1,irreversibility:1,uncertainty:1,user_effort:1}).ask,false);});
test('highest value questions are asked first',()=>{const q=prioritizeQuestions([{id:'low',decision_impact:1,irreversibility:1,uncertainty:1},{id:'high',decision_impact:5,irreversibility:5,uncertainty:5}],1);assert.equal(q[0].id,'high');});
test('artifact request becomes proactive prepare',()=>{const p=humanOrchestrationPlan({goal:'보고서 만들어',artifact_requested:true},[]);assert.equal(p.proactivity,'P2_PREPARE');});
test('monitor request becomes monitor level',()=>{const p=humanOrchestrationPlan({goal:'계속 상황 봐줘',monitor_requested:true},[]);assert.equal(p.proactivity,'P4_MONITOR');});
test('legal checklist includes fact evidence separation and official freshness',()=>{const p=humanOrchestrationPlan({goal:'법률 분쟁 대응'},[]);assert.ok(p.domain_checklist.includes('fact_claim_evidence_separation'));assert.ok(p.domain_checklist.includes('official_law_freshness'));});
test('travel checklist includes booking and contingency',()=>{const p=humanOrchestrationPlan({goal:'여행 준비'},[]);assert.ok(p.domain_checklist.includes('booking_dependencies'));assert.ok(p.domain_checklist.includes('contingency'));});
test('orchestrator never grants external authority',()=>{const p=humanOrchestrationPlan({goal:'무언가 해줘',execution_requested:true},[]);assert.equal(p.authorization,'NOT_GRANTED');});
