// 세션이 한 일을 원장에 적는 «부르는 길».
//
// ★2026-09-17: work-recorder.mjs 를 만들어 놓고 «부르는 곳이 0개» 였다. 검사는 다
//   통과하는데 도는 길에 안 걸려 있던 것 — 그날 하루 종일 남의 코드에서 잡던 바로 그
//   병을 내가 저질렀다. 이 파일이 그 구멍을 닫는다.
//
// 쓰는 법
//   node scripts/work-record.mjs --work DEV-001 --project ai-core --to IN_PROGRESS \
//        --what "원인을 찾았다" \
//        --measured "open:false @gcloud billing accounts describe" \
//        --read "문서는 Spark 한도로 결론냈다 @docs/과태료-작업지도.md"
//
//   node scripts/work-record.mjs --state --work DEV-001        지금 어느 자리인가
//
// ★증거 없이는 안 적힌다. --measured / --read / --received 중 «하나 이상» 이 있어야 한다.
//   그것이 이 도구의 존재 이유다 — 오늘 6일을 잡아먹은 것이 「결론만 적힌 문서」였다.

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkRecorder } from '../src/integration/work-recorder.mjs';
import { defaultWorkLedgerPath } from '../src/integration/order-work-sources.mjs';
import { defaultDb } from '../src/orders/store.mjs';

const 인 = process.argv.slice(2);
const 값 = (이름) => { const i = 인.indexOf(이름); return i < 0 ? null : 인[i + 1] ?? null; };
const 여럿 = (이름) => 인.reduce((모음, x, i) => (x === 이름 && 인[i + 1] ? [...모음, 인[i + 1]] : 모음), []);

/** "무엇 @어디서" 를 가른다. ★「@」가 없으면 «어디서» 가 없다는 뜻이라 그대로 넘긴다 —
 *  recorder 가 EVIDENCE_SOURCE_REQUIRED 로 거절한다. 여기서 몰래 채우지 않는다. */
const 증거로 = (갈래, 줄) => {
  const i = String(줄).lastIndexOf('@');
  return i < 0
    ? { 갈래, 무엇: String(줄).trim(), 어디서: '' }
    : { 갈래, 무엇: 줄.slice(0, i).trim(), 어디서: 줄.slice(i + 1).trim() };
};

const 쓰는법 = () => {
  console.error('쓰는 법:');
  console.error('  node scripts/work-record.mjs --work <WORK-001> --project <아이디> --to <상태> --what "무엇을 했나" \\');
  console.error('       --measured "본 것 @돌린 명령"   [--read "읽은 것 @파일"]  [--received "들은 것 @누가"]');
  console.error('  node scripts/work-record.mjs --state --work <WORK-001>');
  console.error('');
  console.error('★증거가 하나도 없으면 안 적는다. 「무엇을 보고 그렇게 말하나」에 답이 있어야 한다.');
  console.error(`★원장 자리(규약): ${defaultWorkLedgerPath(process.env.AI_CORE_ORDERS_DB || defaultDb)}`);
};

if (!인.length || 인.includes('--help')) { 쓰는법(); process.exit(2); }

const ledgerPath = 값('--ledger') ?? defaultWorkLedgerPath(process.env.AI_CORE_ORDERS_DB || defaultDb);
const actor = 값('--actor') ?? process.env.AI_CORE_ACTOR ?? 'CLAUDE';
const 적기 = createWorkRecorder({ ledgerPath, actor });
const workId = 값('--work');

if (!workId) { console.error('★--work 가 필요하다\n'); 쓰는법(); process.exit(2); }

if (인.includes('--state')) {
  const { 상태, head } = await 적기.지금상태(workId);
  console.log(JSON.stringify({ work_id: workId, 상태: 상태 ?? '(원장에 없다)', head, ledgerPath }, null, 2));
  process.exit(0);
}

const 증거 = [
  ...여럿('--measured').map((줄) => 증거로('MEASURED', 줄)),
  ...여럿('--read').map((줄) => 증거로('READ', 줄)),
  ...여럿('--received').map((줄) => 증거로('RECEIVED', 줄)),
];

try {
  const r = await 적기.적는다({
    work_id: workId,
    project_id: 값('--project'),
    to_state: 값('--to'),
    subject_revision: 값('--revision'),
    무엇: 값('--what'),
    증거,
  });
  console.log(`✔ ${r.from_state ?? '(새 업무)'} → ${r.to_state}   ${r.event_id}`);
  console.log(`   원장: ${ledgerPath}`);
  console.log(`   head: ${r.head}`);
} catch (error) {
  console.error(`★안 적었다 — ${error.message}`);
  if (error.message === 'EVIDENCE_REQUIRED') {
    console.error('   근거 없는 줄은 원장에 못 들어간다. --measured / --read / --received 중 하나를 대라.');
  }
  if (error.message === 'EVIDENCE_SOURCE_REQUIRED') {
    console.error('   「@어디서」 가 빠졌다. 돌린 명령·파일 이름·말한 사람 중 하나를 붙여라.');
  }
  process.exit(1);
}
