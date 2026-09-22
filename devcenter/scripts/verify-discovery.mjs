import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from '../portal/node_modules/typescript/lib/typescript.js';
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../portal/app/discovery-model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context,{timeout:1000});
const {saveVersion,submitOnce,startSearch,finishSearch,emptySearch}=context.exports;
const original=Object.freeze({value:'initial',version:1});const a=saveVersion(original,1,'A',true);assert.equal(a.document.version,2);assert.equal(original.value,'initial');
const b=saveVersion(a.document,1,'B',true);assert.equal(b.status,'conflict');assert.equal(b.document.value,'A');
assert.equal(saveVersion(a.document,1,'B',false).document.value,'B');assert.equal(saveVersion(a.document,2,'merged',true).status,'saved');
for(const n of [NaN,Infinity,0,1.5])assert.throws(()=>saveVersion(original,n,'A',true));assert.throws(()=>saveVersion(original,1,' ',true));assert.throws(()=>saveVersion({...original,version:Number.MAX_SAFE_INTEGER},1,'A',false));
// Both editor arrival orders retain the first accepted result until explicit refresh.
for(const names of [['A','B'],['B','A']]){let d=original;d=saveVersion(d,1,names[0],true).document;assert.equal(saveVersion(d,1,names[1],true).document.value,names[0]);}
const first=submitOnce({rows:[]},'key','memo',true);assert.equal(first.ledger.rows.length,1);
const repeat=submitOnce(first.ledger,'key','memo',true);assert.equal(repeat.result,first.result);assert.equal(repeat.status,'replayed');assert.equal(repeat.ledger.rows.length,1);
assert.equal(submitOnce(first.ledger,'key','changed',true).status,'conflict');assert.equal(submitOnce(first.ledger,'key','changed',true).result,null);
assert.equal(submitOnce(first.ledger,'new-key','memo',true).ledger.rows.length,2);assert.equal(submitOnce(first.ledger,'key ','memo',true).ledger.rows.length,2);assert.equal(submitOnce(first.ledger,'KEY','memo',true).ledger.rows.length,2);assert.equal(submitOnce(first.ledger,'key','memo',false).ledger.rows.length,2);
for(const key of ['__proto__','constructor','toString']){const x=submitOnce({rows:[]},key,'a',true);assert.equal(submitOnce(x.ledger,key,'a',true).status,'replayed');}
assert.throws(()=>submitOnce({rows:[]},' ','a',true));assert.throws(()=>submitOnce({rows:[]},'key','a'.repeat(121),true));
let full={rows:[]};for(let i=0;i<30;i++)full=submitOnce(full,'k'+i,'a',true).ledger;assert.throws(()=>submitOnce(full,'new','a',true));assert.equal(submitOnce(full,'k0','a',true).status,'replayed');
const permutations=a=>a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>i!==j)).map(rest=>[v,...rest])):[[]];
// Exhaust all 24 completion orders for four issued requests, not only one happy path.
for(const order of permutations([1,2,3,4])){let state=emptySearch();for(let i=1;i<=4;i++)state=startSearch(state,'q'+i);for(const id of order)state=finishSearch(state,id,true).state;assert.equal(state.visible,'q4');assert.equal(state.pending.length,0);}
let race=startSearch(startSearch(emptySearch(),'old'),'new');race=finishSearch(race,2,false).state;race=finishSearch(race,1,false).state;assert.equal(race.visible,'old');assert.throws(()=>finishSearch(race,1,true));
assert.throws(()=>startSearch(emptySearch(),' '));let queued=emptySearch();for(let i=0;i<10;i++)queued=startSearch(queued,'q');assert.throws(()=>startSearch(queued,'overflow'));
console.log('PASS: version conflict vs overwrite, refreshed save, idempotent replay vs payload conflict, bounds, inert special keys, all 24 response orders. In-memory models only.');
