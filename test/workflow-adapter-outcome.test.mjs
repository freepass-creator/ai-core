import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowEngine } from '../src/workflow/engine.mjs';

function workflow(){
  return {
    workflow_id:'test.adapter-outcome',version:'1.0.0',adoption_status:'CANONICAL',owner:'test',description:'fixture',
    state_axes:[{axis_id:'lifecycle',initial_state:'READY',states:[
      {state_id:'READY',kind:'NORMAL',terminal:false},{state_id:'DONE',kind:'FINAL',terminal:true},{state_id:'HOLD',kind:'HOLD',terminal:false}
    ]}],
    facts:[],guards:[],evidence_requirements:[],
    commands:[{command_id:'execute',intent:'execute',idempotency_required:false}],
    events:[{event_type:'test.executed',meaning:'executed'}],
    transitions:[{
      transition_id:'execute',purpose:'NORMAL',axis_id:'lifecycle',from:['READY'],to:'DONE',
      command_id:'execute',event_type:'test.executed',guards:[],required_evidence:[],permissions:[],
      approval:{policy:'NONE',required_roles:[],separation_of_duties:false},effects:[],
      failure:{on_exhausted:'HOLD',failure_state:'HOLD'},
      retry:{strategy:'FIXED',max_attempts:3,base_delay_ms:1000,retryable_error_codes:['UPSTREAM_UNAVAILABLE']},
      automation:{mode:'MANUAL',trigger_event_types:[]},
      manual_override:{allowed:false,permissions:[],can_bypass:[],requires_reason:true},
      audit:{required:true,reason_required:false},reversible:false
    }],
    obligations:[]
  };
}

const result=(overrides={})=>({
  schema_version:'core-adapter-result/v1',adapter_id:'adapter.test',adapter_version:'1.0.0',
  correlation_id:'corr-1',status:'FAILED',retryable:true,data:null,
  issues:[{code:'UPSTREAM_UNAVAILABLE',severity:'ERROR'}],evidence_refs:[],
  started_at:'2026-09-20T00:00:00Z',ended_at:'2026-09-20T00:00:01Z',
  ...overrides
});

test('retryable adapter failure uses existing D retry policy',()=>{
  const engine=createWorkflowEngine(workflow());
  const decision=engine.resolveAdapterOutcome({transition_id:'execute',attempt:1,adapter_result:result()});
  assert.equal(decision.action,'RETRY');
  assert.equal(decision.next_attempt,2);
  assert.equal(decision.retry_after_ms,1000);
  assert.equal(decision.adapter_id,'adapter.test');
});

test('adapter retryable=false suppresses retry even when transition lists the code',()=>{
  const engine=createWorkflowEngine(workflow());
  const decision=engine.resolveAdapterOutcome({transition_id:'execute',attempt:1,adapter_result:result({retryable:false})});
  assert.equal(decision.action,'HOLD');
  assert.equal(decision.failure_state,'HOLD');
});

test('adapter HOLD remains HOLD and is never converted into retry',()=>{
  const engine=createWorkflowEngine(workflow());
  const decision=engine.resolveAdapterOutcome({
    transition_id:'execute',attempt:1,
    adapter_result:result({status:'HOLD',retryable:true,issues:[{code:'PROVIDER_REVIEW_REQUIRED',severity:'BLOCKING'}]})
  });
  assert.equal(decision.action,'HOLD');
  assert.equal(decision.reason,'ADAPTER_REQUESTED_HOLD');
  assert.equal(decision.retryable,false);
});

test('adapter success continues without inventing a workflow transition',()=>{
  const engine=createWorkflowEngine(workflow());
  const decision=engine.resolveAdapterOutcome({transition_id:'execute',attempt:1,adapter_result:result({status:'SUCCEEDED',retryable:false,issues:[]})});
  assert.equal(decision.action,'CONTINUE');
  assert.equal(decision.error_code,null);
});

test('retry exhaustion delegates to the transition failure contract',()=>{
  const engine=createWorkflowEngine(workflow());
  const decision=engine.resolveAdapterOutcome({transition_id:'execute',attempt:3,adapter_result:result()});
  assert.equal(decision.action,'HOLD');
  assert.equal(decision.failure_state,'HOLD');
});
