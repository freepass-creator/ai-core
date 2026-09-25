/** ★승인 구조 시험 — OPS-20260831-110
 *
 *  대표(2026-08-31): 「기존 Claude 승인 방식은 호환성 있게 유지하되,
 *                    ★**Claude 가 없을 때 Cursor/Gemini 대체 경로를 테스트로 검증**하세요」
 *
 *  ★시험은 «자기 자리» 에서 돈다 — 진짜 `.coordination` 을 안 건드린다.
 *    AIOPS_COORDINATION_DIR 로 임시 자리를 준다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const 자리 = await mkdtemp(join(tmpdir(), 'seungin-'));
process.env.AIOPS_COORDINATION_DIR = 자리;

const S = await import('../lib/seungin.mjs');

/** 시험용 묶음 — 계획·양식·대상을 실제로 해시해서 만든다 */
const 양식길 = join(자리, '양식.html');
await writeFile(양식길, '<td class="k">계약상태</td>', 'utf8');

const 계획 = { 관청: '평택시', 건수: 1, 임차인: ['고객189'] };
const 대상 = S.대상해시(['file-aaa', 'file-bbb']);
const 밑 = {
  등급: 'drive-add',
  계획SHA: S.계획해시(계획),
  양식SHA: await S.양식해시([양식길]),
  대상SHA: 대상.해시,
  건수: 대상.건수,
};

test.after(async () => { await rm(자리, { recursive: true, force: true }); });

test('행위로 가른다 — local 은 Codex 단독으로 지나간다', async () => {
  const r = await S.지나가도되나({ ...밑, 등급: 'local', 실행자: 'codex' });
  assert.equal(r.된다, true);
  assert.equal(r.길, 'codex단독');
});

test('drive-add 는 검토도 대표승인도 없으면 막힌다', async () => {
  const r = await S.지나가도되나({ ...밑, 실행자: 'codex' });
  assert.equal(r.된다, false);
  assert.match(r.왜, /독립 검토자 1명/);
});

test('★기존 경로 — Claude 검토 + 대표 승인이면 지나간다 (호환)', async () => {
  await S.검토기록({ ...밑, 검토자: 'claude', 판정: 'APPROVE', 근거: '임차인·계약기간 대조 완료' });
  const 반 = await S.지나가도되나({ ...밑, 실행자: 'codex' });
  assert.equal(반.된다, false, '검토만으로는 안 된다 — 대표 승인이 있어야 한다');
  assert.match(반.왜, /대표 직전 승인이 없다/);

  await S.대표승인({ ...밑, 문구: '평택시 1건 올려라' });
  const r = await S.지나가도되나({ ...밑, 실행자: 'codex' });
  assert.equal(r.된다, true);
  assert.equal(r.길, '검토+대표');
});

test('★★Claude 가 없어도 Cursor 가 대신한다', async () => {
  const 계획2 = { ...계획, 관청: '김포시' };
  const 밑2 = { ...밑, 계획SHA: S.계획해시(계획2) };
  await S.검토기록({ ...밑2, 검토자: 'cursor', 판정: 'APPROVE', 근거: 'PDF 열어 확인서·고지서 짝 확인' });
  await S.대표승인({ ...밑2, 문구: '김포시 올려라' });
  const r = await S.지나가도되나({ ...밑2, 실행자: 'codex' });
  assert.equal(r.된다, true);
  assert.equal(r.검토[0].검토자, 'cursor');
});

test('★★Claude 가 없어도 Gemini 가 대신한다', async () => {
  const 밑3 = { ...밑, 계획SHA: S.계획해시({ ...계획, 관청: '평택시2' }) };
  await S.검토기록({ ...밑3, 검토자: 'gemini', 판정: 'APPROVE', 근거: '기관명·수신처 대조' });
  await S.대표승인({ ...밑3, 문구: '올려라' });
  const r = await S.지나가도되나({ ...밑3, 실행자: 'codex' });
  assert.equal(r.된다, true);
  assert.equal(r.검토[0].검토자, 'gemini');
});

test('★검토를 «지어낼» 수 없다 — 계획이 바뀌면 옛 검토는 없는 것이 된다', async () => {
  const 바뀐 = { ...밑, 계획SHA: S.계획해시({ ...계획, 건수: 99 }) };
  const r = await S.지나가도되나({ ...바뀐, 실행자: 'codex' });
  assert.equal(r.된다, false, '계획이 달라졌으면 앞의 검토를 재활용할 수 없다');
});

test('★양식이 바뀌어도 옛 검토는 없는 것이 된다', async () => {
  await writeFile(양식길, '<td class="k">계약상태</td><td class="k">추가</td>', 'utf8');
  const 새양식 = await S.양식해시([양식길]);
  assert.notEqual(새양식, 밑.양식SHA);
  const r = await S.지나가도되나({ ...밑, 양식SHA: 새양식, 실행자: 'codex' });
  assert.equal(r.된다, false);
});

test('★실행자는 자기 일을 자기가 검토할 수 없다', async () => {
  const 밑4 = { ...밑, 계획SHA: S.계획해시({ ...계획, 관청: '자기검토' }) };
  await S.검토기록({ ...밑4, 검토자: 'claude', 판정: 'APPROVE', 근거: '내가 만들고 내가 봤다' });
  await S.대표승인({ ...밑4, 문구: '올려라' });
  const r = await S.지나가도되나({ ...밑4, 실행자: 'claude' });
  assert.equal(r.된다, false, 'claude 가 실행자면 claude 검토는 안 쳐 준다');
});

test('★한 명이라도 BLOCK 하면 막힌다', async () => {
  const 밑5 = { ...밑, 계획SHA: S.계획해시({ ...계획, 관청: '막힌곳' }) };
  await S.검토기록({ ...밑5, 검토자: 'cursor', 판정: 'APPROVE', 근거: '괜찮다' });
  await S.검토기록({ ...밑5, 검토자: 'gemini', 판정: 'BLOCK', 근거: '수신처가 직인에서 왔다' });
  await S.대표승인({ ...밑5, 문구: '올려라' });
  const r = await S.지나가도되나({ ...밑5, 실행자: 'codex' });
  assert.equal(r.된다, false);
  assert.match(r.왜, /gemini 가 막았다/);
});

test('★★긴급 우회 — 대표 승인만으로 drive-add 가 지나간다', async () => {
  const 밑6 = { ...밑, 계획SHA: S.계획해시({ ...계획, 관청: '긴급' }) };
  const 명령 = ['node', 'wonja/gwataeryo-seoryu.mjs', '--만든다'];
  await S.대표승인({ ...밑6, 문구: '긴급 실행 승인', 명령, 긴급: true });
  const r = await S.지나가도되나({ ...밑6, 실행자: 'codex', 명령 });
  assert.equal(r.된다, true);
  assert.equal(r.길, '긴급');
});

test('★★긴급 우회로도 protected 는 못 연다', async () => {
  const 밑7 = { ...밑, 등급: 'protected', 계획SHA: S.계획해시({ ...계획, 관청: '지우기' }) };
  await assert.rejects(
    () => S.대표승인({ ...밑7, 문구: '긴급 실행 승인', 긴급: true }),
    /긴급 우회로 열 수 없다/,
  );
});

test('★긴급 승인은 «그 명령» 에만 묶인다', async () => {
  const 밑8 = { ...밑, 계획SHA: S.계획해시({ ...계획, 관청: '명령묶음' }) };
  await S.대표승인({ ...밑8, 문구: '긴급 실행 승인', 명령: ['node', 'a.mjs'], 긴급: true });
  const 다른 = await S.지나가도되나({ ...밑8, 실행자: 'codex', 명령: ['node', 'b.mjs'] });
  assert.equal(다른.된다, false, '다른 명령으로는 못 쓴다');
  const 같은 = await S.지나가도되나({ ...밑8, 실행자: 'codex', 명령: ['node', 'a.mjs'] });
  assert.equal(같은.된다, true);
});

test('★승인은 시간이 지나면 죽는다', async () => {
  const 밑9 = { ...밑, 계획SHA: S.계획해시({ ...계획, 관청: '만료' }) };
  await S.검토기록({ ...밑9, 검토자: 'cursor', 판정: 'APPROVE', 근거: 'ok', ttlMs: 1 });
  await S.대표승인({ ...밑9, 문구: '올려라', ttlMs: 1 });
  await new Promise((r) => setTimeout(r, 30));
  const r = await S.지나가도되나({ ...밑9, 실행자: 'codex' });
  assert.equal(r.된다, false, '만료된 승인으로는 못 지나간다');
});

test('★기록은 append-only — 사슬이 성해야 한다', async () => {
  const r = await S.사슬검사();
  assert.equal(r.성하다, true, r.왜);
  assert.ok(r.줄수 > 10);
});

test('★★BLOCK 을 APPROVE 로 고쳐 쓰면 드러난다', async () => {
  const { readFile: 읽기, writeFile: 쓰기 } = await import('node:fs/promises');
  const 길 = join(자리, 'seungin.ndjson');
  const 줄 = (await 읽기(길, 'utf8')).split('\n').filter(Boolean);
  /** ★실제로 BLOCK 인 줄을 찾아 APPROVE 로 뒤집어 본다 */
  const 자리번호 = 줄.findIndex((l) => JSON.parse(l).판정 === 'BLOCK');
  assert.ok(자리번호 >= 0, 'BLOCK 줄이 있어야 시험이 된다');
  const 가짜 = JSON.parse(줄[자리번호]);
  가짜.판정 = 'APPROVE';
  줄[자리번호] = JSON.stringify(가짜);
  await 쓰기(길, `${줄.join('\n')}\n`, 'utf8');
  const r = await S.사슬검사();
  assert.equal(r.성하다, false, '고쳐 쓴 것이 드러나야 한다');
  assert.equal(r.어디, 자리번호);
});

test('★★줄을 «지워도» 드러난다 — 검토를 생략할 수 없다', async () => {
  const { readFile: 읽기, writeFile: 쓰기 } = await import('node:fs/promises');
  const 길 = join(자리, 'seungin.ndjson');
  const 줄 = (await 읽기(길, 'utf8')).split('\n').filter(Boolean);
  줄.splice(3, 1);                       // ★한 줄 몰래 뺀다
  await 쓰기(길, `${줄.join('\n')}\n`, 'utf8');
  const r = await S.사슬검사();
  assert.equal(r.성하다, false);
});

test('★★★파일을 «통째로 다시 써도» 감사기록과 대조하면 드러난다', async () => {
  const { readFile: 읽기, writeFile: 쓰기 } = await import('node:fs/promises');
  const 길 = join(자리, 'seungin.ndjson');
  const 원래 = (await 읽기(길, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l));

  /** ★BLOCK 을 없애고 사슬을 «처음부터 새로» 이어 성해 보이게 만든다 */
  const 남길것 = 원래.filter((r) => r.판정 !== 'BLOCK');
  let 앞 = 'GENESIS';
  const 깨끗 = 남길것.map((r) => {
    const { prev, chain, ...본 } = r;
    const 이번 = S.해시(`${앞}|${JSON.stringify(본)}`);
    const 줄 = JSON.stringify({ ...본, prev: 앞, chain: 이번 });
    앞 = 이번;
    return 줄;
  });
  await 쓰기(길, `${깨끗.join('\n')}\n`, 'utf8');

  const 사슬 = await S.사슬검사();
  assert.equal(사슬.성하다, true, '★통째로 다시 쓰면 사슬만으로는 성해 보인다 — 이게 사슬의 한계다');

  const 대조 = await S.대조검사();
  assert.equal(대조.성하다, false, '★그래도 감사기록과 대조하면 드러나야 한다');
  assert.ok(대조['★장부에서 지워졌다'].length > 0, '지워진 검토가 감사기록에 남아 있어야 한다');
});
