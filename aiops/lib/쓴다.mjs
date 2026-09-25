/**
 * ★★쓴다 — 시트·드라이브에 «절차 없이» 쓴다.
 *
 * 대표(2026-08-30): 「쓰기 이런 거 이제 다 권한 풀어 · 다 그런 거 없이 다 만들어놔」
 *
 * ── 전에는 이랬다
 *   ① 작업대장에 DRAFT 를 만들고  ② DESIGN 승인을 받고  ③ 코덱스가 DRY 를 돌리고
 *   ④ 대표 직전 승인을 받고       ⑤ scripts/with-lease.mjs 로 taskId·approval 을 손으로 넣어 실행
 *   → 다섯 걸음 중 하나만 빠져도 멈췄다. 실제로 lease 가 만료돼 일이 통째로 멈춘 날이 있었다.
 *
 * ── 이제는 이렇다
 *   await 쓴다('sheet:<id>', '무엇을 하는지', async () => { ...그냥 쓴다... })
 *
 *   작업번호는 «스스로» 만들고, 만료된 lease 는 «스스로» 걷어내고, 누가 언제 무엇을 했는지는 그대로 남는다.
 *
 * ── ★없앤 것과 남긴 것을 갈라 둔다
 *   없앴다 : 승인 절차 · 「코덱스만」 · 작업번호를 손으로 짓는 일        ← 사람을 막던 것
 *   남겼다 : 같은 자원에 «동시에» 두 손이 들어가는 것을 막는 잠금        ← 자료를 지키는 것
 *
 *   ★이 둘은 다른 것이다. 잠금은 «권한» 이 아니라 «차례» 다.
 *   구글 시트는 읽고-쓰는 사이에 남이 끼어들면 그 줄이 통째로 날아간다(compare-and-swap 이 없다).
 *   2026-08-25 에 인수인계 시트 탭 셋이 그렇게 사라진 적이 있다.
 *   그래서 잠금은 두되, ★기다리는 일이 없게 «스스로 풀리도록» 만들었다.
 */
import { randomUUID } from 'node:crypto';
import { LeaseBusyError, appendAudit, listLeases, withLease } from './lease.mjs';

/** 작업번호를 스스로 짓는다 — 사람이 `OPS-20260830-007` 을 외울 이유가 없다 */
export function 작업번호(꼬리 = '') {
  const d = new Date();
  const 날 = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const 셋 = String(Math.floor(Math.random() * 900) + 100);
  /** 꼬리는 소문자·숫자·붙임표만 — 무슨 일이었는지 나중에 알아보라고 붙인다 */
  const 깨끗 = String(꼬리).toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 31);
  return `OPS-${날}-${셋}${깨끗 ? `-${깨끗}` : ''}`;
}

const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * ★한 번 부르면 끝난다.
 *
 * @param {string|string[]} 어디   `sheet:<스프레드시트id>` · `drive` · 여럿이면 배열
 * @param {string}          왜     무엇을 하는지 한 줄. ★감사기록에 그대로 남는다
 * @param {Function}        일     그 안에서 그냥 쓴다
 * @param {object}          [옵션] { 누가='claude', 기다린다=true, 작업 }
 *
 * @example
 *   await 쓴다('sheet:1AbC…', '시세 탭 104대 다시 박기', async () => {
 *     await 표.고친다(...);
 *   });
 */
export async function 쓴다(어디, 왜, 일, 옵션 = {}) {
  const { 누가 = 'claude', 기다린다 = true, 작업 } = 옵션;
  const 목 = Array.isArray(어디) ? 어디 : [어디];
  if (!목.length) throw new Error('어디에 쓸지를 대야 한다 — 예: sheet:<id> · drive');
  if (typeof 일 !== 'function') throw new Error('할 일을 함수로 넘겨야 한다');
  const taskId = 작업 || 작업번호(왜);
  const purpose = String(왜 || '').trim() || '(왜를 안 적었다)';

  /** ★남이 쥐고 있으면 «막는» 게 아니라 «기다린다». 그 사이 lease 가 만료되면 lease.mjs 가 걷어낸다 */
  const 참을때 = [0, 3_000, 8_000, 20_000, 45_000];
  let 마지막;
  for (let 번 = 0; 번 < 참을때.length; 번 += 1) {
    if (참을때[번]) await 잠깐(참을때[번]);
    try {
      return await withLease(목, { agent: 누가, taskId, purpose }, () => 일());
    } catch (e) {
      마지막 = e;
      if (!(e instanceof LeaseBusyError) || !기다린다) throw e;
      const 남은 = 참을때.length - 번 - 1;
      if (!남은) break;
      console.error(`  ⏳ ${e.target} 를 ${e.owner?.agent ?? '누군가'} 가 쥐고 있다. ${참을때[번 + 1] / 1000}초 뒤 다시 — (${남은}번 남음)`);
    }
  }

  /** ★여기까지 왔으면 진짜로 막힌 것이다. «누가» 쥐고 있는지 대 준다 — 그래야 사람이 고른다 */
  const 쥔것 = (await listLeases().catch(() => [])).filter((x) => 목.includes(x.target));
  await appendAudit({ type: 'write-blocked', agent: 누가, taskId, resources: 목, purpose });
  const 누구 = 쥔것.map((x) => `${x.target} ← ${x.agent}/${x.taskId} (${x.purpose})${x.expired ? ' ★만료됨' : ''}`).join('\n    ');
  throw new Error(
    `쓰지 못했다 — 자원을 남이 쥐고 있다.\n    ${누구 || 마지막?.message}\n`
    + `  ★만료된 것이면 다시 부르면 걷어내고 들어간다. 살아 있으면 그쪽이 끝나야 한다.\n`
    + `  지금 누가 쥐고 있나: node scripts/잠금.mjs`,
  );
}

/**
 * ★한 줄로 — 스크립트 맨 끝에서 부른다.
 *
 *   await 시트에쓴다('1AbC…', '시세 탭 다시 박기', async () => { … })
 */
export const 시트에쓴다 = (시트id, 왜, 일, 옵션) => 쓴다(`sheet:${시트id}`, 왜, 일, 옵션);
export const 드라이브에쓴다 = (왜, 일, 옵션) => 쓴다('drive', 왜, 일, 옵션);

/** 시트와 드라이브를 같이 만질 때 — 순서는 lease.mjs 가 정렬해 교착을 막는다 */
export const 둘다쓴다 = (시트id, 왜, 일, 옵션) => 쓴다([`sheet:${시트id}`, 'drive'], 왜, 일, 옵션);

export { randomUUID };
