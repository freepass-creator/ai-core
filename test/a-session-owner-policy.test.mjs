import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidASessionOwner, resolveASessionOwner } from '../scripts/a-session-owner-policy.mjs';

test('stable A-session owner format is accepted', () => {
  assert.equal(isValidASessionOwner('A-session-sales-a01'), true);
  assert.equal(isValidASessionOwner('A-session-gap-repair-chat'), true);
});

test('generic and underspecified owners are rejected', () => {
  for (const value of ['A_SESSION','A-session-current-chat','A-session-default','A-session-1','CLAUDE','']) {
    assert.equal(isValidASessionOwner(value), false, value);
  }
});

test('owner resolution prefers explicit owner then session environment', () => {
  assert.equal(resolveASessionOwner('A-session-explicit-01',{ AI_CORE_A_SESSION_ID:'A-session-env-0001' }),'A-session-explicit-01');
  assert.equal(resolveASessionOwner(null,{ AI_CORE_A_SESSION_ID:'A-session-env-0001' }),'A-session-env-0001');
});

test('owner resolution fails closed without stable identity', () => {
  assert.throws(() => resolveASessionOwner(null,{}), /A_SESSION_OWNER_REQUIRED/);
  assert.throws(() => resolveASessionOwner('A_SESSION',{}), /A_SESSION_OWNER_INVALID/);
});
