import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFetchManifest, toResolvedPointer } from '../src/github-source-map.mjs';

test('maps aiops control to live repository path',()=>{const m=buildFetchManifest({project:'freepasserp4'},[{system:'aiops',kind:'control',required:true}]);assert.equal(m[0].repo,'freepass-creator/aiops');assert.equal(m[0].path,'docs/CONTROL_PLANE.md');});
test('project instructions use project repo candidates',()=>{const m=buildFetchManifest({project:'freepasserp4'},[{system:'project',kind:'instructions',required:true}]);assert.equal(m[0].repo,'freepass-creator/freepasserp4');assert.ok(m[0].candidates.includes('AGENTS.md'));});
test('fetched sha becomes versioned pointer',()=>{const p=toResolvedPointer({system:'aiops',kind:'control',repo:'r',path:'p',required:true},{sha:'abc'});assert.equal(p.revision_or_sha,'abc');assert.equal(p.status,'authoritative');});
