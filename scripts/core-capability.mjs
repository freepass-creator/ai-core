import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeWork, validateWorkMap } from '../src/routing/work-router.mjs';
import { validateCapabilityRegistryReferences } from '../src/engine/capability-registry.mjs';
import { createCapabilityEngine } from '../src/engine/capability-engine.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2), action=argv.shift();
if(!['plan','run'].includes(action)){
  console.error('사용법: npm run core:capability -- plan|run "<요청>" [--order ORD-...] [--work WORK-...] [--input file.json] [--perform]');
  process.exit(2);
}
const take=(key)=>{const i=argv.indexOf(key); return i>=0?argv[i+1]:null;};
const skip=new Set();
for(const key of ['--order','--work','--input']){const i=argv.indexOf(key);if(i>=0){skip.add(i);skip.add(i+1);}}
const performIndex=argv.indexOf('--perform');if(performIndex>=0)skip.add(performIndex);
const text=argv.filter((_,i)=>!skip.has(i)).join(' ').trim();
if(!text){console.error('요청 문장이 필요합니다.');process.exit(2);}
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const [workMap,projectRegistry,capabilityRegistry,input]=await Promise.all([
  readJson(join(root,'registry','work-map.json')),
  readJson(join(root,'registry','projects.json')),
  readJson(join(root,'registry','capabilities.json')),
  take('--input')?readJson(resolve(take('--input'))):Promise.resolve({})
]);
const mapValidation=validateWorkMap(workMap,projectRegistry,capabilityRegistry);
if(mapValidation.status!=='VALID'){console.error(JSON.stringify(mapValidation,null,2));process.exit(2);}
try{validateCapabilityRegistryReferences(capabilityRegistry,projectRegistry);}catch(e){console.error(e.message);process.exit(2);}
const route=routeWork(text,{workMap,projectRegistry,capabilityRegistry});
const engine=createCapabilityEngine({capabilityRegistry,projectRegistry,executorIdentity:process.env.AI_CORE_EXECUTOR??null});
const orderId=take('--order'), workId=take('--work');
const result=action==='plan'
  ? {route,plan:engine.plan({route,orderId,workId})}
  : await engine.run({route,orderId,workId,input,perform:argv.includes('--perform')});
console.log(JSON.stringify(result,null,2));
const status=action==='plan'?result.plan.status:result.status;
if(status==='HOLD'||status==='FAILED') process.exitCode=1;
