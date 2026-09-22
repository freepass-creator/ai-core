import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateIntegrationRequest,finalizeIntegrationReceipt,planConnectorPromotion,validateConnectors,verifyConnectorSources} from '../scripts/integration-hub.mjs';

const connector={
  id:'demo.firestore',
  provider:'Firestore',
  protocol:'SDK',
  status:'CANDIDATE',
  source:{repository:'freepass-creator/demo',revision:'1'.repeat(40),path:'adapter.ts',blob_sha:'2'.repeat(40)},
  direction:'BIDIRECTIONAL',
  execution:{timeout_ms:30000,retry:{max_attempts:3,backoff:'EXPONENTIAL'},idempotency:{required:true,key_ref:'request.id'}},
  auth:{mode:'server',secret_location:'runtime env'},
  health:{probe:'readback',success_receipt:'receipt'},
  recovery:{failure_mode:'FAIL_CLOSED',fallback:null,disable_path:'disable writer'},
  verification:['test']
};
const registry={contract:'devcenter-integration-connectors/v1',connectors:[connector]};

test('connector registry validates timeout retry idempotency auth health recovery',()=>{
  assert.deepEqual(validateConnectors(registry),[]);
});

test('candidate connector cannot be treated as production active',()=>{
  const result=evaluateIntegrationRequest(connector,{idempotency_key:'x',timeout_ms:1000,auth_context_ref:'auth/1'});
  assert.equal(result.status,'HOLD');
  assert.ok(result.blockers.includes('CONNECTOR_CANDIDATE_NOT_PRODUCTION_ACTIVE'));
});

test('idempotency and auth are fail-closed',()=>{
  const active={...connector,status:'ACTIVE'};
  const result=evaluateIntegrationRequest(active,{timeout_ms:1000});
  assert.equal(result.status,'HOLD');
  assert.ok(result.blockers.includes('IDEMPOTENCY_KEY_REQUIRED'));
  assert.ok(result.blockers.includes('AUTH_CONTEXT_REQUIRED'));
});

test('failed receipt requires recovery evidence',()=>{
  assert.throws(()=>finalizeIntegrationReceipt({
    connector_id:'demo.firestore',subject_revision:'1'.repeat(40),status:'FAIL',
    health_evidence_ref:'health/1'
  }),/INTEGRATION_RECEIPT_RECOVERY_EVIDENCE_REQUIRED/);
});

test('promotion requires evidence and never mutates connector directly',()=>{
  const before=structuredClone(connector);
  assert.throws(()=>planConnectorPromotion(connector,{decision:'ACTIVATE',evidence_refs:[]}),/INTEGRATION_PROMOTION_EVIDENCE_REQUIRED/);
  const plan=planConnectorPromotion(connector,{decision:'ACTIVATE',evidence_refs:['receipt/1']});
  assert.equal(plan.target_status,'ACTIVE');
  assert.deepEqual(connector,before);
});

test('unmounted connector source is HOLD',()=>{
  assert.equal(verifyConnectorSources(registry,{repoRoots:{}})[0].status,'HOLD');
});
