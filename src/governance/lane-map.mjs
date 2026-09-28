// lane 지도를 «읽는» 한 자리. 정본은 registry/lanes.json 이고 여기서만 해석한다.
//
// ★대표 2026-09-28: 「어떤 구분값을 다 이렇게 공백이 없게끔 처리할 수 있는 방법으로 가야 될 것 같아」
//   그래서 이 파일은 두 가지를 보장한다 — **덮임**(모든 파일이 어느 lane 에 속한다)과
//   **배타**(둘 이상이 같은 파일을 주장하지 않는다). 둘 다 검사가 강제한다.
//
//   해석기를 여기 하나만 두는 이유: CODEOWNERS·문서·검사가 각자 규칙을 다시 쓰면 서로 어긋나고,
//   그 어긋남이 새 공백이 된다.

/** 규칙 A — 검사와 계약은 «대상»의 lane 을 따른다.
 *
 *  `test/erp5-keeper.test.mjs` → `erp5-keeper` 라는 이름으로 되돌려 다시 묻는다.
 *  그래야 한 작업이 두 lane 을 건드리지 않는다(실측: 횡단 10건 중 6건이 이 모양이었다). */
export function 대상이름(경로) {
  const m = /^(?:test|contracts)\/(.+)$/.exec(경로);
  if (!m) return null;
  return m[1]
    .replace(/\.(test|spec)\.[cm]?[jt]s$/, '')
    .replace(/\.schema\.json$/, '')
    .replace(/\.[cm]?[jt]s$|\.json$/, '');
}

/**
 * 파일 하나의 lane 을 정한다. 못 정하면 null — ★「기타」로 삼키지 않는다.
 *
 * @returns {{lane: string|null, by: string}} 어떤 규칙으로 정해졌는지 함께 돌려준다(검사가 이유를 보여 줄 수 있게).
 */
export function laneOf(경로, 지도) {
  const 정규 = String(경로).split('\\').join('/');

  for (const p of 지도.paths) {
    if (new RegExp(p.pattern).test(정규)) return { lane: p.lane, by: p.rule ? `규칙 ${p.rule}` : p.pattern };
  }

  /** 규칙 A 는 «경로»가 아니라 «대상»으로 다시 묻는 것이라 위 순회 뒤에 온다. */
  const 대상 = 대상이름(정규);
  if (대상) {
    for (const p of 지도.paths) {
      if (new RegExp(p.pattern).test(대상) || new RegExp(p.pattern).test(`scripts/${대상}.mjs`) || new RegExp(p.pattern).test(`src/${대상}.mjs`)) {
        return { lane: p.lane, by: `규칙 A(대상 ${대상})` };
      }
    }
  }

  return { lane: null, by: '없음' };
}

/**
 * 덮임과 배타를 한꺼번에 본다.
 *
 * ★공백은 «규칙 위반»이 아니라 «고장»이다. 그래서 목록으로 돌려주고, 검사가 그걸로 FAIL 한다.
 */
export function 덮임검사(파일들, 지도) {
  const 공백 = [];
  const lane별 = {};
  for (const f of 파일들) {
    const { lane } = laneOf(f, 지도);
    if (!lane) { 공백.push(f); continue; }
    (lane별[lane] ??= []).push(f);
  }
  return { 공백, lane별, 덮인수: 파일들.length - 공백.length, 전체: 파일들.length };
}

/**
 * ★배타를 「두 규칙이 맞으면 안 된다」로 두려다 고쳤다 (2026-09-28).
 *
 *  좁은 규칙과 넓은 규칙은 «당연히» 겹친다 — `^(scripts|…)/.*(erp5-keeper)` 와 `^scripts/` 처럼.
 *  겹침을 금지하면 부정 전방탐색 괴물이 되고, 규칙을 읽을 수 없게 된다(실측: 32건이 전부 이 모양이었다).
 *  `.gitignore` 도 CODEOWNERS 도 겹침을 허용하고 «순서»로 정한다. 그게 표준이다.
 *
 *  그래서 지도는 **먼저 맞는 규칙이 이긴다**로 정하고, 배타 대신 진짜 위험을 검사한다 —
 *  **사문(死文)**: 앞 규칙이 늘 먼저 가져가서 «한 번도 이기지 못하는» 규칙.
 *  그런 줄은 읽는 사람을 속인다. 있는 줄 알았던 분류가 실은 없는 것이고, 그게 공백의 다른 얼굴이다.
 */
export function 사문검사(파일들, 지도) {
  const 이긴횟수 = new Map(지도.paths.map((p) => [p.pattern, 0]));
  for (const f of 파일들) {
    const 정규 = String(f).split('\\').join('/');
    const 이긴것 = 지도.paths.find((p) => new RegExp(p.pattern).test(정규));
    if (이긴것) 이긴횟수.set(이긴것.pattern, 이긴횟수.get(이긴것.pattern) + 1);
  }
  return 지도.paths.filter((p) => 이긴횟수.get(p.pattern) === 0).map((p) => ({ pattern: p.pattern, lane: p.lane }));
}

/** CODEOWNERS 를 «이 지도에서» 만든다. 손으로 따로 쓰면 어긋나고, 그 어긋남이 새 공백이다. */
export function codeowners(지도, 소유자) {
  const 줄 = [
    '# 이 파일은 생성물이다 — 손으로 고치지 마라.',
    '#   만드는 곳: node scripts/check-lane-coverage.mjs --write-codeowners',
    '#   정본:      registry/lanes.json',
    '#',
    '# ★맨 위 포괄 줄은 «리뷰어 없는 파일»을 만들지 않기 위한 것이다(GitHub 은 마지막으로 맞는 줄을 쓴다).',
    '#   분류를 강제하는 일은 CODEOWNERS 가 아니라 check-lane-coverage 가 한다 — 거기엔 fallback 이 없다.',
    '',
    `* ${소유자[지도.unmatched.codeowners_catch_all]}`,
    ''
  ];
  for (const [코드, lane] of Object.entries(지도.lanes)) {
    const 경로들 = 지도.paths.filter((p) => p.lane === 코드);
    if (!경로들.length) continue;
    줄.push(`# ${코드} — ${lane.title}${lane.dormant ? ' (잠금)' : ''}`);
    for (const p of 경로들) {
      const glob = 규칙을글롭으로(p.pattern);
      if (glob) 줄.push(`${glob} ${소유자[코드]}`);
    }
    줄.push('');
  }
  return 줄.join('\n');
}

/** 정규식 경로 규칙 중 «디렉터리 형태»만 글롭으로 옮긴다. 이름 조각 규칙은 CODEOWNERS 로 표현할 수 없다. */
export function 규칙을글롭으로(pattern) {
  const m = /^\^([A-Za-z0-9_.\\/-]+)\/$/.exec(pattern);
  if (!m) return null;
  return `/${m[1].split('\\.').join('.')}/`;
}
