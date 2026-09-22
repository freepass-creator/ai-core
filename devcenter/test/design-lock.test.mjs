import test from 'node:test';
import assert from 'node:assert/strict';
import {finalizeDesignLock,validateDesignLock} from '../scripts/design-lock.mjs';

const draft={
  subject:{
    project_id:'freepass-admin',
    repository:'freepass-creator/freepass-admin',
    revision:'1111111111111111111111111111111111111111',
    surface_id:'applications-list'
  },
  design_plan_ref:'artifacts/design-plan.json',
  core_revision:'2222222222222222222222222222222222222222',
  approval:{
    status:'APPROVED',
    approved_by:'USER',
    evidence_ref:'chat-decision:design-approval-001',
    approved_at:'2026-09-21T00:00:00.000Z'
  },
  source_refs:['artifacts/design-plan.json','artifacts/page.png'],
  previous_lock_ref:null
};

test('approved design can be finalized into deterministic lock',()=>{
  const lock=finalizeDesignLock(draft,{createdAt:'2026-09-21T00:01:00.000Z'});
  assert.match(lock.lock_id,/^dl_[a-f0-9]{24}$/);
  assert.deepEqual(validateDesignLock(lock),[]);
  const again=finalizeDesignLock(draft,{createdAt:'2026-09-21T00:02:00.000Z'});
  assert.equal(lock.lock_id,again.lock_id);
});

test('design lock cannot be created without explicit approval evidence',()=>{
  const broken=structuredClone(draft);
  broken.approval.evidence_ref='';
  assert.throws(()=>finalizeDesignLock(broken),/DESIGN_LOCK_EXPLICIT_APPROVAL_REQUIRED/);
});

test('moving branch names cannot replace exact revisions',()=>{
  const broken=structuredClone(draft);
  broken.subject.revision='main';
  assert.throws(()=>finalizeDesignLock(broken),/DESIGN_LOCK_INVALID/);
});

test('previous lock reference is preserved for rollback chain',()=>{
  const next=structuredClone(draft);
  next.previous_lock_ref='dl_aaaaaaaaaaaaaaaaaaaaaaaa';
  const lock=finalizeDesignLock(next,{createdAt:'2026-09-21T00:03:00.000Z'});
  assert.equal(lock.previous_lock_ref,'dl_aaaaaaaaaaaaaaaaaaaaaaaa');
});
