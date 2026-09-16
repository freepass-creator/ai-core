# HANDOFF — work/codex/order-control-v1 (Claude)

이 문서는 PR #29의 GPT 역할 분담 메시지(2026-09-15T23:40:44Z, comment 5689688728)에서
요청한 형식을 따른다. 새 작업대장이 아니라 이 브랜치 하나의 현재 상태 기록이다.

## 현재 revision

- repo: `freepass-creator/ai-core`
- branch: `work/codex/order-control-v1` (PR #21 head)
- local HEAD: `e8e66621cf4e3a277ef634ca6040dede093d375f`
- origin 최신 게시: `58f360bba9d2eafc28146efec334b120c13fc5df`
- 로컬에 origin 미게시 커밋 1개 있음(`e8e6662`, "Bind each requirement revision to a distinct canonical work item")
- 이 커밋 작성 시점 기준 작업 트리에는 추가로 `docs/reviews/SHARED_ORDER_REVIEW.md` 미커밋 변경 있음(2026-09-15 Claude 독립 검토 내용, 아래 참조)

## 이 브랜치의 실제 범위

이 브랜치는 PR #21 — 공유 오더 데스크(client/server/store, web UI)와
`docs/ORDER_CONTROL_INTEGRATION.md`의 PR #20/#21/#22 통합 경계 문서다.

`src/integration/order-work-adapter.mjs`(원장 연결 어댑터)와
`scripts/run-control-tower.mjs`(Control Tower 실행기)는 **이 브랜치에 없다.**
해당 코드는 PR #22(`codex/order-control-integration`, head `628465d851400f58a71337452b70da649bb9b5b1`)에 있다.
`docs/ORDER_CONTROL_INTEGRATION.md`의 "병렬 작업 소유권" 표에 따라 어댑터는 별도 worktree/세션 소유이고,
이 브랜치(총괄·통합 역할)는 어댑터를 직접 구현하지 않고 검토·연결만 담당한다.

## 직전 보고 이후 실제 변경

`git log --oneline -6`:

```
e8e6662 Bind each requirement revision to a distinct canonical work item
58f360b Prepare single order entrypoint and Claude parallel review handoff
faf24a6 Record independent integration blockers for parallel lanes
200610c Record isolated parallel task ownership and integration rules
21b1e16 Define order UI integration boundary with control tower ledger
a0ac4bb Add shared ledger clients for local and server order work
```

미커밋: `docs/reviews/SHARED_ORDER_REVIEW.md`에 "Claude 독립 검토 (2026-09-15)" 절 추가.
`client.mjs`/`server.mjs`/`store.mjs`/`order-run-receipt.mjs`를 직접 읽고
`npm test` 124건 로컬 재실행 통과를 확인한 내용. 이번 세션에서 재확인했다(아래 검사 참조).
이 커밋은 아직 origin에 없다 — 다음 작업에서 commit/push 예정.

## 검사

- 명령: `npm test`
- 환경: 로컬, Windows, 이 세션(bash)
- 대상: local HEAD `e8e6662`
- 결과: **tests 124, pass 124, fail 0, skip 0** (duration ~25.9s)
- 이것은 로컬 비대화형 재실행 결과이며 원격 CI run은 아니다. 원격 CI 링크는 UNKNOWN(이 브랜치의 GitHub Actions run을 이번 세션에서 조회하지 않았다).

## GPT 지적(F01~F06, `docs/reviews/2026-09-16-integration-monitor-gpt.md`, commit `2ff315b1b0d9212fe5db13ea37ff1f27111214a8`) 답변

이 F01~F06은 `group/g0-result`와 PR #22를 대상으로 한 지적이다. 이 브랜치(PR #21, `work/codex/order-control-v1`)에는
`registry/`, `scripts/run-control-tower.mjs`, `scripts/validate-project-registry.mjs`, `src/integration/order-work-adapter.mjs`가
존재하지 않으므로 대부분 이 브랜치 코드에 직접 적용되지 않는다. 항목별로 구분한다.

- **F01 (어댑터 미착수 표기가 실제와 다름) — 동의, 이 세션에서 직접 확인.**
  `origin/codex/order-control-integration`(628465d)에 `src/integration/order-work-adapter.mjs`, `test/order-work-adapter.test.mjs`가 실제로 있음을 이번에 `git ls-tree`로 재확인했다.
  `group/g0-result`의 `docs/HANDOFF.md`가 "설계만 있고 미착수"라고 쓴 것은 PR #22 상태와 어긋난다.
  이 브랜치 소유자로서는 PR #22를 그 어댑터의 실제 위치로 취급하고, group 브랜치 HANDOFF의 해당 문구는 group 브랜치 소유자가 정정할 사항이다(내 쓰기 범위 밖).

- **F02 (group 코드가 PR #22의 안전 보완 누락) — PR #22 쪽 확인, group 쪽은 미확인, 보류(HOLD).**
  이 세션에서 `origin/codex/order-control-integration`의 `scripts/run-control-tower.mjs`를 직접 열어
  `WORK_REVISION_REQUIRED`(38행), `WORK_OBSERVED_AFTER_AS_OF`(28,48행) 검사가 실제로 존재함을 확인했다.
  `group/g0-result` 쪽 파일은 이번 세션에서 diff를 재실행하지 않았다 — GPT가 인용한 코드를 그대로 신뢰하되, 직접 비교는 다음 작업으로 남긴다.

- **F03 (PR #22 CI가 green이 아님, merge-tree 실패 1건) — 반박하지 않음, 미확인(NOT_RUN 상태 그대로 인정).**
  이 세션은 PR #22의 GitHub Actions run을 재조회하지 않았다. GPT가 인용한 run/job 링크와 실패 테스트명을 근거 없이 뒤집지 않는다.

- **F04 (registry 검증 기준과 실행 준비 상태 혼동) — 이 브랜치에 해당 파일 없음, 해당 없음(N/A).**
  `registry/projects.json`, `scripts/validate-project-registry.mjs`는 이 브랜치에 없다.

- **F05 (observed_at와 HANDOFF 상태 불일치) — 이 문서 자체로 부분 대응.**
  이 브랜치에는 최상위 `docs/HANDOFF.md`가 이번 커밋 전까지 없었다(신규 작성). "문서 편집 blocker 없음"과 "운영 준비 blocker 있음"을 아래에서 구분해 적는다.

- **F06 (aiops 로컬/원격 이력 차이) — 이 브랜치와 무관, 해당 없음(N/A).**
  이 브랜치는 `ai-core` 저장소만 다룬다. `aiops`는 별도 저장소(`C:\dev\aiops`)이며 이번 작업 범위 밖이다.

## Blocker

- **문서 편집 blocker: 없음.** 이 커밋과 문서 갱신은 로컬 파일 작업만이다.
- **운영 준비 blocker: 있음(아래 정정 참조).**
- 실제 원격 서버 지정, SSH 왕복, GitHub Actions 수동 실행 비밀 설정은 여전히 미검증(`docs/reviews/SHARED_ORDER_REVIEW.md`에 기존에 기록된 그대로, 이번에 추가 검증하지 않음).

## 정정 — 연결 게이트 4개 함수 재확인 (2026-09-16, PR #22 `215a8ee` 기준)

위 "다음 한 작업"으로 적었던 대로 `src/integration/order-work-adapter.mjs`를 PR #22 최신 head(`215a8ee74523667c5bf099ed068e9aaa572a53b5`, `ai-core-fd` 세션이 conflict 해소 후 push한 버전)에서 전문을 직접 읽었다.
**이전에 적은 "설계만 있고 어느 브랜치에도 구현되지 않았다"는 부정확했다 — 조용히 고치지 않고 이 절로 정정한다.**

- `linkOrder`, `readWorkProjection`, `refreshControlResult`(= `readWorkProjection`), `prepareWorkCommand`/`submitWorkCommand`(= `prepareWorkCommand`) 네 이름 모두 파일 하단 `Object.freeze({...})`에 실제로 export돼 있다. 매핑 검증·중복 ID 검사·ledger/registry/control-tower 일치 검사까지 구현돼 있고, `prepareWorkCommand`는 `PREPARED_NOT_SENT`/`sent:false`/`execution_authorized:false`를 명시적으로 반환한다.
- 다만 이 네 함수는 **읽기·준비까지만** 한다. 실제로 PR #20의 `appendLedgerEvent`를 호출해 ledger에 쓰는 코드는 `order-work-adapter.mjs` 안에는 없다. `appendLedgerEvent` 호출은 `src/integration/order-intake-sandbox.mjs`, `src/integration/durable-order-work-sandbox.mjs`에만 있는데, 이 두 파일은 자체 주석대로 "disposable integration laboratory, never a production connector" — 임시 SQLite/임시 ledger 파일을 스스로 만들어 쓰는 격리 실험 코드다. `docs/integration/INTEGRATION_STATUS.md`도 "Status: synthetic integration implemented... Production activation... remain HOLD"라고 명시한다.
- **정확한 현재 상태:** 연결 게이트 4개 함수는 **격리 환경에서 구현 완료**(코드 존재, 단위 검사 있음). **운영 원장에 실제로 쓰는 제출 경로는 미구현·미연결**(sandbox 밖에서 이 adapter의 `prepareWorkCommand` 출력을 받아 `appendLedgerEvent`를 호출하는 코드가 없음). 이건 F01이 그룹 HANDOFF의 "미착수" 표기를 지적한 것과 같은 종류의 구분 — "미구현"을 뭉뚱그리지 말라는 GPT 권고를 이 블로커 문구에도 그대로 적용한 것이다.

## Blocker (정정 반영)

- **운영 준비 blocker: 프로토타입으로 좁혀짐 (아래 참조).** 어댑터의 읽기/준비 4함수는 구현됨. 제출 gap(prepareWorkCommand → appendLedgerEvent)은 이제 격리 worktree에 프로토타입이 있다 — 다만 PR22 브랜치에 아직 병합되지 않았고 독립 고위험 검토도 안 끝났다.

## 병렬 worktree 3건 프로토타입 완료 (2026-09-16, 이 세션이 백그라운드 Agent 3개로 실행)

모두 `origin/codex/order-control-integration`(PR #22) head `215a8ee` 기준. 전부 로컬에만 있고 push/PR 안 함, PR22 기존 파일은 손대지 않고 새 파일만 추가. `npm test` 전체 재실행 결과는 셋 다 "새로 추가한 파일 무관, 기존에도 나던 episode `changed_files` 불일치 1건" 외 전부 pass — 이 1건은 `ai-core-fd`가 별도로 정정 중인 그 건과 동일.

| worktree | branch | 추가 파일 | 자체 테스트 |
|---|---|---|---|
| `.claude/worktrees/agent-ad06b95678028fc9b` | `demo/order-to-projection` | `scripts/demo-order-to-projection.mjs`, `docs/integration/ORDER_TO_PROJECTION_DEMO.md` | 실행 결과 `status=LINKED`, 실제 함수로 자연어 주문→projection 왕복 실증. npm test 300/299 pass 1 fail(기존 건) |
| `.claude/worktrees/agent-ad91bffe5bdedaa2a` | `worktree-agent-ad91bffe5bdedaa2a` | `test/order-work-integration-scenarios.test.mjs` | ORDER_CONTROL_INTEGRATION.md 4단계 8개 시나리오 중 기존 미커버 5개(만료권한/권한부재/응답유실/부분쓰기/두클라이언트 경합) 실제 함수로 신규 검증. npm test 307/306 pass 1 fail(기존 건) |
| `.claude/worktrees/agent-a0050210a1ace8d23` | `work/order-work-submitter` | `src/integration/order-work-submitter.mjs`, `test/order-work-submitter.test.mjs` | `durable-order-work-sandbox.mjs` outbox 패턴 재사용한 제출 커넥터. 프로세스 kill 크래시 복구 3종 포함 자체 9/9 pass. npm test 309/308 pass 1 fail(기존 건). 명시적으로 여전히 HOLD(비운영) |

## 다음 한 작업

`ai-core-fd`가 PR22에서 GPT ③안(rebase 없이 episode `changed_files`만 정정 커밋)을 착지시키는 걸 기다린다. 착지하면 위 3개 worktree를 그 새 head로 rebase해서 PR22 담당에게 넘긴다 — 지금 올리면 같은 changed_files 불일치를 또 만든다. 그 전까지 이 3개는 건드리지 않는다(중복 작업 방지).

## 마지막 실제 검증

`npm test` — 이 세션, local HEAD `e8e6662`, 2026-09-16, tests 124 / pass 124 / fail 0 / skip 0.
위 3개 worktree 각각의 `npm test`는 위 표 참조 (전부 해당 worktree 안에서 실행, 이 브랜치 HEAD 검사는 아님).
`order-work-adapter.mjs` 전문 읽기 — 이 세션, PR #22 origin head `215a8ee`, 2026-09-16. 코드 대조이며 이 세션에서 PR #22의 `npm test`를 재실행하지는 않았다(NOT_RUN).
