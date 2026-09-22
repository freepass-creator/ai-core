import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessIntegrationImportContent } from '../src/engine/group-integration-preflight.mjs';

const manifest=JSON.parse(readFileSync(new URL('../docs/integration/AIOPS_IMPORT_CLASSIFICATION_2026-09-22.json',import.meta.url),'utf8'));

test('AIOps import classification is revision-pinned, conservative and fully accounted',()=>{
  assert.equal(manifest.schema_version,'ai-core-aiops-import-classification/v1');
  assert.equal(manifest.source.repository,'freepass-creator/aiops');
  assert.match(manifest.source.revision,/^[0-9a-f]{40}$/);
  assert.equal(manifest.source.tracked_files,1407);
  assert.equal(manifest.policy.default_disposition,'HOLD_UNCLASSIFIED');
  assert.equal(manifest.policy.execution_authorized,false);
  assert.equal(manifest.policy.copied_history_is_authoritative,false);

  const prefixCount=manifest.prefix_rules.reduce((sum,rule)=>sum+rule.expected_count,0);
  const exactCount=manifest.exact_rules.reduce((sum,rule)=>sum+rule.paths.length,0);
  assert.equal(prefixCount,1198);
  assert.equal(exactCount,3);
  assert.equal(manifest.shared_library_review.length,9);
  assert.equal(prefixCount+exactCount+manifest.shared_library_review.length+manifest.summary.default_hold_remaining_files,1407);
  assert.equal(manifest.summary.accounted_files,1407);
});

test('history is preserved below aiops without becoming AI Core authority',()=>{
  const docs=manifest.prefix_rules.find(rule=>rule.id==='docs-history');
  const ui=manifest.prefix_rules.find(rule=>rule.id==='erp-uiux-history');
  assert.equal(docs.disposition,'PRESERVE_HISTORY_NO_AUTHORITY');
  assert.equal(docs.destination_prefix,'aiops/docs/');
  assert.equal(ui.disposition,'PRESERVE_HISTORY_NO_AUTHORITY');
  assert.equal(ui.destination_prefix,'aiops/erp-uiux/');
  assert.ok(manifest.invariants.some(rule=>/never promoted to root standards/i.test(rule)));
});

test('known unsafe source areas are both classified as excluded and rejected by the preflight gate',()=>{
  const excluded=new Map(manifest.prefix_rules.filter(rule=>rule.disposition.startsWith('EXCLUDE_')).map(rule=>[rule.id,rule]));
  assert.equal(excluded.get('exclude-ai-core-kit-copy').expected_count,14);
  assert.equal(excluded.get('exclude-source-workflows').expected_count,3);
  assert.equal(excluded.get('exclude-operational-artifacts').expected_count,36);
  assert.equal(excluded.get('exclude-case-material').expected_count,6);

  const result=assessIntegrationImportContent({paths:[
    '.ai-core/START_HERE.md',
    '.github/workflows/ai-core-penalty.yml',
    'outputs/receivable-projection/latest.json',
    'logs/폴더정리-2026-09-03.json',
    '사건/README.md',
    'AGENTS.md',
  ]});
  assert.equal(result.status,'HOLD');
  const codes=new Set(result.blockers.map(item=>item.code));
  assert.ok(codes.has('IMPORT_AI_CORE_KIT_DUPLICATE'));
  assert.ok(codes.has('IMPORT_DEPLOY_BOUNDARY_FORBIDDEN'));
  assert.ok(codes.has('IMPORT_OPERATIONAL_DATA_FORBIDDEN'));
  assert.ok(codes.has('IMPORT_CASE_MATERIAL_FORBIDDEN'));
  assert.ok(codes.has('IMPORT_ROOT_INSTRUCTION_AUTHORITY_COLLISION'));
});

test('domain-heavy AIOps code stays HOLD instead of being bulk-imported',()=>{
  const rule=manifest.prefix_rules.find(item=>item.id==='hold-domain-code');
  assert.equal(rule.disposition,'HOLD_DOMAIN_OWNER');
  assert.equal(rule.expected_count,819);
  for(const prefix of ['wonja/','scripts/','sheets/','asset-engine/','jageum/','boheom/','fb/','misu/']){
    assert.ok(rule.prefixes.includes(prefix));
  }
});

test('shared-library review has one extracted atomic writer shadow and authorizes no consumer cutover',()=>{
  const reviewed=manifest.shared_library_review;
  assert.equal(new Set(reviewed.map(item=>item.path)).size,reviewed.length);
  assert.ok(reviewed.every(item=>item.execution_authorized===false));

  const candidates=reviewed.filter(item=>item.disposition==='EXTRACT_SHARED_CANDIDATE');
  assert.deepEqual(candidates,[]);
  const extracted=reviewed.filter(item=>item.disposition==='EXTRACTED_SHARED_SHADOW');
  assert.deepEqual(extracted.map(item=>item.path),['lib/atomic-stream-write.mjs']);
  assert.equal(extracted[0].destination_candidate,'shared-services/fs/atomic-stream-write.mjs');
  assert.equal(extracted[0].execution_authorized,false);
  assert.equal(extracted[0].extraction.consumer_cutover_authorized,false);
  assert.equal(extracted[0].extraction.source_blob_sha,'4e4da3becc6d3d3eebbc8108708c0d5e5dc4197d');
  assert.equal(assessIntegrationImportContent({paths:['lib/atomic-stream-write.mjs']}).status,'PASS');

  const byPath=new Map(reviewed.map(item=>[item.path,item]));
  for(const path of ['lib/goog.mjs','lib/googfetch.mjs','lib/drive.mjs','lib/sheet.mjs','lib/lease.mjs','lib/task-board.mjs','lib/lock.mjs']){
    assert.equal(byPath.get(path).disposition,'REFACTOR_REQUIRED',path);
  }
  assert.equal(byPath.get('lib/ids.mjs').disposition,'KEEP_DOMAIN_CONFIG');
});

test('root agent instructions are explicit authority exclusions',()=>{
  const paths=manifest.exact_rules.flatMap(rule=>rule.paths);
  assert.deepEqual(paths.sort(),['AGENTS.md','CLAUDE.md','GEMINI.md'].sort());
  assert.ok(manifest.exact_rules.every(rule=>rule.disposition==='EXCLUDE_AUTHORITY_DUPLICATE'));
});
