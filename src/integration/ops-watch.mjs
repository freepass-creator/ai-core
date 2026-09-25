// 운영 회차가 «제때 돌았나» 와 «자료가 언제 것인가» 를 가른다 — 지켜보기만 한다.
//
// ★2026-09-18: freepasserp5 상품이 13시간 안 바뀌었는데 아무도 몰랐다. 카톡 응대가 낡은
//   재고로 나가고 나서야 드러났다. 까닭은 셋이 겹친 것이었다 —
//     ① 창이 월~토 09:05~19:05 라 밤에는 원래 안 돈다(설계)
//     ② GitHub 예약이 하루 11번 중 1~3번만 왔고, 09:05 회차가 12:53 에야 왔다
//     ③ 09-17 23:47 회차는 «실패» 로 끝났지만 자료는 실제로 반영됐다(마지막 대조 검사만 빨강)
//   ③ 때문에 회차 결과만 보면 틀린다. 그래서 둘을 따로 본다:
//     회차 건강  — GitHub 이 말하는 것(왔나·끝났나·실패했나)
//     자료 나이  — 발행 기록 문서가 말하는 것(마지막 스냅샷이 언제 것인가)
//
// ★판정만 한다. 돌리지 않고, 다시 걸지 않고, 쓰지 않는다.
// ★못 읽으면 UNKNOWN — 「멈췄다」도 「괜찮다」도 아니다.

const 분 = 60_000;
const 순위 = { OK: 0, OFF_HOURS: 0, LATE: 2, STALE_PUBLICATION: 2, FAILED: 3, UNKNOWN: 1 };

const 시분 = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };

/** 오늘(그 시간대의 날짜) 창 안의 회차 시각들 — UTC ms. */
export function 오늘회차(창, now) {
  const 차 = (창.시간대차분 ?? 0) * 분;
  const 현지 = new Date(now.getTime() + 차);
  const 자정 = Date.UTC(현지.getUTCFullYear(), 현지.getUTCMonth(), 현지.getUTCDate()) - 차;
  if (!창.요일.includes(현지.getUTCDay())) return [];
  const 회차 = [];
  for (let m = 시분(창.시작); m <= 시분(창.끝); m += 창.간격분) 회차.push(자정 + m * 분);
  return 회차;
}

/** snapshotId 의 앞 17자리(yyyyMMddHHmmssSSS, UTC) 또는 시각 칸에서 발행 시각을 읽는다. */
export function 발행시각(문서) {
  const id = String(문서?.snapshotId ?? '');
  const m = id.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})?/);
  if (m) {
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +(m[7] ?? 0));
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7] ?? '000'}Z`;
    if (Number.isFinite(t) && new Date(t).toISOString() === iso) return t;
  }
  for (const k of ['verifiedAt', 'publishedAt', 'updatedAt']) {
    const t = Date.parse(문서?.[k] ?? '');
    if (Number.isFinite(t)) return t;
  }
  return null;
}

/**
 * 판정({ op, runs, publication, now })
 *   runs        — GitHub 회차 [{ id, event, status, conclusion, created_at, url }] 새것부터. 못 읽었으면 null
 *   publication — 발행 기록 문서(평평한 값). 못 읽었으면 null. 발행기록을 안 적은 운영이면 undefined
 */
export function 판정({ op, runs, publication, now = new Date() }) {
  const 이유 = [];
  const 회차 = 오늘회차(op.창, now);
  const 지연 = (op.허용지연분 ?? 30) * 분;
  const 창안 = 회차.length > 0 && now.getTime() >= 회차[0] && now.getTime() <= 회차.at(-1) + 지연;
  const 결과 = { id: op.id, 담당: op.담당 ?? null, now: now.toISOString(), 창안 };

  if (!Array.isArray(runs)) {
    이유.push({ status: 'UNKNOWN', code: 'RUNS_UNOBSERVED' });
  } else {
    const 예약 = runs.filter((r) => r.event === 'schedule');
    const 오늘시작 = 회차[0] ?? Infinity;
    const 지난회차 = 회차.filter((s) => s + 지연 <= now.getTime());
    결과.회차 = { 기대_지금까지: 지난회차.length, 온_오늘: 예약.filter((r) => Date.parse(r.created_at) >= 오늘시작 - 10 * 분).length };
    결과.마지막회차 = runs[0] ?? null;
    결과.마지막성공 = runs.find((r) => r.conclusion === 'success') ?? null;

    /** 마지막으로 «와야 했던» 회차 뒤에 어떤 회차(예약이든 손이든)라도 시작됐나. */
    const 마지막기대 = 지난회차.at(-1);
    if (창안 && 마지막기대 !== undefined && !runs.some((r) => Date.parse(r.created_at) >= 마지막기대 - 10 * 분)) {
      이유.push({ status: 'LATE', code: 'SCHEDULED_RUN_MISSING', 기대: new Date(마지막기대).toISOString() });
    }
    /** 끝난 회차 중 가장 새것이 실패면 — 그 뒤에 성공이 없으니 실패가 지금 상태다. */
    const 끝난것 = runs.find((r) => r.status === 'completed');
    if (끝난것 && 끝난것.conclusion !== 'success') {
      이유.push({ status: 'FAILED', code: 'LAST_RUN_FAILED', run: 끝난것.id, conclusion: 끝난것.conclusion, url: 끝난것.url ?? null });
    }
  }

  if (op.발행기록) {
    if (publication === null || publication === undefined) {
      이유.push({ status: 'UNKNOWN', code: 'PUBLICATION_UNOBSERVED' });
    } else {
      const t = 발행시각(publication);
      if (t === null) 이유.push({ status: 'UNKNOWN', code: 'PUBLICATION_TIME_UNREADABLE' });
      else {
        const 나이 = Math.round((now.getTime() - t) / 분);
        결과.발행 = { at: new Date(t).toISOString(), 나이분: 나이, snapshotId: publication.snapshotId ?? null };
        /** 창이 열리고 허용나이가 지나기 전에는 밤새 묵은 것을 울리지 않는다 — 설계대로 안 돈 것이다. */
        const 허용 = (op.발행기록.허용나이분 ?? 120) * 분;
        if (창안 && now.getTime() - 회차[0] >= 허용 && now.getTime() - t > 허용) {
          이유.push({ status: 'STALE_PUBLICATION', code: 'PUBLICATION_OLDER_THAN_ALLOWED', 나이분: 나이 });
        }
      }
    }
  }

  /** ★실패한 회차가 시작된 «뒤» 에 발행이 찍혔으면 자료는 들어간 것이다 — 뒤 검사만 빨강.
   *  둘을 같은 빨강으로 울리면 매 회차 거짓 경보가 되고, 그러면 진짜 경보를 아무도 안 믿는다. */
  const 실패 = 이유.find((이) => 이.code === 'LAST_RUN_FAILED');
  if (실패 && 결과.발행) {
    const 회 = runs.find((r) => r.id === 실패.run);
    실패.자료반영 = Date.parse(결과.발행.at) >= Date.parse(회?.created_at ?? '');
  }

  const 가장 = 이유.reduce((a, b) => (순위[b.status] > 순위[a] ? b.status : a), 창안 ? 'OK' : 'OFF_HOURS');
  return { ...결과, status: 가장, 이유 };
}

/**
 * 사람에게 알릴 것인가 — «우리 몫» 의 진짜 문제에만 운다.
 *   운다: UNKNOWN(못 봄) · LATE(안 옴) · STALE_PUBLICATION · 자료가 안 바뀐 FAILED
 *   안 운다: OK · OFF_HOURS · 자료는 들어갔고 회차 뒤 검사만 빨강인 FAILED
 * ★거짓 빨간불이 매 회차 울리면 진짜 빨간불을 아무도 안 믿는다(aiops 2026-09-02 「경보는 내 몫에만」).
 */
export const 알릴까 = (판) => 판.이유.some((이) => (이.code === 'LAST_RUN_FAILED' ? 이.자료반영 !== true : true));
