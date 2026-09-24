// 방향(direction) — the owner steers once; work flows.
//
// ★대표(2026-09-17):
//   「선언하기 전에는 멈춘다가 아니고 네가 자동으로 흘러가야지.
//     그 흘러가는 방향을 내가 설정하는 거고」
//   「사람이 올려놓으면 기계 AI가 할 수 있는 건 사람이 할 수 있는 데까지
//     논스톱으로 해줘야지, 오류 없이」
//
// ── What was wrong before
// The control tower holds an item until `intent` is user-confirmed, a commitment
// has an owner and a due date, and an authorization is GRANTED with proof. Nothing
// ever supplied those, so EVERY item held forever and the owner had to declare one
// by one. That is a gate model, and it is not what was asked for.
//
// ── ★What is NOT changed here
// Not one rule of the control tower. It still demands the same proof, with the same
// strictness. `evaluate-control-tower.mjs` is untouched.
// ★What was missing was never a rule. It was a SUPPLIER. The tower's authorization
// shape already carries action / target / scope[] / authorized_by / authorized_at /
// expires_at / revision — it was always able to let work flow. Nobody filled it.
//
// ── How a direction works
// The owner writes, once, per KIND of work: who owns it, how far the machine may go,
// what that permission covers, and how long an observation stays good. Every item of
// that kind then inherits it. An item that matches no direction inherits nothing and
// the tower holds it — so HOLD becomes the exception ("이건 어느 방향에도 안 맞는다"),
// not the default.
//
// ── ★The honest boundary, stated rather than pretended
// Writing `USER_CONFIRMED` because a direction exists is true ONLY IF a human really
// wrote that direction. This module cannot verify authorship — a string saying
// 세운이: '대표' is just a string. The authenticity rests on the direction file being
// owner-authored and reviewed in git, exactly like CLAUDE.md and the other 정본 files.
// ★So this module refuses to invent a direction, and every field it fills records
// WHICH direction filled it. "누가 허락했나" always has an answer.

const need = (condition, code) => { if (!condition) throw new Error(code); };
const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const when = (value) => (Number.isFinite(Date.parse(value)) ? Date.parse(value) : null);

/** A direction is only usable if it says who set it, when, and until when.
 *  ★An undated or never-expiring direction is a standing grant nobody revisits. */
export function 쓸수있나(방향, asOf) {
  const 이제 = when(asOf);
  if (이제 === null) return 'AS_OF_REQUIRED';
  if (!text(방향?.id)) return 'DIRECTION_ID_REQUIRED';
  if (!text(방향?.세운이)) return 'DIRECTION_AUTHOR_REQUIRED';
  const 세운때 = when(방향?.세운때);
  const 만료 = when(방향?.만료);
  if (세운때 === null || 만료 === null) return 'DIRECTION_WINDOW_REQUIRED';
  if (세운때 > 이제) return 'DIRECTION_FROM_FUTURE';
  if (만료 <= 이제) return 'DIRECTION_EXPIRED';
  return null;
}

/** Does this direction speak about this item? Every named key must match.
 *  ★An empty 적용 matches nothing. A direction that applies to everything is not a
 *    direction, it is a blanket grant. */
export function 맞는가(방향, 항목) {
  const 적용 = 방향?.적용;
  if (!적용 || typeof 적용 !== 'object' || !Object.keys(적용).length) return false;
  return Object.entries(적용).every(([키, 값]) => {
    /** ★`<칸>_시작` 은 그 칸이 이 글자로 «시작하는가» 를 본다 — 2026-09-17
     *
     *  왜 필요했나: 대표가 「과태료만 켜라」 했는데, 컨트롤타워 항목에는 «갈래» 칸이
     *  없다(id·project_id·title 뿐이다). project_id 로만 맞추면 aiops 일 «전부» 가
     *  걸려 대표가 허락한 것보다 «넓어진다». 그래서 업무 id 앞머리로 좁힌다.
     *  ★넓히는 장치가 아니라 «좁히는» 장치다. 빈 값은 아무것도 안 맞는다. */
    if (키.endsWith('_시작')) {
      const 실제 = String(항목?.[키.slice(0, -3)] ?? '');
      const 앞 = String(값);
      return 앞.length > 0 && 실제.startsWith(앞);
    }
    return String(항목?.[키] ?? '') === String(값);
  });
}

/**
 * 방향고르기(방향들, 항목, asOf) -> { 방향 } | { 막힘 }
 * ★Two directions claiming the same item is an ambiguity, not a choice. Refuse.
 */
export function 방향고르기(방향들, 항목, asOf) {
  const 후보 = (Array.isArray(방향들) ? 방향들 : []).filter((d) => 맞는가(d, 항목));
  if (!후보.length) return { 막힘: 'NO_DIRECTION' };
  const 쓸것 = [];
  for (const d of 후보) {
    const 왜 = 쓸수있나(d, asOf);
    if (!왜) 쓸것.push(d); else if (후보.length === 1) return { 막힘: 왜 };
  }
  if (!쓸것.length) return { 막힘: 'DIRECTION_UNUSABLE' };
  if (쓸것.length > 1) return { 막힘: 'DIRECTION_AMBIGUOUS' };
  return { 방향: 쓸것[0] };
}

const 시간뒤 = (기준, 시간) => new Date(when(기준) + Number(시간) * 3600_000).toISOString().replace(/\.\d+Z$/, 'Z');

/**
 * 방향적용({ 항목, 방향들, asOf }) -> { 항목, 쓴방향 } | { 항목, 막힘 }
 *
 * Fills the three fields the tower holds on, FROM the direction. Returns the item
 * untouched when no direction speaks about it — the tower then holds it, which is
 * the correct answer for work nobody has steered.
 */
export function 방향적용({ 항목, 방향들, asOf, 승인확인 = null }) {
  need(항목 && typeof 항목 === 'object', 'ITEM_REQUIRED');
  const 고름 = 방향고르기(방향들, 항목, asOf);
  if (고름.막힘) return { 항목, 막힘: 고름.막힘 };
  const d = 고름.방향;

  /** ★★★문자열만으로는 사람 승인이 되지 않는다 — GPT_REVIEW(2026-09-17)
   *
   *  「direction.mjs 자체가 세운이:'대표'는 결국 문자열이고 작성자 진위를 검증할 수
   *    없다고 «인정하면서», 적용 시 USER_CONFIRMED 와 authorization: GRANTED 를
   *    만든다. 그러므로 direction 파일의 «내용만으로» 사람 승인으로 승격하면 안 된다」
   *
   *  옳은 지적이다. 파일을 고칠 수 있는 누구나 대표의 승인을 «적어 넣을» 수 있었다.
   *  특히 DIR-ai-core개발·DIR-fp4 의 scope 에는 merge-to-main 까지 들어 있다.
   *
   *  ── ★고친 방식: 새 인증체계를 «만들지 않는다»
   *  GPT 지정대로 «기존 revision-bound evidence» 를 재사용한다. 방향은 자기 승인이
   *  어느 원장 사건에 적혀 있는지를 가리키고(승인근거.원장사건), 그 사건이 실제로
   *  해시체인 원장에 있는지는 «부르는 쪽» 이 확인해 승인확인()으로 넘긴다.
   *
   *  ★확인이 없거나 실패하면 승격하지 않는다. 방향은 «정책 후보» 로만 남고 항목은
   *    손대지 않는다 — 그러면 컨트롤타워가 예전처럼 세운다. 안전한 쪽이 기본값이다.
   *  ★이 모듈은 원장을 «읽지 않는다». 읽으면 순수 함수가 아니게 되고, 무엇을 신뢰
   *    하는지가 다시 흐려진다. 확인의 책임은 배선에 있고 여기서는 «요구» 만 한다. */
  const 근거 = d?.승인근거?.원장사건;
  if (!text(근거)) return { 항목, 막힘: 'DIRECTION_APPROVAL_EVIDENCE_REQUIRED' };
  if (typeof 승인확인 !== 'function') return { 항목, 막힘: 'DIRECTION_APPROVAL_UNVERIFIED' };
  if (승인확인({ 방향: d, 원장사건: 근거 }) !== true) return { 항목, 막힘: 'DIRECTION_APPROVAL_NOT_FOUND' };

  const 표 = `${d.id}/${d.세운이}@${근거}`;

  // ★intent: the owner confirmed this KIND of work when they wrote the direction.
  //   That is a real user confirmation, just made once instead of per item.
  const intent = { status: 'CONFIRMED', provenance: 'USER_CONFIRMED' };

  // ★commitment: owner and due come from the direction. `accepted` is true because
  //   the direction IS the acceptance — but only for items the direction matches.
  const 기한 = Number(d?.기한규칙?.며칠);
  const commitment = {
    status: 'ACTIVE',
    accepted: true,
    owner: text(d.주인),
    due_at: Number.isFinite(기한) ? 시간뒤(asOf, 기한 * 24) : null,
    dependencies: Array.isArray(항목?.commitment?.dependencies) ? 항목.commitment.dependencies : [],
  };

  // ★authorization: granted ONLY for what the direction explicitly scoped, and it
  //   carries where it came from. A direction with no 허가 block grants nothing —
  //   the work still flows up to the wall but the tower will hold execution, which
  //   is the right answer for "기계가 여기까지만 간다".
  const 허 = d.허가;
  const authorization = 허 && Array.isArray(허.scope) && 허.scope.length
    && 허.scope.every((scope) => text(scope) === scope)
    ? {
      required: true,
      status: 'GRANTED',
      action: text(허.action),
      target: text(허.target),
      scope: 허.scope.map(String),
      authorized_by: 표,
      authorized_at: new Date(when(d.세운때)).toISOString().replace(/\.\d+Z$/, 'Z'),
      expires_at: 시간뒤(asOf, Number(허.유효시간) || 24),
      revision: 항목.subject_revision ?? null,
    }
    : { required: true, status: 'PENDING' };

  // ★sources: how long an observation stays good is also a standing decision, not a
  //   per-item guess. Without it every derived observation is already expired.
  const 유효 = Number(d?.관측유효?.시간);
  const sources = Array.isArray(항목.sources) && Number.isFinite(유효)
    ? 항목.sources.map((s) => ({ ...s, valid_until: 시간뒤(s.observed_at, 유효) }))
    : 항목.sources;

  return { 항목: { ...항목, intent, commitment, authorization, sources }, 쓴방향: 표 };
}

/** 벽(walls) — where the machine stops because the OWNER said so, not because it failed.
 *  ★This is the difference the owner asked for: a wall is a decision, a HOLD is a gap. */
export function 벽인가(방향, 다음행동) {
  const 벽 = Array.isArray(방향?.벽) ? 방향.벽 : [];
  return 벽.includes(String(다음행동));
}
