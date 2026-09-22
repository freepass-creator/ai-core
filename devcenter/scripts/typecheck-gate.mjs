import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import ts from '../portal/node_modules/typescript/lib/typescript.js';
export function typecheckGate(root,configs=['tsconfig.json','tsconfig.gallery.json'],optionsByConfig={}){
 for(const name of configs){
  const file=path.join(root,name),read=ts.readConfigFile(file,ts.sys.readFile);
  if(read.error)throw Error('Typecheck gate failed:\n'+ts.flattenDiagnosticMessageText(read.error.messageText,'\n'));
  const config=ts.parseJsonConfigFileContent(read.config,ts.sys,root,undefined,file);
  const program=ts.createProgram(config.fileNames,{...config.options,...(optionsByConfig[name]??{}),noEmit:true});
  const errors=[...config.errors,...ts.getPreEmitDiagnostics(program)].filter(d=>d.category===ts.DiagnosticCategory.Error);
  if(errors.length)throw Error('Typecheck gate failed:\n'+ts.formatDiagnostics(errors,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
 }
}

const SNAPSHOT_FILES={buttons:'buttons.tsx',inputs:'form-controls.tsx',table:'table.tsx',box:'detail.tsx',tokens:'tokens.ts'};
const sha256=(value)=>crypto.createHash('sha256').update(value).digest('hex');

export function preparePortalSourceSnapshot(root){
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'public/catalog/source-code.json'),'utf8'));
 const styles=JSON.parse(fs.readFileSync(path.join(root,'public/catalog/styles.json'),'utf8'));
 const snapshot=fs.mkdtempSync(path.join(os.tmpdir(),'devcenter-portal-source-'));
 fs.symlinkSync(path.join(root,'node_modules'),path.join(snapshot,'node_modules'),'junction');
 const ui=path.join(snapshot,'components/ui');fs.mkdirSync(ui,{recursive:true});
 for(const [key,file] of Object.entries(SNAPSHOT_FILES)){
  const item=catalog[key];
  if(!item||item.path!==`freepasserp4/components/ui/${file}`||sha256(item.source)!==item.sha256)throw Error(`Portal source snapshot invalid: ${key}`);
  fs.writeFileSync(path.join(ui,file),item.source);
 }
 const format=catalog.format;
 if(!format||format.path!=='freepasserp4/lib/format.ts'||sha256(format.source)!==format.sha256)throw Error('Portal source snapshot invalid: format');
 fs.mkdirSync(path.join(snapshot,'lib'),{recursive:true});fs.writeFileSync(path.join(snapshot,'lib/format.js'),format.source);
 fs.writeFileSync(path.join(snapshot,'lib/format.d.ts'),"export function man(n:unknown):string;export function manWon(n:unknown):string;export function manShort(n:unknown,opts?:{decimal?:boolean}):string;export function kmDisplay(raw:unknown):string;export function isEvFuel(fuel:unknown):boolean;export function kmValue(raw:unknown):number;export function fileSizeText(n:number):string;\n");
 const globals=styles.files?.find((item)=>item.path==='freepasserp4/app/globals.css');
 if(!globals||!globals.source||sha256(globals.source)!==(globals.displaySha256??globals.sha256))throw Error('Portal globals snapshot invalid');
 fs.mkdirSync(path.join(snapshot,'app'),{recursive:true});fs.writeFileSync(path.join(snapshot,'app/globals.css'),globals.source);
 fs.mkdirSync(path.join(snapshot,'lib/intake'),{recursive:true});
 fs.writeFileSync(path.join(snapshot,'lib/use-mobile.ts'),"import {useEffect,useState} from 'react';\nexport function useIsMobile(){const [mobile,setMobile]=useState(false);useEffect(()=>{const media=matchMedia('(max-width: 767px)');const sync=()=>setMobile(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync)},[]);return mobile}\n");
 fs.writeFileSync(path.join(snapshot,'lib/haptics.ts'),"const noop=()=>{};export const haptic={tap:noop,nav:noop,select:noop,back:noop,impact:noop,success:noop,error:noop};\n");
 fs.writeFileSync(path.join(snapshot,'lib/intake/entities.ts'),"export type EntityRecord=Record<string,unknown>;\n");
 return snapshot;
}

export function typecheckPortal(root,snapshot=preparePortalSourceSnapshot(root),cleanup=true){
 try{
  const paths={baseUrl:root,paths:{'@fp4/*':[`${snapshot.replaceAll('\\','/')}/*`],'@/*':[`${snapshot.replaceAll('\\','/')}/*`]}};
  typecheckGate(root,['tsconfig.json'],{'tsconfig.json':paths});
  typecheckGate(root,['tsconfig.gallery.json'],{'tsconfig.gallery.json':paths});
 }finally{if(cleanup)fs.rmSync(snapshot,{recursive:true,force:true})}
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 const portalRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','portal');
 typecheckPortal(portalRoot);
 console.log('PASS: portal typecheck uses the pinned local source snapshot');
}
