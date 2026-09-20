import { createHash } from 'node:crypto';
import { lstat, mkdir, realpath, symlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

const need=(condition,code)=>{if(!condition) throw new Error(code);};
const clean=value=>String(value??'').normalize('NFKC').trim();
const ASSET_ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const AREAS=new Set(['headquarters','subsidiaries']);

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const digest=value=>`sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;

function safeUnder(root,target,code='COLOCATE_PATH_ESCAPE'){
  const rel=relative(root,target);
  need(rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel),code);
}

async function pathExists(path){
  try{await lstat(path);return true;}
  catch(error){if(error?.code==='ENOENT') return false;throw error;}
}

function resolveArea(areaByProject,projectId){
  let area=null;
  if(areaByProject instanceof Map) area=areaByProject.get(projectId)??null;
  else area=areaByProject?.[projectId]??null;
  area=clean(area);
  need(AREAS.has(area),'COLOCATE_WORKSPACE_AREA_REQUIRED');
  return area;
}

async function resolvePaths({workspaceRoot,areaByProject,packet}){
  need(packet?.schema==='ai-core-integration-work-packet/v1','INTEGRATION_WORK_PACKET_REQUIRED');
  need(packet.classification==='COLOCATE_ONLY','COLOCATE_CLASSIFICATION_REQUIRED');
  need(packet.action_kind==='FILESYSTEM_RELOCATION','COLOCATE_ACTION_KIND_REQUIRED');
  need(ASSET_ID.test(packet.asset_id??''),'COLOCATE_ASSET_ID_INVALID');
  need(typeof packet.current_path==='string'&&isAbsolute(packet.current_path),'COLOCATE_SOURCE_PATH_REQUIRED');

  const area=resolveArea(areaByProject,packet.project_id);
  need(typeof workspaceRoot==='string'&&isAbsolute(workspaceRoot),'COLOCATE_WORKSPACE_ROOT_REQUIRED');

  let realWorkspace;
  try{realWorkspace=await realpath(resolve(workspaceRoot));}
  catch{throw new Error('COLOCATE_WORKSPACE_ROOT_MISSING');}

  let realSource;
  try{realSource=await realpath(resolve(packet.current_path));}
  catch{throw new Error('COLOCATE_SOURCE_PATH_MISSING');}

  const areaPath=resolve(realWorkspace,area);
  safeUnder(realWorkspace,areaPath);
  await mkdir(areaPath,{recursive:true});
  const realArea=await realpath(areaPath);
  safeUnder(realWorkspace,realArea);

  const target=resolve(realArea,packet.asset_id);
  safeUnder(realArea,target);
  return {
    area,
    realWorkspace,
    realSource,
    realArea,
    target,
    relativeTarget:relative(realWorkspace,target).replaceAll('\\','/'),
  };
}

function projectionRecord(packet,preflight,paths){
  need(preflight?.schema==='ai-core-integration-preflight/v1'&&preflight.status==='SEALED','COLOCATE_PREFLIGHT_REQUIRED');
  need(preflight.packet_id===packet.packet_id,'COLOCATE_PREFLIGHT_PACKET_MISMATCH');
  need(preflight.repository===packet.repository,'COLOCATE_PREFLIGHT_REPOSITORY_MISMATCH');
  need(preflight.expected_revision===packet.expected_revision,'COLOCATE_PREFLIGHT_REVISION_MISMATCH');

  return {
    schema:'ai-core-group-colocation-projection/v1',
    asset_id:packet.asset_id,
    project_id:packet.project_id,
    repository:packet.repository,
    source_revision:packet.expected_revision,
    source_path:paths.realSource,
    workspace_area:paths.area,
    workspace_path:paths.target,
    classification:'COLOCATE_ONLY',
    plan_id:packet.plan_id,
    packet_id:packet.packet_id,
    preflight_digest:preflight.seal_digest,
    source_moved:false,
    git_history_preserved:true,
    source_ssot_preserved:true,
    deploy_boundary_preserved:true,
  };
}

async function ensureProjectionLink(paths){
  if(await pathExists(paths.target)){
    let existing;
    try{existing=await realpath(paths.target);}
    catch{throw new Error('COLOCATE_TARGET_UNRESOLVABLE');}
    need(existing===paths.realSource,'COLOCATE_TARGET_CONFLICT');
    return {created:false,resolved:existing};
  }

  const type=process.platform==='win32'?'junction':'dir';
  try{
    await symlink(paths.realSource,paths.target,type);
  }catch(error){
    if(error?.code!=='EEXIST') throw error;
  }

  let resolved;
  try{resolved=await realpath(paths.target);}
  catch{throw new Error('COLOCATE_TARGET_UNRESOLVABLE');}
  need(resolved===paths.realSource,'COLOCATE_TARGET_CONFLICT');
  return {created:true,resolved};
}

export function createColocateOnlyAdapter({workspaceRoot,areaByProject}={}){
  async function execute({packet,preflight}={}){
    const paths=await resolvePaths({workspaceRoot,areaByProject,packet});
    const record=projectionRecord(packet,preflight,paths);
    const link=await ensureProjectionLink(paths);
    const outputDigest=digest(record);

    return {
      status:'SUCCEEDED',
      performed:true,
      output_refs:[`workspace-link:${paths.relativeTarget}`],
      output_digest:outputDigest,
      evidence_refs:[
        `SOURCE:${packet.repository}@${packet.expected_revision}`,
        `LINK:${paths.relativeTarget}->${paths.realSource}`,
        `SOURCE_MOVED:false`,
      ],
      deterministic:true,
      executor_version:'colocate-only-adapter/v1',
      environment_revision:null,
      command_ref:link.created?'colocate.link.create/v1':'colocate.link.ensure/v1',
    };
  }

  return Object.freeze({execute});
}

export function createColocateOnlyVerifier({
  workspaceRoot,
  areaByProject,
  observeRepository,
  verifyPathDependencies,
}={}){
  need(typeof observeRepository==='function','COLOCATE_VERIFIER_OBSERVER_REQUIRED');
  need(typeof verifyPathDependencies==='function','COLOCATE_PATH_DEPENDENCY_VERIFIER_REQUIRED');

  return async function verify({packet,preflight,execution}={}){
    const paths=await resolvePaths({workspaceRoot,areaByProject,packet});
    const expected=projectionRecord(packet,preflight,paths);

    let targetResolved=null;
    try{targetResolved=await realpath(paths.target);}catch{}
    const linkMatches=targetResolved===paths.realSource;
    const digestMatches=linkMatches&&digest(expected)===execution.output_digest;

    const observed=await observeRepository({packet:structuredClone(packet),phase:'POST_EXECUTION_VERIFY'});
    const revisionOk=observed?.repository===packet.repository&&observed?.revision===packet.expected_revision;
    const cleanOk=observed?.dirty_state==='CLEAN';

    const dependencyOk=await verifyPathDependencies({
      packet:structuredClone(packet),
      source_path:paths.realSource,
      workspace_path:paths.target,
      workspace_area:paths.area,
      source_moved:false,
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
        status:digestMatches?'PASS':'FAIL',
        evidence_ref:digestMatches?`READLINK:${paths.relativeTarget}#${execution.output_digest}`:'READLINK:COLOCATION_PROJECTION_MISMATCH',
      },
      {
        name:'PATH_DEPENDENCY_CHECK',
        status:dependencyOk===true?'PASS':'FAIL',
        evidence_ref:dependencyOk===true?'VERIFIED:SOURCE_PATH_DEPENDENCIES_PRESERVED':'VERIFIED:SOURCE_PATH_DEPENDENCIES_UNKNOWN_OR_CHANGED',
      },
    ];
  };
}
