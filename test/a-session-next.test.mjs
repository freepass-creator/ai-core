import test from 'node:test';
import assert from 'node:assert/strict';
import { changedCandidates } from '../scripts/a-session-next.mjs';

const coverage={repositories:[
  {repository:'freepass-creator/ai-core',default_branch:'main',observed_head:null,audit_state:'CORE_BASELINE',findings:[]},
  {repository:'freepass-creator/deep',default_branch:'main',observed_head:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',audit_state:'DEEP_EVIDENCE',findings:['x']},
  {repository:'freepass-creator/sample',default_branch:'main',observed_head:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',audit_state:'SAMPLED_NO_PROMOTION',findings:[]},
  {repository:'freepass-creator/same',default_branch:'main',observed_head:'cccccccccccccccccccccccccccccccccccccccc',audit_state:'DEEP_EVIDENCE',findings:[]}
]};

test('allocator only returns changed non-self repositories', () => {
  const heads={
    'freepass-creator/deep':'dddddddddddddddddddddddddddddddddddddddd',
    'freepass-creator/sample':'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    'freepass-creator/same':'cccccccccccccccccccccccccccccccccccccccc'
  };
  const got=changedCandidates(coverage,heads);
  assert.deepEqual(got.map(x=>x.repository),['freepass-creator/deep','freepass-creator/sample']);
});

test('deep-evidence candidates are ordered before sampled candidates', () => {
  const heads={
    'freepass-creator/deep':'dddddddddddddddddddddddddddddddddddddddd',
    'freepass-creator/sample':'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    'freepass-creator/same':'ffffffffffffffffffffffffffffffffffffffff'
  };
  const got=changedCandidates(coverage,heads);
  assert.deepEqual(got.map(x=>x.audit_state),['DEEP_EVIDENCE','DEEP_EVIDENCE','SAMPLED_NO_PROMOTION']);
});

test('candidate carries revision-bound audit context', () => {
  const heads={'freepass-creator/deep':'dddddddddddddddddddddddddddddddddddddddd'};
  const got=changedCandidates(coverage,heads);
  assert.equal(got[0].previous_revision,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(got[0].current_revision,'dddddddddddddddddddddddddddddddddddddddd');
  assert.deepEqual(got[0].findings,['x']);
});
