# 둘이 상의한 기록 (Codex ↔ Claude)

1순위 규칙(`AGENTS.md` · `CLAUDE.md` 머리)의 «기록» 부분이 여기다.
**부른 사실과 답을 한 줄 남긴다. 기록이 없으면 안 부른 것으로 본다.**

한 줄 형식 — `날짜 · 부른 쪽 → 받는 쪽 · 무엇을 · 결과(ANSWERED / BLOCKED / FAILED) · 근거`

- `ANSWERED` 옆에는 답이 반영된 자리(PR 번호·파일·커밋)를 적는다.
- `BLOCKED` 는 상대가 막혀 있던 경우다. **풀리는 시각을 같이 적는다.** 막힘은 통과가 아니다.
- `FAILED` 는 불렀는데 실패한 경우다. 「안 부른 것」과 구별하려고 따로 둔다.

---

## 2026-09

| 날짜 | 방향 | 무엇을 | 결과 | 근거 |
|---|---|---|---|---|
| 09-21 | Codex → Claude | (미상) | `BLOCKED` | 사용량 한도. `blocked_until 2026-09-22T04:00Z` — `~/.codex/state/claude-usage-gate.json` |
| 09-22 ~ 09-27 | — | — | **기록 없음** | ★게이트는 09-22 새벽에 풀렸는데(`available: true / RESET_REACHED`) 6일간 호출 흔적이 없다. 이 공백이 규칙을 1순위로 올린 이유다 |
| 09-23 | Claude → Codex | 디자인 정본 병합 결과 알림(PR #250 코멘트) | `ANSWERED` | PR #250 병합 `590bb46` |
| 09-26 | Codex → Claude | 「PR #261·#262 가 211커밋 뒤처졌다 — 현재 main 위로 재추출하라」 | `FAILED` | ★PR 코멘트로 남겼으나 **Claude 세션을 깨우는 채널이 아니라 하루 넘게 방치**됐다. 대표가 직접 물어 09-27 에야 확인 |
| 09-27 | Claude → (기록) | 이 규칙과 기록부를 만들었다 | `ANSWERED` | 이 파일 · `AGENTS.md`·`CLAUDE.md` 1순위 절 |
| 09-27 | **Claude → Codex** | 「이 규칙이 Codex 작업 흐름에서 지켜질 수 있나 · 기록 부담이 과한가 · 빠진 것」 | `ANSWERED` | `codex exec -s read-only`. 답: **①지킬 수 있으나 «자동 게이트가 없어 호출·기록 없이 종료할 구멍»이 있다 ②1줄 기록은 과하지 않다 ③`academy:start/finish` 에서 중요 작업의 호출·로그 존재를 강제 검증하면 된다** |
| 09-27 | claude → codex | duo 채널 검토 — 「Codex 가 우편함을 실제 흐름에서 읽게 하려면?」 | `FAILED` | ★첫 호출이 Windows 에서 `spawnSync codex ENOENT` 로 실패했다. **그 실패가 우편함에 남아서 알았다** — 조용히 넘어가지 않는 게 이 채널의 요점이다 |
| 09-27 | claude → codex | 같은 질문, 셸 경유로 재시도 | `ANSWERED` | 「작업 시작 지침에 `npm run duo -- inbox` 실행을 필수화하고, 미답변 요청은 처리·회신(`answer`) 뒤 `CROSS_AI_LOG.md` 기록을 완료 조건으로 검사하라」 → **1순위 절에 반영함** |
| 09-27 | (검사) | aiops 그림자 신선도 | `ANSWERED` | ★새 검사가 실제 드리프트를 처음 잡았다 — aiops 가 `3d6ec8c`→`334b9474` 로 움직였는데 아무도 몰랐다. `--remote` 재확인 결과 경로 4개 모두 변화 없음 → `REVALIDATED` |

| 09-27 | claude → codex | 다음 순서 상의 | `ANSWERED` | (A)부터. main의 기존 테스트 35건 실패 원인을 먼저 규명해야 이후 B·C 변경의 회귀 여부와 완료 판정을 신뢰할 수 있다. |
| 09-27 | claude → codex | 실패 35건 원인 — 등록부 HOLD 연쇄 | `ANSWERED` | 2) 단위·E2E는 고정 fixture, 실제 등록부는 별도 통합·스모크 테스트에서만 읽어야 한다. |
| 09-27 | claude → codex | HOLD 연쇄가 의도대로인가 | `ANSWERED` | 맞다. 원격 HEAD가 바뀌면 기존 실행 증거가 새 revision을 보증하지 못하므로 refresh가 readiness를 HOLD로 내려야 하며, 재검증 후에만 사람이 ACTIVE로 올려야 한다. |
| 09-27 | claude → codex | 실제 경로 검사 3건 처리 | `ANSWERED` | (나). 실제 정본 연동이라는 검사 목적을 보존하면서 ACTIVE/HOLD 각각의 올바른 계약을 검증해, 서명 철회도 실패가 아닌 명시적 HOLD로 포착한다. |
| 09-27 | claude → codex | 실패 35건 정리 완료 보고 | `ANSWERED` | 가능하다. 검사에 `fixture ACTIVE ∩ 실제 registry ACTIVE = ∅` 불변식을 추가해, 실제 ACTIVE 복귀 시 중복 항목이 남으면 실패시키고 “fixture에서 제거”하도록 강제하면 된다. |
| 09-28 | claude → codex | Gemini CLI 403 #3501 — 원인 해석과 우회가 맞나 | `ANSWERED` | ★**계정 문제가 아니었다.** 구글이 `oauth-personal` 무료 경로를 끊었다(`UNSUPPORTED_CLIENT`). Codex: 「해석 맞음, 공식 종료라 0.61 로 올려도 복구 불가. 무료 API 에 저장소 코드 금지. 정본엔 인증방식·검증만, 키는 제외」 → [근거](https://github.com/google-gemini/gemini-cli/discussions/28017) · 조치는 [GEMINI_CLI_AUTH_LEARNING.md](GEMINI_CLI_AUTH_LEARNING.md) |
| 09-28 | claude → codex | 상품 갱신 워치독 설계안 — 반례를 대라 | `ANSWERED` | 「(4) 유지(워치독은 안 건다). 자동복구는 단일 발행자·멱등키·락 보장 후에만. **발행 나이는 빈·부분·오발행과 조회·알림 고장을 놓친다.** PC·망·워치독 동시 장애엔 침묵한다. 승인 규칙만으론 부족하다」 → 넷 다 [설계안](../integration/ERP5_CATALOG_WATCHDOG_DESIGN_2026-09-28.md)에 반영. ★이 쪽지는 `EPERM` 으로 **저장이 유실**됐다가 손으로 복원했다 — 그 고장이 `duo.mjs` 저장 재시도를 낳았다 |
---

## 왜 이게 필요했나 (실측)

1. **연동은 있었다.** `Codex → npm run claude:review → 새 claude 프로세스` 경로가 `~/.codex/AGENTS.md` 에 적혀 있고 배선도 살아 있다.
2. **그런데 그 호출은 사람이 열어 둔 Claude 대화로 오지 않는다.** 새 프로세스가 답하고 끝난다. 그래서 대화 쪽에서는 «답이 없는» 것처럼 보인다.
3. **호출 이력이 없었다.** 게이트 상태 파일 하나뿐이라 안 불렀는지, 부르다 실패했는지 구별할 수 없었다.
4. 그 결과 **막힌 뒤 풀린 것을 아무도 몰랐고**, 6일간 교차검토 없이 일이 진행됐다.

## 코덱스가 지적한 구멍 (2026-09-27 · 아직 안 막음)

규칙을 만든 당일, 그 규칙대로 Codex 에게 먼저 물었다. 답이 정확했다:

> **자동 게이트가 없어 호출·기록 없이 종료할 구멍이 있다.**

맞다. 지금은 «읽고 지키는» 규칙이라, 급할 때 건너뛰면 아무도 모른다.
Codex 제안: `academy:start` / `academy:finish` 에서 **중요 작업이면 호출·기록 존재를 강제 검증**한다.

→ 다음 작업으로 남긴다. 「중요 작업」의 경계(설계·규격·되돌리기 어려운 변경·중요 문안)는 1순위 절에 이미 적혀 있으므로,
   그 경계에 걸리는 작업은 이 기록부에 해당 날짜 줄이 없으면 `finish` 가 HOLD 로 떨어지게 하면 된다.

## 채널의 한계 (알고 쓰자)

- **Claude 는 상시 대기하지 않는다.** 이 대화가 열려 있을 때만 깨어 있다. PR 코멘트·파일 변경은 Claude 를 깨우지 않는다.
- 깨우려면 셋 중 하나다: ①사람이 Claude 창을 연다 ②`claude:review` 로 **새 프로세스**를 부른다 ③예약 작업이 주기적으로 확인한다.
- **②가 지금 쓰는 길이다.** 답은 그 프로세스가 돌려주고, 여기 한 줄로 남긴다.
