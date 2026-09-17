// 일한 것을 원장에 적는다 — the half that was missing.
//
// ★대표(2026-09-17): 「이게 뭐 AI 코어를 활용하는 건지 모르겠다」
//
// ── What tonight proved
// 2026-09-17 밤에 과태료 6일 정지를 풀었다. 결제 계정이 닫혀 있던 것을 찾고, 줄이기가
// 원장 짝을 끊던 것을 고치고, 한 판을 완주시켜 관문을 통과시켰다.
// ★그런데 AI Core 에는 «한 줄도» 남지 않았다. 다음 세션은 그 6일을 다시 조사한다.
//
// 오늘 제일 비쌌던 것도 같은 병이었다 — 문서에 「무료 한도 소진」이라 «결론만» 적혀
// 있었고, 아무도 다시 재지 않아 6일이 갔다. 근거 없는 결론이 정본 행세를 한 것이다.
//
// ── ★그래서 이 모듈이 요구하는 것: 근거 없는 줄은 못 적는다
// 원장은 이미 CLOSED 에 evidence_refs 를 요구한다(work-ledger.mjs:59). 여기서는 그것을
// «모든 걸음» 으로 넓힌다. 무엇을 했다고 적으려면 그것을 어떻게 알았는지 같이 적어야 한다.
// 그러면 다음 세션이 읽는 것은 「무료 한도 소진」 같은 «결론» 이 아니라
// 「billing accounts describe → open:false (2026-09-17T11:2x)」 같은 «관측» 이다.
//
// ── What this is NOT
// 판정하지 않는다. 상태 전이의 적법성은 verifyLedgerText 가 본다. 해시체인도 그쪽이다.
// 이 모듈은 «적는 법» 만 안다 — 무엇을 적어야 하고, 무엇 없이는 못 적는지.

import { appendLedgerEvent, verifyLedgerText } from '../../scripts/work-ledger.mjs';

const need = (condition, code) => { if (!condition) throw new Error(code); };
const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const 이제 = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

/** ★원장 계약이 못 박은 id 꼴 — contracts/work-ledger-event.schema.json.
 *  ★여기서 먼저 잡는다. 안 그러면 append 깊은 곳에서 EVENT_SCHEMA_INVALID 만 나오고
 *    «무엇이 잘못됐는지» 를 caller 가 모른다. 오늘 내가 그걸로 한 번 헤맸다. */
const ID꼴 = /^[A-Z][A-Z0-9_-]*-[0-9]{3,}$/;
let 순번 = 0;
const 새사건id = () => `WR-${String(Date.now() % 1000000).padStart(6, '0')}${String(순번 += 1).padStart(3, '0')}`;

/** 증거 한 줄의 꼴 — ★「무엇을 보고 그렇게 말하나」에 답이 되어야 한다.
 *  갈래는 셋뿐이다. 늘리고 싶어지면 그건 대개 «근거가 없다»는 뜻이다. */
export const 증거갈래 = ['MEASURED', 'READ', 'RECEIVED'];
//  MEASURED — 이 세션에서 실제로 돌려서 본 것 (명령과 결과)
//  READ     — 저장소·문서에서 읽은 것 (파일과 줄)
//  RECEIVED — 사람이 말해 준 것 (누가, 언제)

export function 증거인가(증거) {
  if (!증거 || typeof 증거 !== 'object') return 'EVIDENCE_SHAPE_INVALID';
  if (!증거갈래.includes(증거.갈래)) return 'EVIDENCE_KIND_INVALID';
  if (!text(증거.무엇)) return 'EVIDENCE_WHAT_REQUIRED';
  /** ★「어디서」가 없으면 그건 증거가 아니라 주장이다.
   *  MEASURED 면 돌린 명령, READ 면 파일:줄, RECEIVED 면 누가 말했는지. */
  if (!text(증거.어디서)) return 'EVIDENCE_SOURCE_REQUIRED';
  return null;
}

/**
 * createWorkRecorder({ ledgerPath, actor }) -> { 적는다, 지금상태 }
 *
 * ★actor 는 생성할 때 한 번 못 박는다. 걸음마다 받으면 남의 이름으로 적을 수 있다.
 */
export function createWorkRecorder({ ledgerPath, actor }) {
  need(text(ledgerPath), 'LEDGER_PATH_REQUIRED');
  need(text(actor), 'ACTOR_REQUIRED');

  const 읽기 = async () => {
    const { readFile } = await import('node:fs/promises');
    return readFile(ledgerPath, 'utf8').catch((error) => {
      if (error?.code === 'ENOENT') return '';
      throw error;
    });
  };

  /** 지금 이 업무가 어느 상태인가 — 원장에서 «읽는다». 기억하지 않는다. */
  async function 지금상태(workId) {
    const 결과 = verifyLedgerText(await 읽기());
    need(결과.status === 'VALID', 'LEDGER_INVALID');
    return { 상태: 결과.work?.[workId]?.state ?? null, head: 결과.head ?? null };
  }

  /**
   * 적는다({ work_id, project_id, type, to_state, subject_revision, 무엇, 증거 })
   *
   * ★증거 없이는 못 적는다. 그것이 이 모듈의 존재 이유다.
   */
  async function 적는다(걸음) {
    need(걸음 && typeof 걸음 === 'object', 'STEP_REQUIRED');
    const { work_id: workId, project_id: projectId, type, to_state: toState, subject_revision: rev } = 걸음;
    need(text(workId) && text(projectId), 'WORK_AND_PROJECT_REQUIRED');
    need(ID꼴.test(workId), 'WORK_ID_SHAPE_INVALID');
    need(text(무엇글(걸음)), 'WHAT_HAPPENED_REQUIRED');

    /** ★증거는 «하나 이상» 이고 «하나하나» 꼴을 갖춰야 한다.
     *  빈 배열을 통과시키면 이 모듈은 아무것도 안 하는 것이 된다. */
    const 증거들 = Array.isArray(걸음.증거) ? 걸음.증거 : [];
    need(증거들.length > 0, 'EVIDENCE_REQUIRED');
    for (const 증 of 증거들) { const 왜 = 증거인가(증); need(!왜, 왜); }

    if (text(걸음.event_id)) need(ID꼴.test(걸음.event_id), 'EVENT_ID_SHAPE_INVALID');
    const { 상태: 이전, head } = await 지금상태(workId);
    /** ★from_state 를 caller 가 말하지 못한다 — 원장에서 읽는다.
     *  말할 수 있으면 실제로 있지도 않은 자리에서 옮겨 적을 수 있다. */
    const 사건 = {
      event_id: text(걸음.event_id) ?? 새사건id(),
      work_id: workId,
      project_id: projectId,
      type: text(type) ?? (이전 === null ? 'CREATED' : 'TRANSITIONED'),
      from_state: 이전,
      to_state: text(toState) ?? (이전 === null ? 'RECEIVED' : 이전),
      actor,
      subject_revision: text(rev) ?? null,
      observed_at: text(걸음.observed_at) ?? 이제(),
      /** ★증거를 원장의 evidence_refs 로 «접어 넣는다». 갈래·무엇·어디서가 한 줄로 남는다.
       *  그래야 다음 세션이 결론이 아니라 «관측» 을 읽는다. */
      evidence_refs: 증거들.map((증) => `${증.갈래}:${증.무엇} @${증.어디서}`),
    };

    const 결과 = await appendLedgerEvent(ledgerPath, 사건, head);
    return { 적음: true, event_id: 사건.event_id, head: 결과.head, from_state: 이전, to_state: 사건.to_state };
  }

  return { 적는다, 지금상태 };
}

const 무엇글 = (걸음) => 걸음?.무엇 ?? 걸음?.what ?? null;
