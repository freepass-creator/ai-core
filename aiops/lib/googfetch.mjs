/** ★★★구글에 «직접» 부를 때는 이걸 쓴다 — 맨 `fetch` 를 쓰면 문턱을 안 탄다.
 *
 *  코덱스(2026-09-03): 「모든 Drive·Firestore·Sheet 쓰기는 «어댑터에서» 거절해야 한다.
 *                       표↔소스 대조는 사전 경보일 뿐 최종 증명이 아니다.」
 *  ★맞는 말이다. 소스를 정규식으로 읽는 것은 «새 쓰기 방법이 생기면» 못 잡는다.
 *
 *  ── ★실측하니 문턱은 «이미 있었다». 안 타고 있었을 뿐이다
 *  `lib/goog.mjs` 의 `makeCall()` 이 쓰기 전에 `assertWriteAllowedForUrl()` 을 부른다.
 *  ★그런데 도구 «12개» 가 그걸 안 거치고 맨 `fetch(...)` 로 구글을 직접 부른다:
 *      gojiseo-jjogaegi · gwataeryo-daejang-siteu · gwataeryo-gyeopchim-chiugi
 *      gwataeryo-hapui · gwataeryo-yongryang-jurigi · gyeyak-iryeok-siteu …
 *  ★★그 도구들은 lease 없이도 드라이브·시트를 바꾼다. 문턱이 있으나 마나였다.
 *
 *  ── ★그래서 «부르는 자리» 를 하나로 모은다
 *  파일 올리기(multipart)처럼 makeCall 로 못 하는 것도 있어서 makeCall 로 다 옮기진 못한다.
 *  ★대신 이 함수가 «문턱만» 태우고 fetch 는 그대로 쓰게 한다. 옮기기 쉽고 빠뜨릴 데가 없다.
 *
 *      import { 구글부르기 } from '../lib/googfetch.mjs';
 *      const r = await 구글부르기(url, { method: 'POST', headers, body });
 */
import { assertWriteAllowedForUrl } from './lease.mjs';

export async function 구글부르기(url, opts = {}) {
  /** ★쓰기면 lease 를 확인한다. 없으면 «여기서» 선다 — 구글에 닿지 않는다 */
  await assertWriteAllowedForUrl(String(url), opts.method || 'GET');
  return fetch(url, opts);
}

/** ★같은 것 — 이름만 영어로 (섞어 쓰는 도구가 있다) */
export const googFetch = 구글부르기;
