import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const readJson=path=>JSON.parse(readFileSync(resolve(root,path),'utf8'));
const classification=readJson('docs/integration/DOCSHUB_IMPORT_CLASSIFICATION_2026-09-23.json');
const workMap=readJson('registry/work-map.json');
const capabilities=readJson('registry/capabilities.json');
const projects=readJson('registry/projects.json');
const binding=readJson('devcenter/hubs/document/source-binding.json');

function walk(dir){
  const out=[];
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const full=resolve(dir,entry.name);
    if(entry.isDirectory()) out.push(...walk(full));
    else out.push(relative(root,full).replaceAll('\\','/'));
  }
  return out.sort();
}

test('pre-cutover document authority stays external and HOLD while management-support is scaffold-only',()=>{
  assert.equal(classification.authority.cutover_authorized,false);
  assert.equal(classification.routing_gate.transition_state,'PRE_CUTOVER');

  const work=workMap.work_types.find(item=>item.work_type_id==='document-production');
  const capability=capabilities.capabilities.find(item=>item.id==='docs.production');
  const project=projects.projects.find(item=>item.project_id==='docshub');

  assert.ok(work);
  assert.ok(capability);
  assert.ok(project);
  assert.equal(work.target_project_id,classification.routing_gate.expected_work_map_target_project_id);
  assert.deepEqual(capability.projects,classification.routing_gate.expected_capability_project_ids);
  assert.equal(capability.status,classification.routing_gate.expected_capability_status);
  assert.equal(project.execution_readiness_status,'HOLD');
  assert.equal(project.head_revision,classification.source.revision);
  assert.equal(binding.revision,classification.source.revision);
});

test('management-support template target contains only the declared scaffold before cutover',()=>{
  assert.equal(classification.target_layout.scaffold_only,true);
  const actual=walk(resolve(root,classification.target_layout.root));
  assert.deepEqual(actual,[...classification.target_layout.allowed_scaffold_files].sort());
});

test('cutover contract names one future owner and one runtime consumer instead of creating a second Document Hub SSOT',()=>{
  assert.equal(classification.authority.target_template_owner,'ai-core/management-support/templates');
  assert.equal(classification.authority.runtime_consumer,'ai-core/devcenter/document-hub');
  assert.equal(classification.authority.duplicate_ssot_forbidden,true);
  assert.notEqual(classification.routing_gate.expected_work_map_target_project_id,classification.routing_gate.post_cutover_target_project_id);
  assert.deepEqual(classification.routing_gate.post_cutover_capability_project_ids,['ai-core']);
});

test('physical template cutover remains impossible without provenance, parity, binding and routing transition evidence',()=>{
  const required=new Set(classification.cutover_requirements);
  for(const check of [
    'FRESH_LOCAL_INVENTORY_OBSERVED',
    'SENSITIVE_AND_CASE_CONTENT_EXCLUDED',
    'TARGET_PROVENANCE_WRITTEN',
    'TEMPLATE_ARTIFACT_PARITY_VERIFIED',
    'DOCUMENT_HUB_BINDING_MOVED_TO_INTERNAL_SOURCE',
    'WORK_MAP_AND_CAPABILITY_AUTHORITY_UPDATED',
    'OLD_DOCSHUB_SOURCE_MARKED_REFERENCE_ONLY'
  ]) assert.ok(required.has(check),check);
  assert.equal(classification.local_unversioned_source.import_authorized,false);
});
