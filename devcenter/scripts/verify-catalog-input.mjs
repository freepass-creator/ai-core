import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import ts from '../portal/node_modules/typescript/lib/typescript.js';
const context={exports:{},crypto:webcrypto,TextEncoder};
const read=name=>JSON.parse(fs.readFileSync(new URL(`../portal/static/catalog/${name}.json`,import.meta.url),'utf8'));
const catalog=read('index'),audit=read('atomic-audit'),sources=read('source-code');
const source=fs.readFileSync(new URL('../portal/app/catalog-input.ts',import.meta.url),'utf8').replace('__DEVCENTER_SOURCE_HASHES__',JSON.stringify(Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,v.sha256]))));
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context,{timeout:1000});
const validate=context.exports.validateCatalogInputs;
const valid=await validate(catalog,audit,sources);assert.equal(valid.catalog.documents.length,catalog.coverage.documents);assert.equal(valid.rules.length,audit.rules.length);assert.equal(Object.keys(valid.sources).length,5);
const copy=x=>structuredClone(x),reject=async(c=catalog,a=audit,s=sources)=>assert.rejects(()=>validate(c,a,s));
await reject({});await reject({...catalog,coverage:{...catalog.coverage,documents:catalog.coverage.documents+1}});
{const c=copy(catalog);c.documents[1].id=c.documents[0].id;await reject(c)}
{const c=copy(catalog);c.documents[0].sha256='wrong';await reject(c)}
{const c=copy(catalog);c.documents[0].rules[0].line=0;await reject(c)}
{const c=copy(catalog);c.projects[1].name=c.projects[0].name;await reject(c)}
{const a=copy(audit);a.rules[0].source.sha256='wrong';await reject(catalog,a)}
{const a=copy(audit);a.rules[0].consumption={path:'x',line:1,evidence:'found',sha256:'wrong'};await reject(catalog,a)}
{const s=copy(sources);s.buttons.source+=' changed';await reject(catalog,audit,s)}
{const s=copy(sources);s.buttons.source+=' changed';s.buttons.sha256='0'.repeat(64);await reject(catalog,audit,s)}
{const s=copy(sources);delete s.inputs;await reject(catalog,audit,s)}
console.log('PASS: current catalog triple, counts, IDs, pointers, SHA formats and five displayed source bodies; malformed inputs rejected. Structural validation only.');
