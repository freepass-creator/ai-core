// 가지가 «main 으로 흐르고 있나»를 판정한다. 정책을 새로 만들지 않는다 — 이미 있는 숫자를 읽어 쓴다.
//
// ★대표 2026-09-29: 「브랜치 이런 거 메인에 다 병합되게 «한 방향»으로 잘 가게 해줘야 돼」
//
//   registry/development-continuity-policy.json 에는 2026-09-26 부터 이미 다 적혀 있었다 —
//   trunk-based, 활성 작업선 hard_max 3(ai-core=COMPLEX), 가지 수명 72시간, actor 접두사 금지,
//   actor_prefixed_unique_target 0. **강제하는 것이 없었을 뿐이다.** 그 사이 원격 가지가 126개가 됐다.
//
//   왜 안 걸렸나: `check-branch-discipline.mjs` 는 «PR 의 head» 하나만 본다.
//   이미 서 있는 가지는 아무도 안 봤다. 그래서 여기서 **전수**로 본다.

/** 한 가지가 흐르고 있나. 흐르지 않으면 «왜»를 함께 돌려준다 — 이유 없는 FAIL 은 고칠 수 없다. */
export function 흐르나(가지, 정책, 지금 = new Date()) {
  const 흐름 = 정책.flow_enforcement;
  if (흐름.exempt_refs.includes(가지.ref)) return { 흐름: '면제', 까닭: '정책이 면제로 지정' };
  if (흐름.exempt_prefixes.some((p) => 가지.ref.startsWith(p))) return { 흐름: '면제', 까닭: '아카이브 — 닫힌 가지의 도달 가능성을 붙잡는다' };

  /** ★만료형 예외만 받는다 (Codex 반례 2026-09-29: 「동시 생성 경합·긴급 작업 차단」).
   *  만료 없는 예외는 영구 구멍이 된다 — 이 저장소가 그렇게 126개가 됐다.
   *  expires 가 지나면 «스스로» 사라져 다시 위반으로 돌아온다. */
  const 예외 = (흐름.expiring_exceptions ?? []).find((x) => x.branch === 가지.ref);
  if (예외) {
    const 오늘 = 지금.toISOString().slice(0, 10);
    if (!예외.expires) return { 흐름: '위반', 까닭: 'EXCEPTION_WITHOUT_EXPIRY: 만료 없는 예외는 받지 않는다', 고치는법: 'expires 를 적거나 예외를 지운다' };
    if (예외.expires >= 오늘) return { 흐름: '면제', 까닭: `만료형 예외 — ${예외.expires} 까지 · ${예외.why}` };
    return { 흐름: '위반', 까닭: `EXCEPTION_EXPIRED: ${예외.expires} 에 만료됐다`, 고치는법: 예외.then ?? '예외를 갱신하거나 가지를 정리한다' };
  }

  const 금지 = (정책.branch_naming.forbidden_actor_prefixes ?? []).find((p) => 가지.ref.startsWith(p));
  if (금지) return { 흐름: '위반', 까닭: `ACTOR_PREFIX: '${금지}' — 가지는 «일»의 것이지 AI 의 것이 아니다`, 고치는법: 'work/<project-id>/<work-id> 로 다시 연다' };

  if (가지.열린PR) return { 흐름: '흐름', 까닭: `PR #${가지.열린PR} 로 main 을 향하는 중` };

  const 나이시간 = (지금 - new Date(가지.마지막커밋)) / 3_600_000;
  if (나이시간 <= 흐름.flowing_when.younger_than_hours) {
    return { 흐름: '흐름', 까닭: `${Math.round(나이시간)}시간 — 아직 어리다` };
  }

  return {
    흐름: '위반',
    까닭: `STALLED: ${Math.round(나이시간 / 24)}일째 멈춰 있고 열린 PR 도 없다`,
    고치는법: 'PR 을 열어 main 으로 보내거나, 아카이브에 묶어 닫는다'
  };
}

/** 활성 작업선이 몇 개나 되나 — 정책의 hard_max 를 넘으면 그 자체가 위반이다. */
export function 활성한도(가지들, 정책, 지금 = new Date()) {
  const 프로필 = 정책.project_profiles['ai-core'];
  const 한도 = 정책.profiles[프로필].hard_max_active_work_branches;
  const 활성 = 가지들.filter((b) => 흐르나(b, 정책, 지금).흐름 === '흐름');
  return { 프로필, 한도, 활성: 활성.length, 넘음: Math.max(0, 활성.length - 한도), 목록: 활성.map((b) => b.ref) };
}

/**
 * ★로컬 전용 가지 — 원격 어디에도 없는 것은 «아직 아무 데로도 안 흐르는» 것이다.
 *
 *  대표 2026-09-29: 「지금 뭐 분기 생기고 이런 거 아니지? 한 방향으로 고도화되고 있지?」
 *  그때 원격은 7개·위반 0 이었는데 **로컬은 67개**였고, 그중 24개는 main 에도 아카이브에도 없었다.
 *
 *  ★이게 없던 것이 내 잘못이다. `refs/remotes/origin` 만 보고 「한 방향」이라 말했다 —
 *    기존 검사를 두고 「PR head 만 본다」고 지적해 놓고 같은 맹점을 내가 만들었다.
 *    로컬은 사람마다 달라 FAIL 로 막을 수 없지만, **세지 않으면 없는 것이 되어 버린다.**
 */
export function 로컬전용(로컬들, 원격이름들, 보존확인) {
  const 통 = { main에있음: [], 보존됨: [], 어디에도없음: [] };
  for (const b of 로컬들) {
    if (원격이름들.has(b.ref)) continue;
    if (!b.앞선커밋) { 통.main에있음.push(b); continue; }
    (보존확인(b) ? 통.보존됨 : 통.어디에도없음).push(b);
  }
  return 통;
}

/** 전수 판정. ★「기타」 통이 없다 — 모든 가지가 면제·흐름·위반 셋 중 하나에 들어간다. */
export function 전수판정(가지들, 정책, 지금 = new Date()) {
  const 통 = { 면제: [], 흐름: [], 위반: [] };
  for (const b of 가지들) {
    const 판 = 흐르나(b, 정책, 지금);
    통[판.흐름].push({ ...b, ...판 });
  }
  const 합 = 통.면제.length + 통.흐름.length + 통.위반.length;
  if (합 !== 가지들.length) throw new Error(`BRANCH_FLOW_BUCKETS_INCOMPLETE: ${합} !== ${가지들.length}`);
  return { ...통, 한도: 활성한도(가지들, 정책, 지금) };
}
