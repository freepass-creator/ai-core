import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compileSharedExtractionCandidate } from '../src/engine/shared-extraction-candidate.mjs';

const args=process.argv.slice(2);
const inputArg=args.find(x=>!x.startsWith('--'));
const outIndex=args.indexOf('--out');
const outArg=outIndex>=0?args[outIndex+1]:null;
if(!inputArg){
  console.error('usage: node scripts/shared-extraction-candidate.mjs <input.json> [--out result.json]');
  process.exit(2);
}
try{
  const input=JSON.parse(await readFile(resolve(inputArg),'utf8'));
  const result=compileSharedExtractionCandidate(input);
  const text=JSON.stringify(result,null,2)+'\n';
  if(outArg) await writeFile(resolve(outArg),text,'utf8');
  process.stdout.write(text);
  process.exitCode=result.assessment.status==='HOLD'?1:0;
}catch(error){
  console.error(error?.message??String(error));
  process.exitCode=2;
}
