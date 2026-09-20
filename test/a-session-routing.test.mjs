import test from 'node:test';
import assert from 'node:assert/strict';
import { validateARoutingReceipts } from '../scripts/validate-a-session-routing.mjs';

const sha='a'.repeat(40);
function evidence(){return {schema:'ai-core-a-session-evidence-registry/v1',findings:[{id:'x',routes:['C']}]};}
function sent(){return {
  schema:'ai-core-a-session-routing-receipts/v1',
  status:'RESEARCH_ROUTING_RECEIPTS_NOT_CANONICAL',
  receipts:[{
    route_id:'x::C',finding_id:'x',target_session:'C',route_status:'SENT',
    source_evidence_revision:sha,routed_at:'2026-09-20T00:00:00Z',
    receiver:null,decision:null,
    feedback:{state:'PENDING',recorded_at:null,note:null},
    history:[{status:'SENT',observed_at:'2026-09-20T00:00:00Z',evidence_revision:sha,reason:'Initial route delivery is recorded.'}]
  }]
};}
test('accepts one SENT receipt for each declared finding route',()=>assert.equal(validateARoutingReceipts(sent(),evidence()).status,'VALID'));
test('rejects a missing route receipt',()=>{const r=sent();r.receipts=[];assert.ok(validateARoutingReceipts(r,evidence()).errors.some(e=>e.code==='ROUTE_RECEIPT_MISSING'));});
test('rejects duplicate receipts for the same finding/session pair',()=>{const r=sent();r.receipts.push(structuredClone(r.receipts[0]));assert.ok(validateARoutingReceipts(r,evidence()).errors.some(e=>e.code==='ROUTE_RECEIPT_DUPLICATE'));});
test('SENT cannot pretend a receiver already acknowledged it',()=>{const r=sent();r.receipts[0].receiver={session:'C',ai_core_revision:sha,observed_at:'2026-09-20T00:01:00Z',evidence_refs:['x']};assert.ok(validateARoutingReceipts(r,evidence()).errors.some(e=>e.code==='SENT_RECEIVER_MUST_BE_NULL'));});
test('CLOSED requires receiver evidence decision and feedback',()=>{const r=sent();const x=r.receipts[0];x.route_status='CLOSED';x.history.push({status:'CLOSED',observed_at:'2026-09-20T00:02:00Z',evidence_revision:sha,reason:'Receiver has completed a decision.'});const v=validateARoutingReceipts(r,evidence());assert.ok(v.errors.some(e=>e.code==='RECEIVER_REQUIRED'));assert.ok(v.errors.some(e=>e.code==='CLOSED_DECISION_REQUIRED'));assert.ok(v.errors.some(e=>e.code==='CLOSED_FEEDBACK_REQUIRED'));});
test('accepts a fully evidenced closed loop',()=>{const r=sent();const x=r.receipts[0];x.route_status='CLOSED';x.receiver={session:'C',ai_core_revision:sha,observed_at:'2026-09-20T00:01:00Z',evidence_refs:['docs/C_DECISION.md']};x.decision={outcome:'HOLD',reason:'Second independent implementation evidence is still required.'};x.feedback={state:'RECORDED',recorded_at:'2026-09-20T00:02:00Z',note:'A keeps the finding active and waits for the requested evidence.'};x.history.push({status:'CLOSED',observed_at:'2026-09-20T00:02:00Z',evidence_revision:sha,reason:'Receiver decision and A feedback are both recorded.'});assert.equal(validateARoutingReceipts(r,evidence()).status,'VALID');});
