import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const execFileAsync=promisify(execFile);
const need=(c,code)=>{if(!c) throw new Error(code);};
const safeToken=t=>typeof t==='string'&&t.length>0&&!/[;&|><\r\n]/.test(t);

export function parseRegistryCommand(command){
  need(typeof command==='string'&&command.trim(),'PROJECT_COMMAND_UNAVAILABLE');
  need(!/[;&|><\r\n]/.test(command),'PROJECT_COMMAND_UNSAFE');
  const tokens=command.trim().split(/\s+/); need(tokens.every(safeToken),'PROJECT_COMMAND_UNSAFE'); return tokens;
}
function platformExecutable(exe){if(exe==='node') return process.execPath;if(exe==='npm'&&process.platform==='win32') return 'npm.cmd';return exe;}

export function createProjectRuntime({
  readHead=async p=>(await execFileAsync('git',['-C',p,'rev-parse','HEAD'],{windowsHide:true})).stdout.trim(),
  readDirtyPaths=async p=>{
    const out=(await execFileAsync('git',['-C',p,'status','--porcelain=v1','--untracked-files=no'],{windowsHide:true})).stdout.trim();
    return out?out.split(/\r?\n/).filter(Boolean):[];
  },
  runProcess=async ({argv,cwd})=>{
    const [exe,...args]=argv;
    try{const {stdout,stderr}=await execFileAsync(platformExecutable(exe),args,{cwd,windowsHide:true,maxBuffer:32*1024*1024});return{stdout,stderr,exit_code:0};}
    catch(error){return{stdout:error?.stdout??'',stderr:error?.stderr??'',exit_code:Number.isInteger(error?.code)?error.code:1};}
  },
  importModule=async p=>import(pathToFileURL(p).href),
}={}){
  async function assertProject(project){
    need(project&&project.execution_readiness_status==='ACTIVE','PROJECT_NOT_EXECUTION_READY');
    need(typeof project.local_path==='string'&&project.local_path.length>0&&isAbsolute(project.local_path),'PROJECT_LOCAL_PATH_REQUIRED');
    const head=await readHead(project.local_path); need(head===project.head_revision,'PROJECT_REVISION_STALE');
    const dirty=await readDirtyPaths(project.local_path); need(Array.isArray(dirty)&&dirty.length===0,'PROJECT_WORKTREE_DIRTY');
    return head;
  }
  function commandFor(capability,project){
    const a=capability.adapter;
    if(a.kind==='PROJECT_REGISTRY_COMMAND') return parseRegistryCommand(project.commands?.[a.command_key]);
    if(a.kind==='PROJECT_COMMAND'){need(Array.isArray(a.argv)&&a.argv.every(safeToken),'PROJECT_COMMAND_UNSAFE');return [...a.argv];}
    throw new Error('PROJECT_COMMAND_ADAPTER_REQUIRED');
  }
  async function prepareCommand(capability,project){return{kind:'PROJECT_COMMAND',project_id:project.project_id,cwd:project.local_path,argv:commandFor(capability,project)};}
  async function runCommand(capability,project){
    const rev=await assertProject(project); const prepared=await prepareCommand(capability,project); const r=await runProcess({argv:prepared.argv,cwd:prepared.cwd});
    await assertProject(project);
    const ok=(r.exit_code??0)===0;
    return{status:ok?'SUCCEEDED':'FAILED',summary:ok?`${capability.title} 실행 완료`:`${capability.title} 실행 실패`,
      data:{stdout:r.stdout??'',stderr:r.stderr??'',exit_code:r.exit_code??0},
      evidence:[`MEASURED: ${prepared.argv.join(' ')} @${project.project_id}:${rev}`],
      artifacts:[],checks:[{name:capability.id,status:ok?'PASS':'FAIL',detail:`exit=${r.exit_code??0}`}],
      blockers:ok?[]:['PROJECT_COMMAND_FAILED'],external_effect:capability.mode==='EXTERNAL_MUTATION'};
  }
  async function runModule(capability,project,input,executionContext={}){
    const rev=await assertProject(project);
    const entry=resolve(project.local_path,capability.adapter.entrypoint), rel=relative(project.local_path,entry);
    need(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'PROJECT_MODULE_PATH_ESCAPE');
    const mod=await importModule(entry), fn=mod?.[capability.adapter.export]; need(typeof fn==='function','PROJECT_MODULE_EXPORT_MISSING');
    const value=await fn(input,structuredClone(executionContext));
    await assertProject(project);
    if(value&&['SUCCEEDED','HOLD','FAILED'].includes(value.status)) return value;
    return{status:'SUCCEEDED',summary:`${capability.title} 완료`,data:value,evidence:[`READ: ${capability.adapter.entrypoint}#${capability.adapter.export} @${project.project_id}:${rev}`],artifacts:[],checks:[{name:capability.id,status:'PASS'}],blockers:[],external_effect:false};
  }
  return Object.freeze({assertProject,prepareCommand,runCommand,runModule});
}
