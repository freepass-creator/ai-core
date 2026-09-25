import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildProjectCapsule } from './project-capsule.mjs';

const execFileAsync=promisify(execFile);
const need=(condition,code)=>{if(!condition) throw new Error(code);};
const repoShape=value=>typeof value==='string'&&/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);

async function defaultGh(args){
  const {stdout}=await execFileAsync('gh',['api',...args],{windowsHide:true,maxBuffer:64*1024*1024});
  return JSON.parse(stdout);
}
async function defaultGhText(args){
  const {stdout}=await execFileAsync('gh',['api',...args],{windowsHide:true,maxBuffer:8*1024*1024});
  return stdout;
}
function decodeContent(payload){
  if(payload?.encoding!=='base64'||typeof payload.content!=='string') return null;
  return Buffer.from(payload.content.replace(/\n/g,''),'base64').toString('utf8');
}

export function createGitHubProjectInspector({gh=defaultGh,clock=Date.now}={}){
  return async function inspect({project_id,repository,default_branch=null}){
    need(typeof project_id==='string'&&/^[a-z][a-z0-9-]{1,62}$/.test(project_id),'PROJECT_ID_INVALID');
    need(repoShape(repository),'REPOSITORY_INVALID');
    const meta=await gh([`repos/${repository}`]);
    const repositoryDefaultBranch=meta?.default_branch;
    need(typeof repositoryDefaultBranch==='string'&&repositoryDefaultBranch.length>0,'DEFAULT_BRANCH_REQUIRED');
    need(default_branch===null||default_branch===repositoryDefaultBranch,'DEFAULT_BRANCH_MISMATCH');
    const branch=repositoryDefaultBranch;
    const commit=await gh([`repos/${repository}/commits/${encodeURIComponent(branch)}`]);
    const revision=commit?.sha;
    need(typeof revision==='string'&&/^[0-9a-f]{40}$/.test(revision),'SUBJECT_REVISION_INVALID');
    const tree=await gh([`repos/${repository}/git/trees/${revision}?recursive=1`]);
    need(Array.isArray(tree?.tree)&&tree.truncated!==true,'PROJECT_TREE_INCOMPLETE');
    const treePaths=tree.tree.filter(item=>item.type==='blob').map(item=>item.path);
    let packageJson=null;
    if(treePaths.includes('package.json')){
      const payload=await gh([`repos/${repository}/contents/package.json?ref=${revision}`]);
      const text=decodeContent(payload);
      need(text!==null,'PACKAGE_JSON_UNREADABLE');
      try{packageJson=JSON.parse(text);}catch{throw new Error('PACKAGE_JSON_INVALID');}
    }
    let readmeText=null;
    if(treePaths.includes('README.md')){
      const payload=await gh([`repos/${repository}/contents/README.md?ref=${revision}`]);
      readmeText=decodeContent(payload);
      need(readmeText!==null&&readmeText.length>0,'README_UNREADABLE');
    }
    return buildProjectCapsule({
      project_id,
      repository,
      default_branch:branch,
      subject_revision:revision,
      observed_at:new Date(clock()).toISOString(),
      tree_paths:treePaths,
      package_json:packageJson,
      readme_text:readmeText,
    });
  };
}

export const inspectGitHubProject=createGitHubProjectInspector();
