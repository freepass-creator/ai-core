import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEvolution, learningDestination, compareCost } from '../src/evolution-gate.mjs';

const base={candidate_id:'E1',origin:'ai-core',origin_actor:'chat',before_failure:'same context repeated',mechanism:'handoff packet',prediction:'less repeated context',scope:'LOCAL',limits:['billing not measured'],learning_type:'handoff'};

test('design is not falsely promoted',()=>{const out=evaluateEvolution(base);assert.equal(out.state,'DESIGN');assert.equal(out.adoption,'ADOPTABLE_LOCAL');assert.equal(out.authorization,'NOT_GRANTED');});

test('synthetic execution becomes locally tested only',()=>{const out=evaluateEvolution({...base,evidence:[{kind:'synthetic_test',executed:true,revision:'abc'}]});assert.equal(out.state,'LOCALLY_TESTED');});

test('universal claim is held without transfer evidence',()=>{const out=evaluateEvolution({...base,scope:'UNIVERSAL'});assert.equal(out.adoption,'HOLD');assert.ok(out.holds.includes('NO_OUTSIDE_ORIGIN_SUCCESS'));});

test('independent verifier must differ from origin actor',()=>{const out=evaluateEvolution({...base,evidence:[{kind:'independent_verification',executed:true,revision:'a',actor:'chat'}]});assert.equal(out.state,'DESIGN');});

test('full evidence can make universal adoptable',()=>{const out=evaluateEvolution({...base,scope:'UNIVERSAL',evidence:[{kind:'synthetic_test',executed:true,revision:'a'},{kind:'independent_verification',executed:true,revision:'a',actor:'work'},{kind:'shadow_pilot',executed:true,revision:'b'}],outcomes:[{observed:true,measurement_window_complete:true,source_revision:'b'}],transfer:{positive_conditions:['revision-bound workflow'],negative_conditions:['open-ended ideation'],outside_origin_successes:1}});assert.equal(out.state,'OUTCOME_VERIFIED');assert.equal(out.adoption,'ADOPTABLE_UNIVERSAL');});

test('learning is routed by type',()=>{assert.equal(learningDestination({...base,learning_type:'handoff'}),'AI_CORE_CANDIDATE');});

test('cost comparison does not invent missing values',()=>{const out=compareCost({rework_count:3},{rework_count:1});assert.equal(out.rework_count.delta,-2);assert.equal(out.elapsed_seconds.delta,null);});
