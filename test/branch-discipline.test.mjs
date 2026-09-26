import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHeadBranch, winsOver } from '../scripts/check-branch-discipline.mjs';

const policy={
  allowed_head_patterns:['^work/[a-z0-9._-]+/[a-z0-9._-]+$','^dependabot/'],
  forbidden_actor_prefixes:['gpt/','claude/','codex/','work/gpt/','work/claude/','work/codex/'],
  legacy_head_exceptions:[{branch:'claude/legacy-open-pr',expires:'2026-10-07'}]
};

test('work-owned branch is accepted',()=>{
  assert.deepEqual(validateHeadBranch('work/ai-core/DEV-123',policy,'2026-09-26'),[]);
});

test('AI actor-owned branch is rejected',()=>{
  assert.match(validateHeadBranch('gpt/new-engine',policy,'2026-09-26')[0],/ACTOR_OWNED_BRANCH_FORBIDDEN/);
});

test('non-work ad-hoc branch is rejected',()=>{
  assert.match(validateHeadBranch('feature/new-engine',policy,'2026-09-26')[0],/WORK_BRANCH_REQUIRED/);
});

test('legacy open PR exception expires',()=>{
  assert.deepEqual(validateHeadBranch('claude/legacy-open-pr',policy,'2026-09-26'),[]);
  assert.match(validateHeadBranch('claude/legacy-open-pr',policy,'2026-10-08')[0],/ACTOR_OWNED_BRANCH_FORBIDDEN/);
});

test('earliest open PR holds a canonical scope (drafts included)',()=>{
  const older={number:5,created_at:'2026-09-26T00:00:00Z'};
  const newer={number:9,created_at:'2026-09-26T01:00:00Z'};
  assert.equal(winsOver(older,newer),true);
  assert.equal(winsOver(newer,older),false);
  assert.equal(winsOver({number:3,created_at:older.created_at},older),true);
  assert.equal(winsOver(older,undefined),true);
});
