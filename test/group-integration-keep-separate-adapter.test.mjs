import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createKeepSeparateMetadataAdapter,
  createKeepSeparateMetadataVerifier,
} from '../src/engine/group-integration-keep-separate-adapter.mjs';

const packet=(overrides={})=>({
  schema:'ai-core-integration-work-packet/v1',
  packet_id:'INT-WP-001-sales',
  plan_id:'AI-CORE-MERGE-P0',
  asset_id:'freepass-sales',
  project_id:'freepass-sales',
  repository:'freepass-creator/freepass-sales',
  expected_revision:'a'.repeat(40),
  classification:'KEEP_SEPARATE',
  action_kind:'METADATA_ONLY',
  current_path:'C:/dev/sales',
  ...overrides,
});

const preflight=(overrides={})=>({
  schema:'ai-core-integration-preflight/v1',
  status:'SEALED',
  packet_id:'INT-WP-001-sales',
  repository:'freepass-creator/freepass-sales',
  expected_revision:'a'.repeat(40),
  observed_at:'2026-09-20T09:40:00Z',
  seal_digest:'sha256:'+'c'.repeat(64),
  ...overrides,
});

async function withWorkspace(fn){
  const root=await mkdtemp(join(tmpdir(),'ai-core-keep-separate-'));
  try{return await fn(root);}
  finally{await rm(root,{recursive:true,force:true});}
}

test('adapter writes only a workspace pointer for KEEP_SEPARATE',async()=>{
  await withWorkspace(async root=>{
    const adapter=createKeepSeparateMetadataAdapter({workspaceRoot:root});
    const result=await adapter.execute({packet:packet(),preflight:preflight(),attempt_id:'attempt-1'});
    assert.equal(result.status,'SUCCEEDED');
    assert.equal(result.performed,true);
    assert.match(result.output_digest,/^sha256:[0-9a-f]{64}$/);

    const pointer=JSON.parse(await readFile(join(root,'.ai-core','pointers','freepass-sales.json'),'utf8'));
    assert.equal(pointer.repository,'freepass-creator/freepass-sales');
    assert.equal(pointer.source_revision,'a'.repeat(40));
    assert.equal(pointer.source_preserved,true);
    assert.equal(pointer.merge_git_history,false);
    assert.equal(pointer.canonical_project_registry_mutated,false);
  });
});

test('adapter rejects any classification other than KEEP_SEPARATE metadata-only',async()=>{
  await withWorkspace(async root=>{
    const adapter=createKeepSeparateMetadataAdapter({workspaceRoot:root});
    await assert.rejects(
      adapter.execute({packet:packet({classification:'MERGE_PHYSICAL'}),preflight:preflight(),attempt_id:'attempt-1'}),
      /KEEP_SEPARATE_CLASSIFICATION_REQUIRED/,
    );
    await assert.rejects(
      adapter.execute({packet:packet({action_kind:'CROSS_REPO_WRITE'}),preflight:preflight(),attempt_id:'attempt-1'}),
      /KEEP_SEPARATE_ACTION_KIND_REQUIRED/,
    );
  });
});

test('adapter will not silently reuse a pointer owned by another repository identity',async()=>{
  await withWorkspace(async root=>{
    const adapter=createKeepSeparateMetadataAdapter({workspaceRoot:root});
    await adapter.execute({packet:packet(),preflight:preflight(),attempt_id:'attempt-1'});
    await assert.rejects(
      adapter.execute({
        packet:packet({repository:'freepass-creator/other-sales'}),
        preflight:preflight(),
        attempt_id:'attempt-2',
      }),
      /KEEP_SEPARATE_POINTER_IDENTITY_CONFLICT/,
    );
  });
});

test('adapter requires an existing explicit workspace root',async()=>{
  const adapter=createKeepSeparateMetadataAdapter({workspaceRoot:join(tmpdir(),'definitely-missing-ai-core-workspace')});
  await assert.rejects(
    adapter.execute({packet:packet(),preflight:preflight(),attempt_id:'attempt-1'}),
    /KEEP_SEPARATE_WORKSPACE_ROOT_MISSING/,
  );
});

test('verifier independently rechecks source revision, cleanliness, pointer and project authority',async()=>{
  await withWorkspace(async root=>{
    const adapter=createKeepSeparateMetadataAdapter({workspaceRoot:root});
    const execution=await adapter.execute({packet:packet(),preflight:preflight(),attempt_id:'attempt-1'});

    const verify=createKeepSeparateMetadataVerifier({
      workspaceRoot:root,
      observeRepository:async()=>({
        repository:'freepass-creator/freepass-sales',
        revision:'a'.repeat(40),
        dirty_state:'CLEAN',
      }),
      verifyProjectAuthority:async()=>true,
    });

    const results=await verify({packet:packet(),preflight:preflight(),execution});
    assert.deepEqual(results.map(x=>x.status),['PASS','PASS','PASS','PASS']);
  });
});

test('verifier fails if source revision moves after pointer write',async()=>{
  await withWorkspace(async root=>{
    const adapter=createKeepSeparateMetadataAdapter({workspaceRoot:root});
    const execution=await adapter.execute({packet:packet(),preflight:preflight(),attempt_id:'attempt-1'});

    const verify=createKeepSeparateMetadataVerifier({
      workspaceRoot:root,
      observeRepository:async()=>({
        repository:'freepass-creator/freepass-sales',
        revision:'b'.repeat(40),
        dirty_state:'CLEAN',
      }),
      verifyProjectAuthority:async()=>true,
    });

    const results=await verify({packet:packet(),preflight:preflight(),execution});
    assert.equal(results.find(x=>x.name==='SOURCE_REVISION_UNCHANGED').status,'FAIL');
  });
});

test('verifier fails when project authority cannot be proven unchanged',async()=>{
  await withWorkspace(async root=>{
    const adapter=createKeepSeparateMetadataAdapter({workspaceRoot:root});
    const execution=await adapter.execute({packet:packet(),preflight:preflight(),attempt_id:'attempt-1'});

    const verify=createKeepSeparateMetadataVerifier({
      workspaceRoot:root,
      observeRepository:async()=>({
        repository:'freepass-creator/freepass-sales',
        revision:'a'.repeat(40),
        dirty_state:'CLEAN',
      }),
      verifyProjectAuthority:async()=>false,
    });

    const results=await verify({packet:packet(),preflight:preflight(),execution});
    assert.equal(results.find(x=>x.name==='PROJECT_AUTHORITY_UNCHANGED').status,'FAIL');
  });
});
