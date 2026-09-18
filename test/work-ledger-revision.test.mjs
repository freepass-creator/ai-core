import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendLedgerEvent, verifyLedgerText } from '../scripts/work-ledger.mjs';

const rev=s=>createHash('sha1').update(s).digest('hex');
const A=rev('A'), B=rev('B'), WORK='DEMO-001', PROJECT='demo-project';
const dir=t=>{const d=mkdtempSync(join(tmpdir(),'ledger-rev-'));t.after(()=>rmSync(d,{recursive:true,force:true}));return d;};
const created=(r=A)=>({type:'CREATED',from_state:null,to_state:'RECEIVED',subject_revision:r});
const move=(from,to,r=A,extra={})=>({type:'TRANSITIONED',from_state:from,to_state:to,subject_revision:r,...extra});
const reobserve=(state,r)=>({type:'REOBSERVED',from_state:state,to_state:state,subject_revision:r,evidence_refs:['MEASURED:revision moved @gh compare']});

async function appendSeries(t, events){
  const path=join(dir(t),'work.jsonl'); let head=null;
  for(const [i,e] of events.entries()){
    head=(await appendLedgerEvent(path,{event_id:`EV-${String(i+1).padStart(3,'0')}`,work_id:WORK,project_id:PROJECT,actor:'TEST',observed_at:`2026-09-19T0${i}:00:00Z`,evidence_refs:[],...e},head)).head;
  }
  return{path,head,text:readFileSync(path,'utf8')};
}

test('historical plain revision attachment stays readable but is not evidence-backed history',()=>{
  const text=readFileSync(new URL('../examples/work-ledger.jsonl',import.meta.url),'utf8');
  const r=verifyLedgerText(text);
  assert.equal(r.status,'VALID',JSON.stringify(r.errors));
  assert.equal(r.work['DEV-001'].subject_revision,'e13b0867c8d2a55d3d54a6cac63f3e30584a5ba4');
  assert.deepEqual(r.work['DEV-001'].revisions,[],'plain historical transitions do not prove revision provenance');
});

test('new plain transition cannot change revision; rejected before append',async(t)=>{
  const {path,head}=await appendSeries(t,[created(null)]);
  const before=readFileSync(path,'utf8');
  await assert.rejects(()=>appendLedgerEvent(path,{
    event_id:'EV-002',work_id:WORK,project_id:PROJECT,type:'TRANSITIONED',from_state:'RECEIVED',to_state:'PLANNED',
    actor:'TEST',subject_revision:A,observed_at:'2026-09-19T01:00:00Z',evidence_refs:[]
  },head),/REVISION_CHANGE_REQUIRES_REOBSERVED/);
  assert.equal(readFileSync(path,'utf8'),before);
});

test('REOBSERVED with evidence is the only new pre-verification revision-change path',async(t)=>{
  const {text}=await appendSeries(t,[created(null),reobserve('RECEIVED',A),move('RECEIVED','PLANNED',A),reobserve('PLANNED',B),move('PLANNED','IN_PROGRESS',B)]);
  const r=verifyLedgerText(text);
  assert.equal(r.status,'VALID',JSON.stringify(r.errors));
  assert.equal(r.work[WORK].subject_revision,B);
  assert.deepEqual(r.work[WORK].revisions,[A,B]);
});

test('verified revision is frozen; change requires return + REOBSERVED + reverify',async(t)=>{
  const good=[created(A),move('RECEIVED','PLANNED',A),move('PLANNED','IN_PROGRESS',A),move('IN_PROGRESS','VERIFYING',A)];
  const {path,head}=await appendSeries(t,good);
  await assert.rejects(()=>appendLedgerEvent(path,{
    event_id:'EV-005',work_id:WORK,project_id:PROJECT,type:'TRANSITIONED',from_state:'VERIFYING',to_state:'READY',
    actor:'TEST',subject_revision:B,observed_at:'2026-09-19T04:00:00Z',evidence_refs:[]
  },head),/REVISION_CHANGE_REQUIRES_REOBSERVED/);

  const recovered=await appendSeries(t,[...good,move('VERIFYING','IN_PROGRESS',A),reobserve('IN_PROGRESS',B),move('IN_PROGRESS','VERIFYING',B),move('VERIFYING','READY',B)]);
  const r=verifyLedgerText(recovered.text);
  assert.equal(r.status,'VALID',JSON.stringify(r.errors));
  assert.equal(r.work[WORK].subject_revision,B);
  assert.deepEqual(r.work[WORK].revisions,[A,B]);
});

test('BLOCKED cannot skip verification even when revision is unchanged',async(t)=>{
  const {path,head}=await appendSeries(t,[created(A),move('RECEIVED','PLANNED',A),move('PLANNED','IN_PROGRESS',A),move('IN_PROGRESS','BLOCKED',A)]);
  await assert.rejects(()=>appendLedgerEvent(path,{
    event_id:'EV-005',work_id:WORK,project_id:PROJECT,type:'TRANSITIONED',from_state:'BLOCKED',to_state:'READY',
    actor:'TEST',subject_revision:A,observed_at:'2026-09-19T04:00:00Z',evidence_refs:[]
  },head),/VERIFICATION_SKIPPED/);
});
