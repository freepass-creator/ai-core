# HANDOFF — ai-core

이 문서는 새 세션이 **현재 AI Core 상태와 다음 검증 지점만** 빠르게 이어받도록 하는 짧은 인계 정본이다. 긴 과거 기록은 git/PR/evidence 문서에 남긴다.

## 현재 원격 기준

- GitHub `main`: `b2725556f0a6c41cfb0404d3c3bf8e2323b05b2a`
- 2026-09-23 KST 재확인.
- 과거 `group/g0-result`, 2026-09-16~17 salvage 기록은 현재 작업지시가 아니다.

## 시작

1. `WORK_READ_FIRST.md`와 `docs/AI_WORKING_STANDARD.md`를 읽는다.
2. 대상 프로젝트가 있으면 `npm run academy:start -- --task "<사용자 결과>" --root <target> --track <track>`으로 실제 revision과 검증 명령을 고정한다.
3. 오래된 HANDOFF/계획/메일보다 현재 main, registry, 실제 project revision과 실행 증거를 우선한다.
4. 새 자산은 reuse-first 원칙을 적용하고, live write/deploy/send/permission은 대상 프로젝트의 승인 경계를 유지한다.

## 현재 실제로 들어온 공통 기반

- Routed Order → Work E2E의 durable intake/binding/snapshot 경로가 main에 들어왔다. 동일 order/revision의 동시·중복 intake는 하나의 durable Work 경로로 수렴하도록 검증돼 있다.
- Project Registry는 repository lifecycle과 execution readiness를 분리하고 revision-bound source observation을 유지한다.
- Capability/Work Map/engine 경계가 실제 runtime에 연결돼 있으며, HOLD capability를 실행 가능으로 가장하지 않는 방향으로 강화 중이다.
- AIOps에서 공통화 가능한 조각은 SHADOW로 역수입 중이다.
  - atomic stream write
  - Google API URL/read 경계
  - Sheets 순수 utility
- 위 SHADOW는 AIOps runtime/credential/lease/회사별 resource authority를 대체하지 않으며 consumer cutover도 아직 허가되지 않았다.
- DocsHub → management-support 전환은 partial cutover를 막는 gate까지 있고 실제 template/runtime cutover는 아직 아니다.

## 현재 중요한 OPEN 경계

### Result Delivery #183 — 최우선 공통 기반 부채

- durable RESULT replay와 crash-window RESERVED recovery를 기존 reservation/receipt 구조로 해결하려는 PR이다.
- 실제 PR head는 `5d8f5417bf7fbc248c65f19d966f98fe02bcd6dd`인데 PR 본문/HANDOFF 일부는 과거 `e67537c...`를 current head로 적고 있어 evidence binding이 stale하다.
- 현재 main 기준 exact-head/merge-ref focused recovery + full repository CI 증거가 아직 없다.
- 이 PR이 VERIFIED 되기 전에는 “safe recovery / duplicate prevention 완성”으로 보고하지 않는다.
- AIOps 쪽 terminal receipt에 정확한 AI Core `requestId`를 묶는 PR #9도 아직 OPEN이다.

### 작은 독립 guard

- #237: READ_ONLY/LOCAL_MUTATION capability가 unexpected external effect를 보고하면 Work Result를 SUCCEEDED로 두지 않고 HOLD시키는 fail-closed guard.
- #240: `CLAUDE.md` 변경이 repository test를 깨뜨려도 CI가 시작되지 않던 path-filter false-green 수정.
- #246: Google read shadow adapter의 선언된 7회 retry budget과 runtime `maxRetries` 입력 불일치 수정.
- 위 PR들은 각각 기존 경계를 보강하는 작은 변경이며 새 framework를 만들 이유가 없다.

## 메일 / 연구 후보 취급

AIOps 최신 DEVKIT 메일의 v6.29 POSIX Spawn Integrity Boundary는 **LOCALLY_TESTED / self-authored synthetic research candidate**다.

AI Core로 가져올 수 있는 것은 구현 자체가 아니라 다음 원칙 후보뿐이다.

- fresh-worker isolation
- request/response identity exact binding
- no-result-cache for authoritative replay
- input/package freshness revalidation
- poisoned/ambiguous execution의 fail-closed recovery

Python/POSIX spawn 구현을 공통 Core runtime으로 자동 채택하지 않는다. production-scale concurrency, crash-loop, cross-platform, 실제 업무 outcome이 검증되기 전에는 연구 근거다.

## 현재 성숙도 해석

- 문서만 있는 구조와 실제 common runtime에 wired된 구조를 섞지 않는다.
- SHADOW parity는 consumer cutover가 아니다.
- CI green은 실제 runner가 관련 behavior/contract test를 실행했을 때만 보장으로 센다.
- Work 생성, execution request, receipt, 외부 업무 결과는 서로 다른 상태다.
- 여러 프로젝트의 실제 재사용과 큰 회귀 없는 유지가 확인되기 전에는 STABLE로 올리지 않는다.

## 다음 한 작업

**Result Delivery #183을 current main 기준의 단일 exact head로 정합하고, 동일 requestId RESULT replay / RESERVED crash recovery / project+revision binding drift / concurrent duplicate execution=0을 focused test와 exact merge-ref CI로 증명한다.**

새 ledger·새 workflow·새 recovery framework를 만들지 말고 기존 durable reservation/result/receipt 자산을 재사용한다.
