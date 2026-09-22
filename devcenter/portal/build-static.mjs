// Pure JavaScript static packager. Does not execute native bundlers or alter policy.
// FP4 files remain authoritative; generated bundles are derived, hash-pinned artifacts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';
import {fileURLToPath} from 'node:url';
import {preparePortalSourceSnapshot,typecheckPortal} from '../scripts/typecheck-gate.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),fp=preparePortalSourceSnapshot(root),finalOut=path.join(root,'static');
const pinnedSources=JSON.parse(fs.readFileSync(path.join(root,'public/catalog/source-code.json'),'utf8'));
process.on('exit',()=>fs.rmSync(fp,{recursive:true,force:true}));
const names={buttons:'buttons.tsx',inputs:'form-controls.tsx',table:'table.tsx',box:'detail.tsx',tokens:'tokens.ts'};
// Stop before creating or replacing output when type or syntax checks fail.
typecheckPortal(root,fp,false);
const expectedSourceHashes=Object.fromEntries(Object.entries(names).map(([k,f])=>{const bytes=fs.readFileSync(path.join(fp,'components/ui',f));return [k,crypto.createHash('sha256').update(bytes).digest('hex')]}));
const sourcePath=(logical)=>path.join(fp,logical.replace(/^freepasserp4\//,''));
const prior=path.join(finalOut,'source-manifest.json');
if(fs.existsSync(prior)&&!process.argv.includes('--refresh-sources')){
 for(const item of JSON.parse(fs.readFileSync(prior,'utf8')).sources){
  const current=sourcePath(item.path);
  if(!fs.existsSync(current)||crypto.createHash('sha256').update(fs.readFileSync(current)).digest('hex')!==item.sha256)throw Error('Source drift: '+item.path+'; re-inspect and use --refresh-sources only after review.');
 }
}
const discoveryModelPath=path.join(root,'app/discovery-model.ts'),discoverySource=fs.readFileSync(discoveryModelPath,'utf8'),discoverySha=crypto.createHash('sha256').update(discoverySource).digest('hex');
const out=fs.mkdtempSync(path.join(root,'.static-build-'));
const modules=[],ids=new Map(),manifest=[],manifestFiles=new Map(),sourceCache=new Map();
const external={react:'react/cjs/react.production.js','react/jsx-runtime':'react/cjs/react-jsx-runtime.production.js','react-dom':'react-dom/cjs/react-dom.production.js','react-dom/client':'react-dom/cjs/react-dom-client.production.js',scheduler:'scheduler/cjs/scheduler.production.js','lucide-react':'lucide-react/dist/cjs/lucide-react.js'};
function find(p){for(const x of [p,p+'.ts',p+'.tsx',p+'.js',path.join(p,'index.ts')])if(fs.existsSync(x)&&fs.statSync(x).isFile())return x;throw Error('Missing source: '+p)}
function resolve(id,from){if(external[id])return find(path.join(root,'node_modules',external[id]));if(id.startsWith('@fp4/'))return find(path.join(fp,id.slice(5)));if(id.startsWith('@/'))return find(path.join(from.startsWith(fp)?fp:root,id.slice(2)));if(id.startsWith('.'))return find(path.resolve(path.dirname(from),id));throw Error('Unapproved dependency '+id+' in '+from)}
function add(file){file=path.resolve(file);if(ids.has(file))return ids.get(file);const id=modules.length;ids.set(file,id);modules.push('');let src=file===discoveryModelPath?discoverySource:fs.readFileSync(file,'utf8');if(file===path.join(root,'app/discovery.tsx'))src=src.replace('__DEVCENTER_DISCOVERY_SOURCE_SHA__',discoverySha);if(file===path.join(root,'app/catalog-input.ts'))src=src.replace('__DEVCENTER_SOURCE_HASHES__',JSON.stringify(expectedSourceHashes).replaceAll('\\','\\\\').replaceAll("'","\\'"));
 if(file.startsWith(fp)){const logical='freepasserp4/'+path.relative(fp,file).replaceAll('\\','/');sourceCache.set(file,src);manifest.push({path:logical,sha256:crypto.createHash('sha256').update(src).digest('hex')});manifestFiles.set(logical,file);}
 if(/\.[tj]sx?$/.test(file)&&!file.includes('node_modules')){src=ts.transpileModule(src,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;}
 src=src.replace(/require\(["']([^"']+)["']\)/g,(_,dep)=>dep.endsWith('.css')?'({})':`require(${add(resolve(dep,file))})`);
 modules[id]=`function(module,exports,require){\n${src}\n}`;return id;
}
const center=add(path.join(root,'app/center.tsx')),specimen=add(path.join(root,'app/specimen/page.tsx')),dom=add(resolve('react-dom/client',root)),react=add(resolve('react',root));
const bundle=`(()=>{'use strict';const process={env:{NODE_ENV:'production'}};const modules=[${modules.join(',\n')}],cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,require);return m.exports;}const component=location.pathname.includes('specimen')?${specimen}:${center};require(${dom}).createRoot(document.getElementById('root')).render(require(${react}).createElement(require(component).default));})();`;
fs.writeFileSync(path.join(out,'app.js'),bundle);
const globals=fs.readFileSync(path.join(root,'app/globals.css'),'utf8');
let css=globals.slice(globals.indexOf('body{font-family:var(--font-geist-sans)')).replace('[data-active]','[data-active="true"]');
const foundation=fs.readFileSync(path.join(root,'app/foundation.css'),'utf8');
fs.writeFileSync(path.join(out,'center.css'),foundation+css);
const sourceCss=fs.readFileSync(path.join(fp,'app/globals.css'),'utf8');fs.writeFileSync(path.join(out,'specimen.css'),sourceCss+'\n'+css.slice(css.indexOf('.spec-label'),css.indexOf('@media(max-width:1100px)'))+css.slice(css.indexOf('.button-workshop')));
sourceCache.set(path.join(fp,'app/globals.css'),sourceCss);
manifest.push({path:'freepasserp4/app/globals.css',sha256:crypto.createHash('sha256').update(sourceCss).digest('hex')});manifestFiles.set('freepasserp4/app/globals.css',path.join(fp,'app/globals.css'));
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify({kind:'derived_build_not_authority',sources:manifest},null,2));
const html=(spec)=>`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>개발센터 · 규격과 원자</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/${spec?'specimen':'center'}.css"></head><body><div id="root"></div><script src="/app.js" defer></script></body></html>`;
fs.writeFileSync(path.join(out,'index.html'),html(false));fs.mkdirSync(path.join(out,'specimen'),{recursive:true});fs.writeFileSync(path.join(out,'specimen/index.html'),html(true));
fs.cpSync(path.join(root,'public/catalog'),path.join(out,'catalog'),{recursive:true,filter:p=>!['styles.json','functions.json'].includes(path.basename(p))});
// The browser guide is derived from the same entry document other sessions read.
fs.copyFileSync(path.join(root,'../docs/SESSION-TOUR.md'),path.join(out,'session-tour.md'));
fs.copyFileSync(path.join(root,'../capabilities/IMPROVEMENTS.md'),path.join(out,'function-improvements.md'));
const functionData=JSON.parse(fs.readFileSync(path.join(root,'public/catalog/functions.json'),'utf8'));
const moduleById=new Map(functionData.modules.map(m=>[m.id,m]));
const duplicatePaths=new Map(functionData.duplicates.flatMap(g=>g.moduleIds.map(id=>[id,g.moduleIds.filter(other=>other!==id).map(other=>moduleById.get(other).path)])));
const functionModuleIndex=new Map(functionData.modules.map((m,i)=>[m.id,i]));
fs.writeFileSync(path.join(out,'catalog/function-search.json'),JSON.stringify({modules:functionData.modules.map(m=>[m.path,m.project]),entries:functionData.functions.map(f=>[f.name,functionModuleIndex.get(f.moduleId),f.line])}));
const functionOut=path.join(out,'catalog/functions');fs.mkdirSync(functionOut,{recursive:true});
const functionProjects=functionData.projects.map(p=>{const filename=crypto.createHash('sha256').update(p.name).digest('hex').slice(0,16)+'.json';const modules=functionData.modules.filter(m=>m.project===p.name).map(m=>({...m,consumerPaths:[...new Set(m.consumers)].map(id=>moduleById.get(id).path),sameHashPaths:duplicatePaths.get(m.id)||[]}));const functions=functionData.functions.filter(f=>f.project===p.name);fs.writeFileSync(path.join(functionOut,filename),JSON.stringify({modules,functions}));return {...p,moduleCount:modules.length,functionCount:functions.length,sourceFile:'/catalog/functions/'+filename}});
fs.writeFileSync(path.join(out,'catalog/functions-summary.json'),JSON.stringify({capturedAt:functionData.capturedAt,coverage:functionData.coverage,limitations:functionData.limitations,projects:functionProjects}));
const styles=JSON.parse(fs.readFileSync(path.join(root,'public/catalog/styles.json'),'utf8'));
const cssOutput=path.join(out,'catalog/styles');fs.mkdirSync(cssOutput,{recursive:true});
styles.files=styles.files.map(f=>{const filename=f.sha256+'.json';fs.writeFileSync(path.join(cssOutput,filename),JSON.stringify({source:f.source,displaySha256:f.displaySha256||crypto.createHash('sha256').update(f.source||'').digest('hex')}));return {...f,source:'',sourceFile:'/catalog/styles/'+filename,hasSource:!!f.source}});
styles.inlineStyles=(styles.inlineStyles||[]).map(f=>{const filename='inline-'+f.id+'.json';fs.writeFileSync(path.join(cssOutput,filename),JSON.stringify({markers:f.markers}));return {...f,markerCount:f.markers.length,markers:[],sourceFile:'/catalog/styles/'+filename}});
fs.writeFileSync(path.join(out,'catalog/styles.json'),JSON.stringify(styles));
const catalogFile=path.join(out,'catalog/index.json'),catalog=JSON.parse(fs.readFileSync(catalogFile,'utf8'));
catalog.coverage.extractedRuleLines=catalog.documents.reduce((n,d)=>n+d.ruleLinesFound,0);
catalog.coverage.displayedRuleLines=catalog.documents.reduce((n,d)=>n+d.rules.length,0);
fs.writeFileSync(catalogFile,JSON.stringify(catalog));
fs.writeFileSync(path.join(out,'THIRD-PARTY-LICENSES.txt'),['react','react-dom','scheduler','lucide-react'].map(pkg=>pkg+'\n'+fs.readFileSync(path.join(root,'node_modules',pkg,'LICENSE'),'utf8')).join('\n\n'));
fs.copyFileSync(path.join(root,'../quality/COMPLETION.md'),path.join(out,'completion.md'));
fs.writeFileSync(path.join(out,'catalog/discovery-source.json'),JSON.stringify({path:'devcenter/portal/app/discovery-model.ts',sha256:crypto.createHash('sha256').update(discoverySource).digest('hex'),source:discoverySource}));
const stagedManifest=path.join(out,'source-manifest.json');
const cardResult=spawnSync(process.execPath,[path.join(root,'../scripts/card-audit.mjs'),'--manifest',stagedManifest,'--report',path.join(out,'catalog/standard-cards.json')],{cwd:root,encoding:'utf8',windowsHide:true});
if(cardResult.status!==0)throw Error('Card audit failed: '+cardResult.stderr);
const acceptanceResult=spawnSync(process.execPath,[path.join(root,'../scripts/report-acceptance.mjs'),'--manifest',stagedManifest,'--app',path.join(out,'app.js'),'--output',path.join(out,'catalog/acceptance.json')],{cwd:root,encoding:'utf8',windowsHide:true});
if(acceptanceResult.status!==0)throw Error('Acceptance report failed: '+acceptanceResult.stderr);
const inspectionResult=spawnSync(process.execPath,[path.join(root,'../scripts/inspect-project.mjs'),'--target',path.join(root,'..'),'--acceptance',path.join(out,'catalog/acceptance.json'),'--output',path.join(out,'catalog/inspection.json')],{cwd:root,encoding:'utf8',windowsHide:true});
if(inspectionResult.status===3||inspectionResult.error)throw Error('Inspection report failed: '+(inspectionResult.stderr||inspectionResult.error));
fs.cpSync(path.join(root,'../capabilities/packages'),path.join(out,'packages'),{recursive:true});
// Refresh displayed source from the exact inputs used for this build.
const sources={};for(const [k,f]of Object.entries(names)){const p=path.join(fp,'components/ui',f),source=sourceCache.get(p);if(source===undefined)throw Error('Source was not compiled: '+p);sources[k]={path:`freepasserp4/components/ui/${f}`,source,sha256:crypto.createHash('sha256').update(source).digest('hex')}}
sources.format=pinnedSources.format;
fs.writeFileSync(path.join(out,'catalog/source-code.json'),JSON.stringify(sources));
for(const item of manifest)if(crypto.createHash('sha256').update(fs.readFileSync(manifestFiles.get(item.path))).digest('hex')!==item.sha256)throw Error('Source changed during build: '+item.path);
for(const f of ['index.html','app.js','specimen/index.html','catalog/index.json','catalog/source-code.json','catalog/inspection.json','source-manifest.json'])if(!fs.statSync(path.join(out,f)).size)throw Error('Empty output: '+f);
if(fs.readFileSync(discoveryModelPath,'utf8')!==discoverySource)throw Error('Discovery source changed during build');
// Only complete, validated builds replace the served directory. Retain previous output for rollback.
const previous=path.join(root,'.static-previous-'+Date.now());
if(fs.existsSync(finalOut))fs.renameSync(finalOut,previous);
try{fs.renameSync(out,finalOut)}catch(e){if(fs.existsSync(previous))fs.renameSync(previous,finalOut);throw e}
// Sites accepts dist as a static output root. It is packaged only after this command succeeds.
const dist=path.join(root,'dist'),distStage=fs.mkdtempSync(path.join(root,'.dist-build-')),distPrevious=path.join(root,'.dist-previous-'+Date.now());
fs.cpSync(finalOut,distStage,{recursive:true});
if(fs.existsSync(dist))fs.renameSync(dist,distPrevious);
try{fs.renameSync(distStage,dist)}catch(e){if(fs.existsSync(distPrevious))fs.renameSync(distPrevious,dist);throw e}
console.log(JSON.stringify({modules:modules.length,originalSources:manifest.length,bundleBytes:Buffer.byteLength(bundle),output:finalOut}));
