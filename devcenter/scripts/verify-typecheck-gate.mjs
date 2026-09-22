import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {typecheckGate} from './typecheck-gate.mjs';
import ts from '../portal/node_modules/typescript/lib/typescript.js';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'devcenter-typecheck-'));
fs.writeFileSync(path.join(root,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,noEmit:true,types:[],target:'ES2022',skipLibCheck:true},files:['sample.ts']}));
fs.writeFileSync(path.join(root,'sample.ts'),'const value: number = "invalid";');
assert.equal((ts.transpileModule(fs.readFileSync(path.join(root,'sample.ts'),'utf8'),{reportDiagnostics:true}).diagnostics||[]).length,0,'The old transpile-only path misses this semantic error');
assert.throws(()=>typecheckGate(root,['tsconfig.json']),/Typecheck gate failed/);
fs.writeFileSync(path.join(root,'sample.ts'),'const value: number = 123;');
assert.doesNotThrow(()=>typecheckGate(root,['tsconfig.json']));
fs.writeFileSync(path.join(root,'sample.ts'),'const broken = ;');
assert.throws(()=>typecheckGate(root,['tsconfig.json']),/Typecheck gate failed/);
fs.writeFileSync(path.join(root,'api.ts'),'export function accept(value: number): void {}');
fs.writeFileSync(path.join(root,'sample.ts'),"import {accept} from './api'; accept('wrong');");
assert.throws(()=>typecheckGate(root,['tsconfig.json']),/Typecheck gate failed/);
assert.throws(()=>typecheckGate(root,['missing.json']),/Typecheck gate failed/);
// Exercise both real configs with the same defaults the production packager uses.
assert.doesNotThrow(()=>typecheckGate(path.join(here,'portal')));
// Run the actual packager in an isolated fixture. Only import paths are remapped.
// The bad fixture must fail at the gate, before source reads or output staging.
const packager=fs.readFileSync(path.join(here,'portal/build-static.mjs'),'utf8')
 .replace("from 'typescript'",`from '${pathToFileURL(path.join(here,'portal/node_modules/typescript/lib/typescript.js')).href}'`)
 .replace("from '../scripts/typecheck-gate.mjs'",`from '${pathToFileURL(path.join(here,'scripts/typecheck-gate.mjs')).href}'`);
fs.writeFileSync(path.join(root,'build-static.mjs'),packager);
fs.mkdirSync(path.join(root,'static'));fs.writeFileSync(path.join(root,'static/sentinel.txt'),'unchanged');
const before=fs.readdirSync(root).sort();
const result=spawnSync(process.execPath,[path.join(root,'build-static.mjs')],{encoding:'utf8',windowsHide:true});
assert.notEqual(result.status,0);assert.match(result.stderr,/Typecheck gate failed/);
assert.deepEqual(fs.readdirSync(root).sort(),before);
assert.equal(fs.readFileSync(path.join(root,'static/sentinel.txt'),'utf8'),'unchanged');
console.log('PASS: transpile baseline, semantic/syntax/cross-module rejection, valid acceptance, missing config rejection, real default configs, packager stops without staging or changing output. Fixture: '+root);
