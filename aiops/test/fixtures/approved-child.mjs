/** ★with-lease 가 자식에게 «무엇을 물려주나» 를 보는 붙박이.
 *
 *  ── ★2026-09-03 — 여기가 「codex」 만 받아서 시험이 깨져 있었다
 *  2026-08-25 에 대표 승인으로 «클로드도 잠금을 잡게» 열었다(lease.mjs 잡을수있는).
 *  with-lease 의 기본 실행자도 그때 `codex` → `claude` 로 바뀌었다.
 *  ★그런데 이 붙박이만 옛 세상에 남아 「codex 가 아니면 4번으로 죽어라」 였다.
 *
 *  ★볼 것은 «누구냐» 가 아니라 «잠금을 물려받았느냐» 다.
 *    누가 잡았는지는 lease.mjs 의 잡을수있는 이 이미 본다. 여기서 또 이름을 박으면
 *    사람을 늘릴 때마다 두 곳을 고쳐야 하고, 한 곳을 잊으면 오늘처럼 조용히 깨진다.
 */
const 잡을수있는 = ['codex', 'claude'];
if (!잡을수있는.includes(process.env.AIOPS_AGENT) || !process.env.AIOPS_LEASES) process.exit(4);
process.exit(0);
