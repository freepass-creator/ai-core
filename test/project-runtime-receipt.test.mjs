import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createProjectRuntime } from '../src/engine/project-runtime.mjs';

const receipt = {
  kind:'NEW_JSON_TERMINAL_RECEIPT', directory:'tmp/과태료', prefix:'실행기록-', suffix:'.json',
  schema_field:'schema', schema_value:'gwataeryo-run-manifest/v1', state_field:'state',
  success_states:['COMPLETED'], hold_states:['COMPLETED_WITH_HOLD'], failure_states:['FAILED'],
};
const project={project_id:'aiops',status:'ACTIVE',local_path:resolve('/tmp/aiops'),head_revision:'a'.repeat(40)};
const capability={id:'operations.penalty.prepare',title:'과태료 엔진',mode:'EXTERNAL_MUTATION',
  adapter:{kind:'PROJECT_COMMAND',argv:['node','wonja/gwataeryo-engine.mjs','--한다'],receipt}};

test('외부 명령 exit 0도 receipt 없으면 HOLD다', async()=>{
  const runtime=createProjectRuntime({
    readHead:async()=>project.head_revision,
    runProcess:async()=>({stdout:'다 돌았다',stderr:'',exit_code:0}),
    receiptReader:{snapshot:async()=>new Map(),reconcile:async()=>({status:'HOLD',reason:'EXECUTION_RECEIPT_MISSING'})},
  });
  const out=await runtime.runCommand(capability,project);
  assert.equal(out.status,'HOLD');
  assert.ok(out.blockers.includes('EXECUTION_RECEIPT_MISSING'));
});

test('terminal COMPLETED receipt가 있어야 외부 명령 성공이다', async()=>{
  const runtime=createProjectRuntime({
    readHead:async()=>project.head_revision,
    runProcess:async()=>({stdout:'ok',stderr:'',exit_code:0}),
    receiptReader:{snapshot:async()=>new Map(),reconcile:async()=>({status:'SUCCEEDED',state:'COMPLETED',path:'/tmp/receipt.json',receipt:{schema:'gwataeryo-run-manifest/v1',state:'COMPLETED'}})},
  });
  const out=await runtime.runCommand(capability,project);
  assert.equal(out.status,'SUCCEEDED');
  assert.equal(out.data.receipt_state,'COMPLETED');
  assert.equal(out.checks.find(x=>x.name.endsWith('.receipt')).status,'PASS');
});
