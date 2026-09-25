import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = await mkdtemp(join(tmpdir(), 'aiops-security-shadow-'));
process.env.AIOPS_COORDINATION_DIR = root;

const S = await import('../lib/seungin.mjs');
const C = await import('../lib/ai-core-security-shadow.mjs');

const template = join(root, 'template.html');
await writeFile(template, '<p>notice</p>', 'utf8');
const target = S.대상해시(['file-1', 'file-2']);
const base = {
  계획SHA: S.계획해시({ office: 'gimpo', count: 2 }),
  양식SHA: await S.양식해시([template]),
  대상SHA: target.해시,
  건수: target.건수,
};

const future = new Date(Date.now() + 60_000).toISOString();
const nowIso = new Date().toISOString();
const shadowSubject = command => C.shadowSubject({
  subjectRevision: 'git:test',
  planSHA: base.계획SHA,
  templateSHA: base.양식SHA,
  targetSHA: base.대상SHA,
  targetCount: base.건수,
  command,
});

test.after(async()=>rm(root,{recursive:true,force:true}));

test('AIOps action grades remain compatible with Security P0 risk-policy projection',()=>{
  assert.equal(C.assertGradeParity(), true);
  assert.equal(C.shadowPolicyForGrade('local').risk_class, 'LOCAL_MUTATION');
  assert.equal(C.shadowPolicyForGrade('drive-add').risk_class, 'REVERSIBLE_EXTERNAL_MUTATION');
  assert.equal(C.shadowPolicyForGrade('protected').risk_class, 'IRREVERSIBLE_EXTERNAL_ACTION');
});

test('local path is allowed in both AIOps runtime and shadow policy', async()=>{
  const actual = await S.지나가도되나({...base,등급:'local',실행자:'codex'});
  const shadow = C.evaluateShadowApproval({
    grade:'local', executorId:'codex', subject:shadowSubject(), now:Date.now()
  });
  assert.equal(actual.된다,true);
  assert.equal(shadow.allowed,true);
});

test('drive-add without review/owner approval is blocked in both models', async()=>{
  const changed={...base,계획SHA:S.계획해시({office:'no-approval'})};
  const actual=await S.지나가도되나({...changed,등급:'drive-add',실행자:'codex'});
  const shadow=C.evaluateShadowApproval({
    grade:'drive-add',
    executorId:'codex',
    subject:C.shadowSubject({
      subjectRevision:'git:test',planSHA:changed.계획SHA,templateSHA:changed.양식SHA,
      targetSHA:changed.대상SHA,targetCount:changed.건수
    }),
    now:Date.now()
  });
  assert.equal(actual.된다,false);
  assert.equal(shadow.allowed,false);
  assert.equal(shadow.reason,'SECURITY_INDEPENDENT_REVIEW_REQUIRED');
});

test('independent review plus owner approval passes in both models', async()=>{
  const changed={...base,계획SHA:S.계획해시({office:'standard-pass'})};
  await S.검토기록({...changed,등급:'drive-add',검토자:'cursor',판정:'APPROVE',근거:'checked'});
  await S.대표승인({...changed,등급:'drive-add',문구:'approved'});
  const actual=await S.지나가도되나({...changed,등급:'drive-add',실행자:'codex'});
  const shadow=C.evaluateShadowApproval({
    grade:'drive-add',
    executorId:'codex',
    subject:C.shadowSubject({
      subjectRevision:'git:test',planSHA:changed.계획SHA,templateSHA:changed.양식SHA,
      targetSHA:changed.대상SHA,targetCount:changed.건수
    }),
    reviews:[{reviewer_id:'cursor',decision:'APPROVE',reviewed_at:nowIso,expires_at:future}],
    ownerApproval:{approver_id:'owner',approved_at:nowIso,expires_at:future},
    now:Date.now()
  });
  assert.equal(actual.된다,true);
  assert.equal(shadow.allowed,true);
  assert.equal(shadow.path,'STANDARD');
});

test('executor self-review does not satisfy either model', async()=>{
  const changed={...base,계획SHA:S.계획해시({office:'self-review'})};
  await S.검토기록({...changed,등급:'drive-add',검토자:'claude',판정:'APPROVE',근거:'self'});
  await S.대표승인({...changed,등급:'drive-add',문구:'approved'});
  const actual=await S.지나가도되나({...changed,등급:'drive-add',실행자:'claude'});
  const shadow=C.evaluateShadowApproval({
    grade:'drive-add',executorId:'claude',
    subject:C.shadowSubject({
      subjectRevision:'git:test',planSHA:changed.계획SHA,templateSHA:changed.양식SHA,
      targetSHA:changed.대상SHA,targetCount:changed.건수
    }),
    reviews:[{reviewer_id:'claude',decision:'APPROVE',reviewed_at:nowIso,expires_at:future}],
    ownerApproval:{approver_id:'owner',approved_at:nowIso,expires_at:future},
    now:Date.now()
  });
  assert.equal(actual.된다,false);
  assert.equal(shadow.allowed,false);
  assert.equal(shadow.reason,'SECURITY_INDEPENDENT_REVIEW_REQUIRED');
});

test('drive-add emergency is command-bound while protected has no emergency path', async()=>{
  const command=['node','wonja/gwataeryo-seoryu.mjs','--make'];
  const drive=C.evaluateShadowApproval({
    grade:'drive-add',executorId:'codex',subject:shadowSubject(command),
    emergencyApproval:{approver_id:'owner',reason:'urgent',approved_at:nowIso,expires_at:future},
    now:Date.now()
  });
  assert.equal(drive.allowed,true);
  assert.equal(drive.path,'EMERGENCY');

  const protectedResult=C.evaluateShadowApproval({
    grade:'protected',executorId:'codex',subject:shadowSubject(command),
    emergencyApproval:{approver_id:'owner',reason:'urgent',approved_at:nowIso,expires_at:future},
    now:Date.now()
  });
  assert.equal(protectedResult.allowed,false);
  assert.equal(protectedResult.reason,'SECURITY_EMERGENCY_OVERRIDE_FORBIDDEN');
});
