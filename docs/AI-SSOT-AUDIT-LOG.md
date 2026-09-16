# AI-SSOT-AUDIT-LOG — Claude 구현 / GPT 독립 감사 채널

- 만든 배경: 2026-09-16, 대표+Claude+GPT 합의. Codex CLI 크레딧 소진(2026-09-20 18:56까지)으로 실시간 호출이 안 되는 동안, GPT가 GitHub에 남기는 비동기 감사 의견을 Claude가 구현 판단에 반영하는 채널.
- **역할 분리가 이 문서의 핵심이다.** Claude = 구현 전담(코드를 실제로 고친다). GPT = 독립 감사/검토 전담(코드를 직접 고치지 않는다). Claude가 자기 작업을 자기 논리로만 검증하는 문제를 줄이기 위한 장치이므로, 이 경계를 섞지 않는다.
- **의미 있는 이슈가 있을 때만 적는다.** 변화가 없으면 기록도 알림도 없다 — 매번 "이상 없음"을 적어서 이 로그를 소음으로 만들지 않는다.
- 새로운 중복 원장을 만들지 않는다. aiops의 `docs/INBOX.md`는 aiops 내부(업무 도메인) 전용이고, 이 문서는 **여러 저장소에 걸친 SSOT(정본) 경계 문제**만 다룬다. 범위가 aiops 하나에 그치면 INBOX.md에 남긴다.
- Codex CLI 크레딧이 풀리면(2026-09-20 이후) 이 채널 구조는 그대로 두고 `ask-gpt.sh`류 동기 호출을 추가로 붙인다. 구조를 다시 뜯지 않는다.

## 항목 형식

```
### YYYY-MM-DD — <한 줄 제목>
- 작성: GPT 또는 Claude
- 대상: <저장소·경로·commit SHA>
- 근거: <실제로 읽은 파일/코드/문서, 추측 금지>
- 영향: <실제로 무엇이 깨지거나 위험한가>
- 판단: BLOCK / REVISE / OK / HOLD(추가 확인 필요)
- Claude 반영: <구현했음/보류함/근거 부족으로 기각함 — 여기도 Claude가 채운다>
```

## 로그

### 2026-09-16 — order-work-adapter.mjs의 submit 단계가 운영 코드에 연결 안 됨
- 작성: Claude (ai-core-88 세션의 발견을 전달)
- 대상: `freepass-creator/ai-core`, `src/integration/order-work-adapter.mjs`(commit `215a8ee`)
- 근거: ai-core-88 세션이 어댑터 전문을 읽고 확인. `linkOrder`/`readWorkProjection`/`prepareWorkCommand`/`submitWorkCommand`는 실제 구현·검증 로직 탄탄하게 존재. 하지만 `prepareWorkCommand`가 반환하는 `PREPARED_NOT_SENT` 결과를 실제로 PR20의 `appendLedgerEvent`(work ledger에 커밋)로 넘기는 운영 코드가 어디에도 없다 — `appendLedgerEvent` 호출은 `order-intake-sandbox.mjs`/`durable-order-work-sandbox.mjs`에만 있고, 이 두 파일은 자체 주석상 "never a production connector"로 명시돼 있다.
- 영향: 오더 접수 UI(order-control-v1)가 Control Tower work ledger에 실제로 쓰기를 하는 마지막 한 단계(제출)가 비어 있다. 즉 지금 구조로는 오더를 승인해도 원장에 실제로 기록되지 않는다.
- 판단: HOLD — 구현 gap 확인, 위험도는 아님(현재 아무것도 자동 실행되지 않으므로 안전 방향의 미완성)
- Claude 반영: 이 gap을 누가 메울지(order-control-v1 쪽 PR #21, 아니면 별도 조정자) 아직 문서에 정해져 있지 않음. G1/G2 단계에서 Control Tower를 본사 표준으로 확정한 것과 직결되는 다음 작업이라 `docs/handoffs/GROUP-G1-RESULT.md`의 "다음 한 작업"에 추가할 것 — 사용자 결정 필요.

### 2026-09-16 — 담당 세션이 없는 C:\dev 저장소 10개 + fp4 워크트리 3개, 쓴다/안 쓴다 판정 필요
- 작성: Claude
- 대상: 로컬 `C:\dev`, `aiops/docs/저장소지도.md`(2026-08-30 대표 확정판 기준)
- 근거: 이번 세션에서 활성 세션 12개의 실제 작업 범위를 전부 대조했다(`docs/handoffs/SESSION-MISSIONS.md`). 그중 어느 세션도 다음을 건드리지 않았다: `sonogong-estimator`, `gukminchagimpo`, `freepasspartner`, `freepasshomepage`, `teamjpk`, `vehicle-master`, `switchdebt`, `encar-sise`, `sheetops`, `ci_center`, 그리고 freepasserp4 워크트리 `_wt-flt`·`_wt-pipe`·`_wt-rgn`. 저장소지도.md는 2026-08-30부터 이 목록을 "쓰는 것만 골라 주시면 나머지는 보관으로 내린다"고 대표 확인 대기 상태로 남겨뒀다.
- 영향: 판정이 없으면 계속 "아직 못 정한 것"으로 남아 다음 세션이 또 같은 질문을 반복한다. D드라이브 백업/보관 규칙(저장소지도.md ★★백업 절)도 이 판정이 있어야 적용할 수 있다.
- 판단: HOLD — Claude/Codex 단독으로 "이 저장소를 계속 쓸지"는 판단할 수 없다(업무 의미를 모름). GPT나 대표의 판단이 필요.
- Claude 반영: 대기 중. 답이 오면 "쓴다"로 확정된 것은 담당 세션을 배정하고 SESSION-MISSIONS.md에 등록, "안 쓴다"로 확정된 것은 저장소지도.md의 "안 쓴다" 표로 옮기고 D 스냅샷 절차(저장소지도.md 규칙 ⑧, 지우기 전 D 스냅샷 1회)를 다음 작업으로 건다.
