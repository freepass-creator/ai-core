import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createColocateOnlyAdapter,
  createColocateOnlyVerifier,
} from '../src/engine/group-integration-colocate-adapter.mjs';

async function fixture(fn){
  const root=await mkdtemp(join(tmpdir(),'ai-core-colocate-'));
  const workspace=join(root,'AI-CORE-GROUP');
  const source=join(root,'sales-source');
  await mkdir(workspace,{recursive:true});
  await mkdir(source,{recursive:true});
  try{return await fn({root,workspace,source});}
  finally{await rm(root,{recursive:true,force:true});}
}

const packet=(source,overrides={})=>({
  schema:'ai-core-integration-work-packet/v1',
  packet_id:'INT-WP-001-sales',
  plan_id:'AI-CORE-MERGE-P0',
  asset_id:'freepass-sales',
  project_id:'freepass-sales',
  repository:'freepass-creator/freepass-sales',
  expected_revision:'a'.repeat(40),
  classification:'COLOCATE_ONLY',
  action_kind:'FILESYSTEM_RELOCATION',
  current_path:source,
  ...overrides,
});

const preflight=(overrides={})=>({
  schema:'ai-core-integration-preflight/v1',
  status:'SEALED',
  packet_id:'INT-WP-001-sales',
  repository:'freepass-creator/freepass-sales',
  expected_revision:'a'.repeat(40),
  observed_at:'2026-09-20T10:00:00Z',
  seal_digest:'sha256:'+'c'.repeat(64),
  ...overrides,
});

test('adapter creates a workspace projection link without moving source',async()=>{
  await fixture(async({workspace,source})=>{
    const adapter=createColocateOnlyAdapter({
      workspaceRoot:workspace,
      areaByProject:{'freepass-sales':'subsidiaries'},
    });
    const result=await adapter.execute({packet:packet(source),preflight:preflight()});
    assert.equal(result.status,'SUCCEEDED');
    assert.equal(result.performed,true);

    const target=join(workspace,'subsidiaries','freepass-sales');
    assert.equal(await realpath(target),await realpath(source));
    assert.equal(await realpath(source),source);
    assert.ok(result.evidence_refs.includes('SOURCE_MOVED:false'));
  });
});

test('organization/workspace area must be explicitly mapped, never inferred',async()=>{
  await fixture(async({workspace,source})=>{
    const adapter=createColocateOnlyAdapter({workspaceRoot:workspace,areaByProject:{}});
    await assert.rejects(
      adapter.execute({packet:packet(source),preflight:preflight()}),
      /COLOCATE_WORKSPACE_AREA_REQUIRED/,
    );
  });
});

test('adapter refuses classifications other than COLOCATE_ONLY',async()=>{
  await fixture(async({workspace,source})=>{
    const adapter=createColocateOnlyAdapter({
      workspaceRoot:workspace,
      areaByProject:{'freepass-sales':'subsidiaries'},
    });
    await assert.rejects(
      adapter.execute({packet:packet(source,{classification:'KEEP_SEPARATE'}),preflight:preflight()}),
      /COLOCATE_CLASSIFICATION_REQUIRED/,
    );
  });
});

test('adapter rejects target path conflicts instead of replacing them',async()=>{
  await fixture(async({root,workspace,source})=>{
    const conflict=join(workspace,'subsidiaries','freepass-sales');
    await mkdir(conflict,{recursive:true});
    const adapter=createColocateOnlyAdapter({
      workspaceRoot:workspace,
      areaByProject:{'freepass-sales':'subsidiaries'},
    });
    await assert.rejects(
      adapter.execute({packet:packet(source),preflight:preflight()}),
      /COLOCATE_TARGET_CONFLICT/,
    );
    assert.equal(await realpath(conflict),conflict);
    assert.equal(await realpath(source),source);
  });
});

test('adapter is idempotent when projection already points to the exact source',async()=>{
  await fixture(async({workspace,source})=>{
    const adapter=createColocateOnlyAdapter({
      workspaceRoot:workspace,
      areaByProject:{'freepass-sales':'subsidiaries'},
    });
    const first=await adapter.execute({packet:packet(source),preflight:preflight()});
    const second=await adapter.execute({packet:packet(source),preflight:preflight()});
    assert.equal(first.output_digest,second.output_digest);
    assert.equal(second.command_ref,'colocate.link.ensure/v1');
  });
});

test('preflight must be sealed for the same repository and revision',async()=>{
  await fixture(async({workspace,source})=>{
    const adapter=createColocateOnlyAdapter({
      workspaceRoot:workspace,
      areaByProject:{'freepass-sales':'subsidiaries'},
    });
    await assert.rejects(
      adapter.execute({
        packet:packet(source),
        preflight:preflight({repository:'freepass-creator/other'}),
      }),
      /COLOCATE_PREFLIGHT_REPOSITORY_MISMATCH/,
    );
  });
});

test('verifier independently checks revision, cleanliness, link and path dependencies',async()=>{
  await fixture(async({workspace,source})=>{
    const p=packet(source);
    const pf=preflight();
    const adapter=createColocateOnlyAdapter({
      workspaceRoot:workspace,
      areaByProject:{'freepass-sales':'subsidiaries'},
    });
    const execution=await adapter.execute({packet:p,preflight:pf});

    const verify=createColocateOnlyVerifier({
      workspaceRoot:workspace,
      areaByProject:{'freepass-sales':'subsidiaries'},
      observeRepository:async()=>({
        repository:'freepass-creator/freepass-sales',
        revision:'a'.repeat(40),
        dirty_state:'CLEAN',
      }),
      verifyPathDependencies:async({source_moved,source_path})=>source_moved===false&&source_path===await realpath(source),
    });

    const results=await verify({packet:p,preflight:pf,execution});
    assert.deepEqual(results.map(x=>x.status),['PASS','PASS','PASS','PASS']);
  });
});

test('verifier fails PATH_DEPENDENCY_CHECK when original path safety is unknown',async()=>{
  await fixture(async({workspace,source})=>{
    const p=packet(source);
    const pf=preflight();
    const adapter=createColocateOnlyAdapter({
      workspaceRoot:workspace,
      areaByProject:{'freepass-sales':'subsidiaries'},
    });
    const execution=await adapter.execute({packet:p,preflight:pf});

    const verify=createColocateOnlyVerifier({
      workspaceRoot:workspace,
      areaByProject:{'freepass-sales':'subsidiaries'},
      observeRepository:async()=>({
        repository:'freepass-creator/freepass-sales',
        revision:'a'.repeat(40),
        dirty_state:'CLEAN',
      }),
      verifyPathDependencies:async()=>false,
    });

    const results=await verify({packet:p,preflight:pf,execution});
    assert.equal(results.find(x=>x.name==='PATH_DEPENDENCY_CHECK').status,'FAIL');
  });
});
