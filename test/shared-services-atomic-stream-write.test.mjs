import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeStreamAtomically } from '../shared-services/fs/atomic-stream-write.mjs';

const provenance=JSON.parse(readFileSync(new URL('../shared-services/PROVENANCE.json',import.meta.url),'utf8'));
const entry=provenance.entries.find(item=>item.destination_path==='shared-services/fs/atomic-stream-write.mjs');

function gitBlobSha(bytes){
  return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');
}
async function* chunks(...values){
  for(const value of values) yield Buffer.from(value);
}

test('shared atomic writer is an exact copy of the pinned AIOps Git blob',()=>{
  assert.ok(entry);
  assert.equal(provenance.source_repository,'freepass-creator/aiops');
  assert.equal(provenance.source_revision,'3d6ec8c6a0e826ae0472e3fb3e8bbaa8399b68c9');
  assert.equal(entry.source_path,'lib/atomic-stream-write.mjs');
  assert.equal(entry.disposition,'EXACT_COPY_SHADOW');
  assert.equal(entry.source_runtime_authority,'AIOPS');
  assert.equal(entry.ai_core_runtime_authority,false);
  assert.equal(entry.consumer_cutover_authorized,false);

  const bytes=readFileSync(new URL('../shared-services/fs/atomic-stream-write.mjs',import.meta.url));
  assert.equal(gitBlobSha(bytes),'4e4da3becc6d3d3eebbc8108708c0d5e5dc4197d');
  assert.equal(gitBlobSha(bytes),entry.source_blob_sha);
});

test('atomic writer replaces destination only after the complete stream succeeds',async()=>{
  const root=mkdtempSync(join(tmpdir(),'ai-core-shared-write-'));
  try{
    const dest=join(root,'nested','result.bin');
    const written=await writeStreamAtomically(dest,chunks('ab','cd'));
    assert.equal(written,4);
    assert.equal(readFileSync(dest,'utf8'),'abcd');
    assert.deepEqual(readdirSync(join(root,'nested')),['result.bin']);
  } finally {
    rmSync(root,{recursive:true,force:true});
  }
});

test('bounded failure preserves the previous destination and removes staging data',async()=>{
  const root=mkdtempSync(join(tmpdir(),'ai-core-shared-write-'));
  try{
    const dest=join(root,'result.bin');
    writeFileSync(dest,'previous');
    await assert.rejects(
      writeStreamAtomically(dest,chunks('12','34'),{maxBytes:3}),
      /다운로드 크기 상한 초과/
    );
    assert.equal(readFileSync(dest,'utf8'),'previous');
    assert.deepEqual(readdirSync(root),['result.bin']);
  } finally {
    rmSync(root,{recursive:true,force:true});
  }
});
