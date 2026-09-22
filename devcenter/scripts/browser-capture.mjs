#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function ensureHttp(url){
  const parsed=new URL(url);
  if(!['http:','https:'].includes(parsed.protocol)) throw new Error('BROWSER_CAPTURE_HTTP_ONLY');
  return parsed.toString();
}
function findChromium(){
  const configured=process.env.DESIGN_CHROMIUM_PATH;
  if(configured) return configured;
  const candidates=process.platform==='win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      ]
    : ['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/usr/bin/google-chrome-stable'];
  return candidates.find((p)=>fs.existsSync(p))??null;
}

export function captureWithChromium(visualPlan,{outputDir,browserPath=findChromium(),capturedAt=new Date().toISOString()}={}){
  if(visualPlan?.contract!=='devcenter-design-visual-plan/v1') throw new Error('BROWSER_CAPTURE_PLAN_INVALID');
  if(visualPlan?.result?.status!=='PLANNED') throw new Error('BROWSER_CAPTURE_PLAN_NOT_READY');
  if(!browserPath) throw new Error('BROWSER_CAPTURE_CHROMIUM_NOT_FOUND');
  fs.mkdirSync(outputDir,{recursive:true});
  const captures=[];
  let browserVersion=null;
  const vr=spawnSync(browserPath,['--version'],{encoding:'utf8',windowsHide:true,timeout:10000});
  if(vr.status===0) browserVersion=(vr.stdout||vr.stderr||'').trim()||null;

  for(const item of visualPlan.captures){
    const target=ensureHttp(item.url);
    const filename=path.resolve(outputDir,path.basename(item.screenshot_ref));
    const args=[
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      `--window-size=${item.viewport.width},${item.viewport.height}`,
      `--lang=${item.locale}`,
      `--virtual-time-budget=${Math.max(1,item.settle_ms)}`,
      `--screenshot=${filename}`,
      target
    ];
    if(process.env.DESIGN_CHROMIUM_NO_SANDBOX==='1') args.splice(1,0,'--no-sandbox');
    const run=spawnSync(browserPath,args,{encoding:'utf8',windowsHide:true,timeout:45000});
    const ok=run.status===0&&fs.existsSync(filename)&&fs.statSync(filename).size>0;
    captures.push(ok?{
      case_id:item.case_id,
      status:'PASS',
      screenshot_ref:item.screenshot_ref,
      sha256:sha256(filename),
      viewport:item.viewport,
      captured_at:new Date().toISOString()
    }:{
      case_id:item.case_id,
      status:'FAIL',
      viewport:item.viewport,
      captured_at:new Date().toISOString(),
      error:(run.error?.message||run.stderr||`exit=${run.status}`).trim().slice(0,2000)
    });
  }
  const failed=captures.filter((c)=>c.status==='FAIL').length;
  return {
    contract:'devcenter-browser-capture-manifest/v1',
    visual_plan_ref:'visual-plan.json',
    adapter:{id:'chromium-cli-v1',browser:path.basename(browserPath),browser_version:browserVersion},
    captures,
    result:{status:failed?'FAIL':'PASS',total:captures.length,failed},
    captured_at:capturedAt
  };
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  const [command,planFile,outputDir,manifestFile]=process.argv.slice(2);
  try{
    if(command!=='capture'||!planFile||!outputDir) throw new Error('usage: browser-capture.mjs capture <visual-plan.json> <output-dir> [capture-manifest.json]');
    const plan=JSON.parse(fs.readFileSync(path.resolve(planFile),'utf8'));
    const manifest=captureWithChromium(plan,{outputDir:path.resolve(outputDir)});
    const json=JSON.stringify(manifest,null,2)+'\n';
    if(manifestFile) fs.writeFileSync(path.resolve(manifestFile),json); else process.stdout.write(json);
    process.exitCode=manifest.result.status==='PASS'?0:2;
  }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message},null,2));
    process.exitCode=1;
  }
}
