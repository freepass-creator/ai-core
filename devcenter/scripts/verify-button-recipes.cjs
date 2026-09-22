// Type-check the actual displayed recipe in all variant/size/disabled/full combinations.
const fs=require('node:fs'),path=require('node:path');
const portal=path.resolve(__dirname,'../portal'),ts=require(path.join(portal,'node_modules/typescript'));
process.chdir(portal);
const source=fs.readFileSync(path.join(portal,'app/button-gallery.tsx'),'utf8');
const literal=source.match(/const code=(`[^;]*?`);/s)?.[1]||source.match(/const code=(`.*?`);/s)?.[1];
if(!literal)throw Error('Displayed recipe template missing');
// This is our own local template, not catalog data or an external source.
const render=new Function('variant','size','disabled','full','return '+literal);
let fixture="import {useState} from 'react';\nimport {Btn,ButtonLabel} from '@/components/ui/buttons';\nimport {Check} from 'lucide-react';\n",count=0;
for(const v of ['solid','ghost','danger','bare'])for(const s of ['sm','md','lg'])for(const d of [false,true])for(const f of [false,true]){
 fixture+=render(v,s,d,f).replace(/^import .*;\n/gm,'').replace('export default function ButtonExample',`function Example${count++}`)+'\n';
}
const config=ts.readConfigFile(path.join(portal,'tsconfig.gallery.json'),ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,portal);
const file=path.join(portal,'app/__recipe_check__.tsx'),host=ts.createCompilerHost(parsed.options),get=host.getSourceFile.bind(host);
host.getSourceFile=(name,...args)=>path.resolve(name)===file?ts.createSourceFile(file,fixture,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX):get(name,...args);
const program=ts.createProgram([file],parsed.options,host),errors=ts.getPreEmitDiagnostics(program);
if(errors.length){console.error(ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>portal,getCanonicalFileName:x=>x,getNewLine:()=>"\n"}));process.exit(1)}
console.log(`PASS: ${count} displayed button recipes type-check against original component props.`);
