const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),ts=require('../portal/node_modules/typescript');
const portal=path.resolve(__dirname,'../portal');process.chdir(portal);
const context={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(portal,'app/reuse-model.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const render=context.exports.reuseRecipe;
const samples=[['83,000km','1048576'],['','0'],['8.3만km','1024'],['\"; globalThis.compromised=true; //','NaN']];
const config=ts.readConfigFile(path.join(portal,'tsconfig.gallery.json'),ts.sys.readFile),parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,portal);
const file=path.join(portal,'app/__reuse_check__.ts');let source="import {kmValue,fileSizeText} from '@/lib/format';\n";
samples.forEach((args,i)=>{source+='{\n'+render(...args).replace(/^import .*\n/,'').replace('export const preview',`const preview${i}`)+'}\n'});
const host=ts.createCompilerHost(parsed.options),get=host.getSourceFile.bind(host);host.getSourceFile=(p,...args)=>path.resolve(p)===file?ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true):get(p,...args);
const program=ts.createProgram([file],parsed.options,host);assert.equal(ts.getPreEmitDiagnostics(program).length,0);
for(const args of samples){const run={exports:{},require:(name)=>{assert.equal(name,'@/lib/format');return {kmValue:x=>x,fileSizeText:x=>x}}};vm.runInNewContext(ts.transpileModule(render(...args),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,run,{timeout:1000});assert.equal(run.exports.preview.mileage,args[0]);assert.equal(run.compromised,undefined)}
assert(['source','input','output','empty','effects','dependencies','limits'].every(k=>context.exports.reuseContract[k]));
console.log('PASS: 4 complete recipes typechecked; quoted input remains data; reuse contract fields present.');
