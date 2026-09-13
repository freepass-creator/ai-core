import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requirementDigest, applyRequirementUpdate, currentRequirements,
  minimalPlanSlice, staleReasons, proofIsCurrent,
  detectWriteConflicts, transitionEpisode
} from '../src/development-continuity.mjs';

const base = [{ id:'R1', statement:'접수 버튼 유지', provenance:'USER_CONFIRMED', status:'ACTIVE', version:1, acceptance:['버튼 유지'], non_goals:[], depends_on:[] }];

test('unchanged requirement does not create a new version', () => {
  const next = applyRequirementUpdate(base, { id:'R1', statement:'접수 버튼 유지', provenance:'USER_CONFIRMED', acceptance:['버튼 유지'] });
  assert.equal(next.length, 1);
  assert.equal(next[0].version, 1);
});

test('changed requirement supersedes prior version', () => {
  const next = applyRequirementUpdate(base, { id:'R1', statement:'접수 버튼은 왼쪽 유지', provenance:'USER_CONFIRMED' });
  assert.equal(next.length, 2);
  assert.equal(next[0].status, 'SUPERSEDED');
  assert.equal(next[1].version, 2);
  assert.equal(next[1].supersedes, 'R1@1');
});

test('AI inferred intent stays explicitly inferred', () => {
  const next = applyRequirementUpdate([], { id:'R2', statement:'모바일에서는 하단 고정 제외' });
  assert.equal(next[0].provenance, 'AI_INFERRED');
});

test('digest changes when active meaning changes', () => {
  const before = requirementDigest(base);
  const after = requirementDigest(applyRequirementUpdate(base, { id:'R1', statement:'접수 버튼은 왼쪽 유지', provenance:'USER_CONFIRMED' }));
  assert.notEqual(before, after);
});

test('superseded requirements are excluded from current view', () => {
  const next = applyRequirementUpdate(base, { id:'R1', statement:'접수 버튼은 왼쪽 유지', provenance:'USER_CONFIRMED' });
  assert.deepEqual(currentRequirements(next).map(r => r.version), [2]);
});

test('minimal plan slice includes transitive dependencies', () => {
  const reqs = [
    {id:'A',statement:'A',status:'ACTIVE',version:1,depends_on:[]},
    {id:'B',statement:'B',status:'ACTIVE',version:1,depends_on:['A']},
    {id:'C',statement:'C',status:'ACTIVE',version:1,depends_on:['B']},
    {id:'D',statement:'D',status:'ACTIVE',version:1,depends_on:[]}
  ];
  assert.deepEqual(minimalPlanSlice(reqs,['C']).map(r=>r.id).sort(), ['A','B','C']);
});

test('requirement or source drift marks packet stale', () => {
  const packet = { requirement_set_digest:'old', source_revision:'abc', policy_revision:'p1' };
  assert.deepEqual(staleReasons(packet,{ requirement_set_digest:'new', source_revision:'def', policy_revision:'p2' }), ['REQUIREMENTS_CHANGED','SOURCE_REVISION_CHANGED','POLICY_CHANGED']);
});

test('proof must match both requirement digest and subject revision', () => {
  const episode = { requirement_set_digest:'r1', source_revision:'sha2' };
  assert.equal(proofIsCurrent({requirement_set_digest:'r1',subject_revision:'sha2'}, episode), true);
  assert.equal(proofIsCurrent({requirement_set_digest:'r0',subject_revision:'sha2'}, episode), false);
  assert.equal(proofIsCurrent({requirement_set_digest:'r1',subject_revision:'sha1'}, episode), false);
});

test('same branch overlapping write scopes conflict', () => {
  const c = detectWriteConflicts([
    {owner:'work',branch:'f',write_scope:['src/a']},
    {owner:'chat',branch:'f',write_scope:['src/a/file.js']}
  ]);
  assert.equal(c.length, 1);
});

test('different branches do not create direct write conflict', () => {
  const c = detectWriteConflicts([
    {owner:'work',branch:'f1',write_scope:['src/a']},
    {owner:'chat',branch:'f2',write_scope:['src/a']}
  ]);
  assert.equal(c.length, 0);
});

test('episode valid lifecycle transition succeeds', () => {
  assert.equal(transitionEpisode('READY','IMPLEMENTING'), 'IMPLEMENTING');
  assert.equal(transitionEpisode('VERIFYING','PREVIEW_READY'), 'PREVIEW_READY');
});

test('episode cannot jump from planning state to release', () => {
  assert.throws(() => transitionEpisode('FRAMED','RELEASED'));
});
