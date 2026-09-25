import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

const need=(condition,code)=>{if(!condition) throw new Error(code);};
const clean=value=>String(value??'').normalize('NFKC').trim();
const ASSET_ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const CHECKSUM=/^sha256:[0-9a-f]{64}$/;

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const digest=value=>`sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;

function safeUnder(root,target,code='KEEP_SEPARATE_POINTER_PATH_ESCAPE'){
  const rel=relative(root,target);
  need(rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel),code);
}

function pointerRecord(packet,preflight){
  need(packet?.schema==='ai-core-integration-work-packet/v1','INTEGRATION_WORK_PACKET_REQUIRED');
  need(packet.classification==='KEEP_SEPARATE','KEEP_SEPARATE_CLASSIFICATION_REQUIRED');
  need(packet.action_kind==='METADATA_ONLY','KEEP_SEPARATE_ACTION_KIND_REQUIRED');
  need(ASSET_ID.test(packet.asset_id??''),'KEEP_SEPARATE_ASSET_ID_INVALID');
  need(preflight?.schema==='ai-core-integration-preflight/v1'&&preflight.status==='SEALED','KEEP_SEPARATE_PREFLIGHT_REQUIRED');
  need(preflight.packet_id===packet.packet_id,'KEEP_SEPARATE_PREFLIGHT_PACKET_MISMATCH');
  need(preflight.repository===packet.repository,'KEEP_SEPARATE_PREFLIGHT_REPOSITORY_MISMATCH');
  need(preflight.expected_revision===packet.expected_revision,'KEEP_SEPARATE_PREFLIGHT_REVISION_MISMATCH');

  return {
    schema:'ai-core-group-project-pointer/v1',
    asset_id:packet.asset_id,
    project_id:packet.project_id??null,
    repository:packet.repository,
    source_revision:packet.expected_revision,
    classification:'KEEP_SEPARATE',
    current_path:packet.current_path??null,
    plan_id:packet.plan_id,
    packet_id:packet.packet_id,
    preflight_digest:preflight.seal_digest,
    source_preserved:true,
    project_authority_preserved:true,
    merge_git_history:false,
    canonical_project_registry_mutated:false,
  };
}

async function resolvePointerLocation(workspaceRoot,assetId,io){
  need(typeof workspaceRoot==='string'&&isAbsolute(workspaceRoot),'KEEP_SEPARATE_WORKSPACE_ROOT_REQUIRED');
  need(ASSET_ID.test(assetId??''),'KEEP_SEPARATE_ASSET_ID_INVALID');

  const root=resolve(workspaceRoot);
  let realRoot;
  try{realRoot=await io.realpath(root);}
  catch{throw new Error('KEEP_SEPARATE_WORKSPACE_ROOT_MISSING');}

  const pointerDir=resolve(realRoot,'.ai-core','pointers');
  safeUnder(realRoot,pointerDir);
  await io.mkdir(pointerDir,{recursive:true});
  const realPointerDir=await io.realpath(pointerDir);
  safeUnder(realRoot,realPointerDir);

  const target=resolve(realPointerDir,`${assetId}.json`);
  safeUnder(realPointerDir,target);
  return {realRoot,realPointerDir,target,relativeRef:relative(realRoot,target).replaceAll('\\','/')};
}

async function readExisting(path,io){
  try{return JSON.parse(await io.readFile(path,'utf8'));}
  catch(error){
    if(error?.code==='ENOENT') return null;
    if(error instanceof SyntaxError) throw new Error('KEEP_SEPARATE_POINTER_UNREADABLE');
    throw error;
  }
}

function assertIdentityCompatible(existing,next){
  if(!existing) return;
  need(existing.schema==='ai-core-group-project-pointer/v1','KEEP_SEPARATE_POINTER_SCHEMA_CONFLICT');
  need(existing.asset_id===next.asset_id,'KEEP_SEPARATE_POINTER_IDENTITY_CONFLICT');
  need((existing.project_id??null)===(next.project_id??null),'KEEP_SEPARATE_POINTER_IDENTITY_CONFLICT');
  need(existing.repository===next.repository,'KEEP_SEPARATE_POINTER_IDENTITY_CONFLICT');
  need(existing.classification==='KEEP_SEPARATE','KEEP_SEPARATE_POINTER_CLASSIFICATION_CONFLICT');
}

export function createKeepSeparateMetadataAdapter({
  workspaceRoot,
  io={
    mkdir,
    readFile,
    realpath,
    rename,
    rm,
    writeFile,
  },
}={}){
  async function execute({packet,preflight,attempt_id}={}){
    const pointer=pointerRecord(packet,preflight);
    need(ASSET_ID.test(attempt_id??''),'KEEP_SEPARATE_ATTEMPT_ID_INVALID');

    const location=await resolvePointerLocation(workspaceRoot,packet.asset_id,io);
    const existing=await readExisting(location.target,io);
    assertIdentityCompatible(existing,pointer);

    const serialized=`${JSON.stringify(pointer,null,2)}\n`;
    const outputDigest=digest(pointer);
    const tmp=resolve(location.realPointerDir,`.${packet.asset_id}.${attempt_id}.tmp`);
    safeUnder(location.realPointerDir,tmp);

    try{
      await io.writeFile(tmp,serialized,{encoding:'utf8',flag:'wx'});
      await io.rename(tmp,location.target);
    }catch(error){
      try{await io.rm(tmp,{force:true});}catch{}
      throw error;
    }

    return {
      status:'SUCCEEDED',
      performed:true,
      output_refs:[`workspace:${location.relativeRef}`],
      output_digest:outputDigest,
      evidence_refs:[
        `WRITE:${location.relativeRef}#${outputDigest}`,
        `SOURCE:${packet.repository}@${packet.expected_revision}`,
      ],
      deterministic:true,
      executor_version:'keep-separate-metadata-adapter/v1',
      environment_revision:null,
      command_ref:'keep-separate.pointer.ensure/v1',
    };
  }

  return Object.freeze({execute});
}

export function createKeepSeparateMetadataVerifier({
  workspaceRoot,
  observeRepository,
  verifyProjectAuthority,
  io={
    mkdir,
    readFile,
    realpath,
    rename,
    rm,
    writeFile,
  },
}={}){
  need(typeof observeRepository==='function','KEEP_SEPARATE_VERIFIER_OBSERVER_REQUIRED');
  need(typeof verifyProjectAuthority==='function','KEEP_SEPARATE_PROJECT_AUTHORITY_VERIFIER_REQUIRED');

  return async function verify({packet,preflight,execution}={}){
    const expected=pointerRecord(packet,preflight);
    const location=await resolvePointerLocation(workspaceRoot,packet.asset_id,io);
    const actual=await readExisting(location.target,io);

    const pointerPresent=actual!==null;
    const pointerMatches=pointerPresent
      && actual.schema===expected.schema
      && actual.asset_id===expected.asset_id
      && (actual.project_id??null)===(expected.project_id??null)
      && actual.repository===expected.repository
      && actual.source_revision===expected.source_revision
      && actual.classification==='KEEP_SEPARATE'
      && actual.source_preserved===true
      && actual.project_authority_preserved===true
      && actual.merge_git_history===false
      && actual.canonical_project_registry_mutated===false
      && digest(actual)===digest(expected)
      && digest(actual)===execution.output_digest
      && CHECKSUM.test(execution.output_digest??'');

    const observed=await observeRepository({packet:structuredClone(packet),phase:'POST_EXECUTION_VERIFY'});
    const revisionOk=observed?.repository===packet.repository&&observed?.revision===packet.expected_revision;
    const cleanOk=observed?.dirty_state==='CLEAN';
    const authorityOk=await verifyProjectAuthority({
      packet:structuredClone(packet),
      pointer:actual?structuredClone(actual):null,
      observation:structuredClone(observed),
    });

    return [
      {
        name:'SOURCE_REVISION_UNCHANGED',
        status:revisionOk?'PASS':'FAIL',
        evidence_ref:revisionOk?`OBSERVED:${packet.repository}@${packet.expected_revision}`:'OBSERVED:SOURCE_REVISION_CHANGED',
      },
      {
        name:'DIRTY_STATE_RECHECK',
        status:cleanOk?'PASS':'FAIL',
        evidence_ref:cleanOk?'OBSERVED:SOURCE_WORKTREE_CLEAN':'OBSERVED:SOURCE_WORKTREE_NOT_CLEAN',
      },
      {
        name:'PLAN_ITEM_STILL_READY',
        status:pointerMatches?'PASS':'FAIL',
        evidence_ref:pointerMatches?`READ:${location.relativeRef}#${execution.output_digest}`:'READ:KEEP_SEPARATE_POINTER_MISMATCH',
      },
      {
        name:'PROJECT_AUTHORITY_UNCHANGED',
        status:authorityOk===true?'PASS':'FAIL',
        evidence_ref:authorityOk===true?'VERIFIED:PROJECT_AUTHORITY_UNCHANGED':'VERIFIED:PROJECT_AUTHORITY_CHANGED_OR_UNKNOWN',
      },
    ];
  };
}
