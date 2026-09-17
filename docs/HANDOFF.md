# HANDOFF — ai-core (Control Tower 체크아웃)

> ★2026-09-17 salvage 주석 — **아래 본문은 `group/g0-result` 갈래에서 2026-09-16 에 쓰인
> 기록이다. 지우지 않고 그대로 옮겼으나, 그 뒤로 사실이 바뀐 곳이 있다.**
> 본문을 «현재 작업지시»로 읽지 마라.
>
> | 본문이 말하는 것 | 2026-09-17 현재 |
> |---|---|
> | 「이 브랜치(`group/g0-result`) 최신」 | **아니다.** 런타임 정본은 `main` 이고 group 갈래는 `b438fca` 에서 갈라진 옛 가지다 |
> | 「`order-control-v1` 을 intake 어댑터로 — 설계만 있고 미착수」 | **끝났다.** PR #22·#37·#38·#41 로 main 에 들어왔고, #44 로 서버 `readWorkProjection` 배선까지 붙었다 |
> | 「group 갈래를 main 으로 병합할지 결정 안 됨」 | 정리 중이다. 런타임은 main 으로 수렴하고 이 갈래는 **고유 문서만 건진다**(이 커밋) |
> | 「다음 한 작업: 어댑터화 설계 시작」 | 지금의 다음 한 작업은 **운영 registry·snapshot·mappings·ledger 원천을 `orders.connection.json` 의 `workSources` 로 가리키는 것**이다 |
>
> 본문의 registry 2건 INVALID 기록(aiops build 없음 · freepasserp4 test 없음)은
> **여전히 사실이다.** 그래서 `registry/projects.json` 은 이번 salvage 에 넣지 않았다 —
> 판단이 필요해 따로 올린다.

CLI 연결 여부와 무관하게 이 저장소를 여는 누구나 여기부터 읽으면 이어받을 수 있다. 자세한 이력은 `docs/handoffs/GROUP-G0-RESULT.md` → `GROUP-G1-RESULT.md` → `AI-CORE-MERGE-P0-RESULT.md` 순서로.

## 현재 revision

이 브랜치(`group/g0-result`) 최신 — `git log -1`로 확인. origin에 push됨.

## 현재 작업

AI-CORE-MERGE-P0: 본사 조정체계를 Control Tower(work ledger)로 확정(Cursor+Gemini 교차 합의), 실제 프로젝트 5개를 `registry/projects.json`에 등록, 각 프로젝트에 `docs/HANDOFF.md` 배포 중.

## 완료된 것

- Multi-AI Council 방식으로 "본사 표준 조정체계" 결정(Control Tower 채택, CONSENSUS)
- `registry/projects.json`에 ai-core/aiops/devcenter/freepass-sales/freepasserp4 등록, 검증기(`scripts/validate-project-registry.mjs`)로 확인 — aiops(build 없음)·freepasserp4(test 없음) 2건 INVALID를 숨기지 않고 기록
- freepass-sales의 "단순 중복"이라던 초기 판단이 틀렸음을 실제 diff/test로 확인·정정(21개 미병합 커밋 + 실패 테스트 발견)
- aiops/devcenter/freepass-sales/freepasserp4에 `docs/HANDOFF.md` 배포(진행 중, 이 커밋 기준 4/5 완료)

## 미완료

- `order-control-v1`(SQLite 오더 UI, 별도 체크아웃 `C:\dev\ai-core`)을 Control Tower의 intake 어댑터로 만드는 작업 — 설계만 있고 미착수
- `group/g0-result` 브랜치를 main으로 병합할지, PR로 남길지 결정 안 됨
- 나머지 28개 저장소는 registry에 등록 안 됨(실제 조사 전까지 미룸)

## Blocker

없음(현재 단계는 문서/registry 추가뿐, 운영 변경 없음).

## 다음 한 작업

`order-control-v1` 어댑터화 설계 시작 — 또는 사용자가 이 브랜치를 main에 병합할지 먼저 결정.

## 마지막 실제 검증

`node scripts/validate-project-registry.mjs registry/projects.json` — 2026-09-16, 의도된 2건 INVALID 외 정상.
