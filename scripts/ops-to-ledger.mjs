#!/usr/bin/env node
// 운영 회차의 «관측»을 작업 원장에 한 줄로 남긴다 — AI Core 가 실제 업무를 «보기» 시작하는 자리.
//
// ★대표 2026-09-27: 「AI 코어가 동상처럼 서 있다. 실전 투입을 못 한다」
//   Codex 와 상의해 정한 순서: (나) 실제 업무 하나를 끝까지 완주한다.
//   고른 업무: freepasserp5 상품 SSOT 갱신 — «이미 매시간 실제로 도는» 일이라 새로 만들 게 없고,
//   실패하면 영업자가 바로 불편해지므로 증명이 된다.
//
//   1단계(이 파일) — 관측을 원장에 남긴다. 아무것도 «시키지» 않는다. 위험 0.
//   2단계 — 컨트롤타워가 그 원장을 읽고 판정한다.
//   3단계 — 그때 가서 사람이 실행 권한을 줄지 정한다.
//
//   node scripts/ops-to-ledger.mjs --env-file <경로>        기록한다
//   node scripts/ops-to-ledger.mjs --env-file <경로> --dry  무엇을 남길지만 보여 준다
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendLedgerEvent, verifyLedgerText } from './work-ledger.mjs';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 값 = (이름) => {
  const i = process.argv.indexOf(이름);
  return i > 0 ? process.argv[i + 1] : null;
};

/** ops-watch 를 «그대로» 돌려 그 출력만 읽는다. 관측 논리를 두 벌 만들지 않는다. */
export async function 관측하다({ envFile }) {
  const 인자 = ['scripts/ops-watch.mjs'];
  if (envFile) 인자.push('--env-file', envFile);
  const { stdout } = await run(process.execPath, 인자, { cwd: root, timeout: 240_000, windowsHide: true })
    .catch((오류) => ({ stdout: 오류.stdout ?? '' }));
  return stdout;
}

/** ops-watch 의 사람 읽는 출력에서 «원장에 남길 사실»만 뽑는다. */
export function 읽어내다(출력) {
  const 줄 = 출력.split(/\r?\n/);
  const 머리 = 줄.find((l) => l.trim().startsWith('■')) ?? '';
  const 상태 = (머리.match(/■\s+(\S+)\s+(\S+)/) ?? [])[2] ?? 'UNKNOWN';
  const 운영id = (머리.match(/■\s+(\S+)/) ?? [])[1] ?? null;
  const 발행 = 줄.find((l) => l.includes('발행')) ?? '';
  const 나이 = Number((발행.match(/(\d+)분 전/) ?? [])[1] ?? NaN);
  const 발행판 = (발행.match(/·\s+([0-9]{17}-[0-9a-f]+)/) ?? [])[1] ?? null;
  const 회차 = 줄.find((l) => l.includes('회차')) ?? '';
  const 결론 = (회차.match(/completed\/(\w+)/) ?? [])[1] ?? null;
  const 주소 = (출력.match(/https:\/\/github\.com\/\S+/) ?? [])[0] ?? null;
  const 자료반영 = /자료는 반영됨/.test(출력);
  const 자료안바뀜 = /자료도 안 바뀜/.test(출력);
  return { 운영id, 상태, 나이분: Number.isFinite(나이) ? 나이 : null, 발행판, 결론, 주소, 자료반영, 자료안바뀜 };
}

/** 관측 하나를 원장 이벤트로 바꾼다. «상태 전이»가 아니라 «보았다»는 사실이다.
 *
 *  원장이 받는 타입은 정해져 있다(CREATED · TRANSITIONED · BLOCKED · RESUMED · CANCELLED · REOBSERVED).
 *  운영 관측은 일을 «옮기지» 않으므로 REOBSERVED 가 맞는 자리다 — 같은 상태, 새 revision, 증거 필수.
 *  첫 관측은 그 work 가 아직 없으니 CREATED 로 연다.
 *
 *  ★REOBSERVED 는 revision 이 «바뀌어야» 받는다(같으면 REOBSERVE_REVISION_UNCHANGED).
 *    저장소 head 는 하루에 안 바뀔 수도 있지만 «발행판»은 회차마다 바뀐다. 그래서 관측의 대상 revision 은
 *    저장소 head 가 아니라 «그 회차가 실제로 발행한 것»으로 잡는다 — 그것이 이 일의 subject 다.
 */
export function 이벤트로(사실, { 지금 = new Date(), subject_revision, 처음 = false }) {
  return {
    /** 관측 시각이 이벤트를 유일하게 만든다 — 같은 회차를 두 번 적어도 서로 다른 줄이 된다. */
    /** 원장 식별자 규격: 대문자·숫자 이름 + 숫자 꼬리(`^[A-Z][A-Z0-9_-]*-[0-9]{3,}$`).
     *  운영 id(`erp5-catalog-refresh`)를 그대로 쓰면 안 받는다 — 고정된 work 이름을 쓰고,
     *  event_id 는 관측 시각을 숫자로 붙여 유일하게 만든다. */
    event_id: `OPSOBS-${지금.toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`,
    work_id: 'OPS-ERP5-CATALOG-001',
    project_id: 'freepasserp4',
    type: 처음 ? 'CREATED' : 'REOBSERVED',
    from_state: 처음 ? null : 'RECEIVED',
    to_state: 'RECEIVED',
    actor: 'ai-core/ops-to-ledger',
    subject_revision,
    observed_at: 지금.toISOString().replace(/\.\d+Z$/, 'Z'),
    /** 증거는 원장 규격대로 «한 줄 문자열»이다 — `종류:내용 @출처`. 객체를 넣으면 EVENT_SCHEMA_INVALID 다. */
    evidence_refs: [
      `MEASURED:상태 ${사실.상태} @scripts/ops-watch.mjs`,
      ...(사실.발행판 ? [`MEASURED:발행 ${사실.발행판} · ${사실.나이분 ?? '?'}분 전 @freepasserp5/ops/public_catalog_publication`] : []),
      ...(사실.주소 ? [`READ:회차 ${사실.결론 ?? 'failure'} @${사실.주소}`] : []),
      ...(사실.자료반영 ? ['READ:자료는 반영됨 — 회차 뒤 검사만 실패 @ops-watch'] : []),
      ...(사실.자료안바뀜 ? ['READ:★자료도 안 바뀜 — 진짜 고장 @ops-watch'] : [])
    ]
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const envFile = 값('--env-file');
  const 출력 = await 관측하다({ envFile });
  const 사실 = 읽어내다(출력);
  if (!사실.운영id) {
    console.log('HOLD: ops-watch 출력을 읽지 못했다 — 기록하지 않는다.');
    console.log(출력.slice(0, 400));
    process.exit(1);
  }

  /** 대상 revision — 지어내지 않는다.
   *  이 일의 subject 는 «그 회차가 발행한 것»이다. 발행판 id 가 있으면 그것을 40자로 접어 쓰고(원장 규격),
   *  못 읽었으면 등록부가 관측한 저장소 head 를 쓴다. 둘 다 없으면 기록하지 않는다. */
  const 등록부 = JSON.parse(await readFile(resolve(root, 'registry/projects.json'), 'utf8'));
  const head = 등록부.projects.find((p) => p.project_id === 'freepasserp4')?.head_revision ?? null;
  const { createHash } = await import('node:crypto');
  const subject_revision = 사실.발행판 ? createHash('sha1').update(사실.발행판).digest('hex') : head;

  const 원장길0 = resolve(root, '.local/work-ledger.jsonl');
  const 있던글 = await readFile(원장길0, 'utf8').catch(() => '');
  const 처음 = !있던글.includes('"OPS-ERP5-CATALOG-001"');

  const 이벤트 = 이벤트로(사실, { subject_revision, 처음 });
  console.log(`관측: ${사실.운영id} · ${사실.상태} · 발행 ${사실.나이분 ?? '?'}분 전 · 회차 ${사실.결론 ?? '?'}`);

  if (process.argv.includes('--dry')) {
    console.log(JSON.stringify(이벤트, null, 2));
    process.exit(0);
  }

  /** `appendLedgerEvent(경로, 이벤트, 기대head)` — 텍스트가 아니라 «파일»을 받고, 잠금과 head 대조를 스스로 한다.
   *  기대 head 를 넘겨야 다른 프로세스가 그 사이에 쓴 경우 LEDGER_HEAD_CHANGED 로 막힌다. */
  const 원장길 = 원장길0;
  const 현재 = verifyLedgerText(있던글);
  if (현재.status !== 'VALID') {
    console.log(`HOLD: 원장 사슬이 이미 깨져 있다 — ${JSON.stringify(현재.errors ?? []).slice(0, 200)}`);
    process.exit(1);
  }

  /** ★이미 같은 발행판을 적었으면 «또 적지 않는다».
   *  원장은 REOBSERVED 에 새 revision 을 요구한다(REOBSERVE_REVISION_UNCHANGED). 그 규칙이 맞다 —
   *  같은 회차를 매시간 다시 적으면 원장이 «관측 로그»가 되어 버리고, 무엇이 바뀐 순간인지 못 읽는다.
   *  그래서 발행이 그대로면 조용히 넘어간다. 바뀐 순간에만 한 줄이 는다. */
  const 이미 = 현재.work?.[이벤트.work_id];
  if (!처음 && 이미?.subject_revision === subject_revision) {
    console.log(`변화 없음: 발행 ${사실.발행판} 은 이미 원장에 있다 (${사실.나이분 ?? '?'}분 전) — 적지 않는다`);
    process.exit(0);
  }

  let 결과;
  try {
    결과 = await appendLedgerEvent(원장길, 이벤트, 현재.head);
  } catch (오류) {
    console.log(`HOLD: 원장이 받지 않았다 — ${오류.message}`);
    process.exit(1);
  }
  if (!결과?.appended) {
    /** ★거절 이유를 «그대로» 보여 준다. 「이유 미상」은 고칠 수 없는 보고다(2026-09-27 실측에서 막혔다). */
    console.log('HOLD: 원장이 받지 않았다');
    console.log(JSON.stringify(결과, null, 1).slice(0, 700));
    process.exit(1);
  }

  const 검증 = verifyLedgerText(await readFile(원장길, 'utf8'));
  console.log(`기록함: ${이벤트.work_id} · ${이벤트.type} · 사슬 ${검증.status} · ${검증.event_count}건`);
  process.exit(검증.status === 'VALID' ? 0 : 1);
}
