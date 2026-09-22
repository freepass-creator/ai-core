import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(here),fixture=fs.mkdtempSync(path.join(os.tmpdir(),'devcenter-card-evidence-'));
const mapped=p=>path.join(fixture,path.relative(root,p));
const receipt=JSON.parse(fs.readFileSync(path.join(here,'quality/card-evidence.json'),'utf8'));
for(const item of receipt.inputs){if(!item.sha256)continue;const dest=mapped(item.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(item.path,dest)}
receipt.inputs=receipt.inputs.map(i=>({...i,path:mapped(i.path).replaceAll('\\','/')}));
receipt.inputDigest=crypto.createHash('sha256').update(JSON.stringify(receipt.inputs)).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(here,'portal/static/source-manifest.json'),'utf8'));
manifest.sources=manifest.sources.map(s=>({...s,path:mapped(s.path)}));
fs.mkdirSync(mapped(path.join(here,'portal/static')),{recursive:true});fs.writeFileSync(mapped(path.join(here,'portal/static/source-manifest.json')),JSON.stringify(manifest));
fs.mkdirSync(mapped(path.join(here,'quality')),{recursive:true});fs.writeFileSync(mapped(path.join(here,'quality/card-evidence.json')),JSON.stringify(receipt));
const report=path.join(fixture,'report.json');
function run(){const r=spawnSync(process.execPath,[mapped(path.join(here,'scripts/card-audit.mjs')),'--report',report],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return JSON.parse(fs.readFileSync(report,'utf8'))}
const baseline=run();assert.equal(baseline.counts.testEvidence,5);assert.equal(baseline.overallPercentage,null);assert.equal(baseline.counts.approved,0);
const source=mapped(path.join(here,'docs/BASELINE.md')),original=fs.readFileSync(source);fs.appendFileSync(source,'\nfixture change');const stale=run();assert.equal(stale.counts.testEvidence,0);assert(stale.counts.sourceCurrent<baseline.counts.sourceCurrent);
fs.writeFileSync(source,original);fs.appendFileSync(mapped(path.join(here,'scripts/verify-function-examples.mjs')),'\n// fixture change');const changedTest=run();assert.equal(changedTest.counts.sourceCurrent,baseline.counts.sourceCurrent);assert.equal(changedTest.counts.testEvidence,0);
console.log('PASS: current receipts counted; changed source/test invalidates evidence; whole completion stays null; no approval promotion. Fixture: '+fixture);
