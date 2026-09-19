import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectGitHubProject } from '../src/engine/github-project-inspector.mjs';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const args=process.argv.slice(2);
const projectId=args[0];
const outAt=args.indexOf('--output');
const output=outAt>=0?args[outAt+1]:null;
if(!projectId){
  console.error('사용법: npm run project:inspect -- <project_id> [--output path.json]');
  process.exit(2);
}
const registry=JSON.parse(await readFile(resolve(root,'registry/projects.json'),'utf8'));
const project=registry.projects.find(item=>item.project_id===projectId);
if(!project){
  console.error(JSON.stringify({status:'HOLD',reason:'PROJECT_NOT_REGISTERED',project_id:projectId}));
  process.exit(1);
}
try{
  const capsule=await inspectGitHubProject({
    project_id:project.project_id,
    repository:project.repository,
    default_branch:project.default_branch,
  });
  const text=JSON.stringify(capsule,null,2)+'\n';
  if(output){
    const path=resolve(output);
    await mkdir(dirname(path),{recursive:true});
    await writeFile(path,text,{flag:'w'});
  }
  process.stdout.write(text);
  if(capsule.readiness.status!=='READY_FOR_REGISTRY_REVIEW') process.exitCode=1;
}catch(error){
  console.error(JSON.stringify({status:'HOLD',reason:error?.message??'PROJECT_INSPECTION_FAILED',project_id:projectId}));
  process.exitCode=1;
}