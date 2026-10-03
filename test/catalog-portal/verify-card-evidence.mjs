import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),root=here,fixture=fs.mkdtempSync(path.join(os.tmpdir(),'devcenter-card-evidence-'));
const mapped=p=>{const rel=path.relative(root,p);assert(!rel.startsWith('..')&&!path.isAbsolute(rel),'Fixture input must stay in the repository');return path.join(fixture,rel)};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// Synthetic receipts exercise invalidation only; historical and real PASS receipts are never reused.
const catalog=JSON.parse(fs.readFileSync(path.join(here,'src/learning/cards.json'),'utf8'));
const suites={button:'test/catalog-portal/verify-button-recipes.cjs',examples:'test/catalog/verify-function-examples.mjs',gate:'test/verification/verify-typecheck-gate.mjs',collector:'test/catalog/verify-function-collector.mjs'};
const files=new Set(['src/learning/cards.json',...catalog.cards.flatMap(c=>c.sources.map(s=>s.path)),...Object.values(suites),'scripts/catalog/card-audit.mjs','scripts/verification/typecheck-gate.mjs','scripts/catalog/function-python-index.py','scripts/catalog-portal/build-static.mjs','src/catalog-portal/app/specimen/page.tsx','src/catalog-portal/tsconfig.json','src/catalog-portal/tsconfig.gallery.json']);
for(const file of fs.readdirSync(path.join(here,'src/catalog-portal/app')))if(/\.tsx?$/.test(file))files.add('src/catalog-portal/app/'+file);
for(const file of files){const from=path.join(here,file),dest=mapped(from);if(!fs.existsSync(from))continue;fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(from,dest)}
for(const card of catalog.cards)for(const source of card.sources)if(fs.existsSync(mapped(path.join(here,source.path))))source.sha256=sha(fs.readFileSync(mapped(path.join(here,source.path))));
const catalogBytes=JSON.stringify(catalog);fs.writeFileSync(mapped(path.join(here,'src/learning/cards.json')),catalogBytes);
const inputs=[...files].map(file=>mapped(path.join(here,file))).sort().map(file=>({path:file.replaceAll('\\','/'),sha256:fs.existsSync(file)?sha(fs.readFileSync(file)):null}));
const receipt={capturedAt:'synthetic-fixture-only',catalogSha256:sha(catalogBytes),inputs,inputDigest:sha(JSON.stringify(inputs)),stable:true,suites:Object.fromEntries(Object.keys(suites).map(id=>[id,{passed:true}]))};
fs.mkdirSync(mapped(path.join(here,'src/catalog-portal/static')),{recursive:true});fs.writeFileSync(mapped(path.join(here,'src/catalog-portal/static/source-manifest.json')),JSON.stringify({sources:[]}));
fs.mkdirSync(mapped(path.join(here,'test/fixtures/catalog-portal')),{recursive:true});fs.writeFileSync(mapped(path.join(here,'test/fixtures/catalog-portal/card-evidence.json')),JSON.stringify(receipt));
const report=path.join(fixture,'report.json');
function run(){const r=spawnSync(process.execPath,[mapped(path.join(here,'scripts/catalog/card-audit.mjs')),'--report',report],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return JSON.parse(fs.readFileSync(report,'utf8'))}
const baseline=run();assert.equal(baseline.counts.testEvidence,2);assert.equal(baseline.overallPercentage,null);assert.equal(baseline.counts.approved,0);
const source=mapped(path.join(here,'docs/AI_WORKING_STANDARD.md')),original=fs.readFileSync(source);fs.appendFileSync(source,'\nfixture change');const stale=run();assert.equal(stale.counts.testEvidence,0);assert(stale.counts.sourceCurrent<baseline.counts.sourceCurrent);
fs.writeFileSync(source,original);fs.appendFileSync(mapped(path.join(here,'test/catalog/verify-function-examples.mjs')),'\n// fixture change');const changedTest=run();assert.equal(changedTest.counts.sourceCurrent,baseline.counts.sourceCurrent);assert.equal(changedTest.counts.testEvidence,0);
console.log('PASS: current receipts counted; changed source/test invalidates evidence; whole completion stays null; no approval promotion. Fixture: '+fixture);
