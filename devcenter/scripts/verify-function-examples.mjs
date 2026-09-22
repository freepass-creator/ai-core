import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import ts from '../portal/node_modules/typescript/lib/typescript.js';
const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.resolve(here,'../freepasserp4/lib/format.ts'),source=fs.readFileSync(file,'utf8');
// This one reviewed module contains only local formatting helpers; no imports or external calls.
const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
assert(!parsed.statements.some(s=>ts.isImportDeclaration(s)||ts.isImportEqualsDeclaration(s)));
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const context={exports:{}};vm.runInNewContext(code,context,{timeout:1000,codeGeneration:{strings:false,wasm:false}});
const {kmValue,fileSizeText}=context.exports;
for(const [input,expected] of [['83,000km',83000],['8.3만km',83000],['83000',83000],['',0],['—',0]])assert.equal(kmValue(input),expected);
for(const [input,expected] of [[1048576,'1.0MB'],[1024,'1KB'],[0,''],[-1,''],[NaN,''],[Infinity,'']])assert.equal(fileSizeText(input),expected);
console.log(JSON.stringify({result:'PASS',cases:11,path:file,sha256:crypto.createHash('sha256').update(source).digest('hex'),scope:'selected examples only; no API or business mutation'}));
