import test from 'node:test';
import assert from 'node:assert/strict';
import { claimHealth, reapExpiredClaims } from '../scripts/a-session-claim-health.mjs';

const claim=(overrides={})=>({
  claim_id:'A-1',
  claim_key:'freepass-creator/x@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa::repo-rescan',
  repository:'freepass-creator/x',
  subject_revision:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  scope:'repo-rescan',
  owner_session:'A-one',
  state:'ACTIVE',
  claimed_at:'2026-09-20T01:00:00Z',
  lease_until:'2026-09-20T02:00:00Z',
  completed_at:null,
  evidence_refs:[],
  ...overrides
});

const registry=(claims)=>({
  schema:'ai-core-a-session-work-claims/v1',
  status:'RESEARCH_COORDINATION_NOT_CANONICAL',
  observed_at:'2026-09-20T01:30:00Z',
  claims
});

test('health separates live and expired active claims',()=>{
  const r=registry([
    claim(),
    claim({claim_id:'A-2',claim_key:'freepass-creator/y@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb::repo-rescan',repository:'freepass-creator/y',subject_revision:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',lease_until:'2026-09-20T01:20:00Z'})
  ]);
  const h=claimHealth(r,new Date('2026-09-20T01:30:00Z'));
  assert.equal(h.counts.live,1);
  assert.equal(h.counts.expired_active,1);
});

test('reaper abandons only expired active claims',()=>{
  const r=registry([
    claim(),
    claim({claim_id:'A-2',claim_key:'freepass-creator/y@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb::repo-rescan',repository:'freepass-creator/y',subject_revision:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',lease_until:'2026-09-20T01:20:00Z'}),
    claim({claim_id:'A-3',state:'COMPLETED',completed_at:'2026-09-20T01:10:00Z',evidence_refs:['commit:x']})
  ]);
  const out=reapExpiredClaims(r,new Date('2026-09-20T01:30:00Z'));
  assert.deepEqual(out.reaped_claim_ids,['A-2']);
  assert.equal(out.registry.claims.find(x=>x.claim_id==='A-2').state,'ABANDONED');
  assert.equal(out.registry.claims.find(x=>x.claim_id==='A-2').abandon_reason,'LEASE_EXPIRED');
  assert.equal(out.registry.claims.find(x=>x.claim_id==='A-1').state,'ACTIVE');
  assert.equal(out.registry.claims.find(x=>x.claim_id==='A-3').state,'COMPLETED');
});

test('health flags multiple live claims for the same claim key',()=>{
  const r=registry([claim(),claim({claim_id:'A-2',owner_session:'A-two'})]);
  const h=claimHealth(r,new Date('2026-09-20T01:30:00Z'));
  assert.equal(h.status,'ATTENTION');
  assert.ok(h.anomalies.some(x=>x.code==='MULTIPLE_LIVE_CLAIMS'));
});


test('health flags one owner with multiple live claims',()=> {
  const r=registry([
    claim({claim_id:'A-owner-1',owner_session:'A-session-owner-shared'}),
    claim({
      claim_id:'A-owner-2',
      claim_key:'freepass-creator/y@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb::coordination:docs',
      repository:'freepass-creator/y',
      subject_revision:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      scope:'coordination:docs',
      owner_session:'A-session-owner-shared'
    })
  ]);
  const h=claimHealth(r,new Date('2026-09-20T01:30:00Z'));
  assert.equal(h.status,'ATTENTION');
  assert.ok(h.anomalies.some(x=>x.code==='MULTIPLE_LIVE_CLAIMS_FOR_OWNER'));
});
