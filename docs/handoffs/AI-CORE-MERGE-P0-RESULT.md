# AI-CORE-MERGE-P0 — 물리 통합 현황과 첫 실행안

- base revision: `freepass-creator/ai-core@3145be6` (origin/main, 2026-09-16 확인)
- 선행 산출물: `docs/handoffs/GROUP-G0-RESULT.md`(같은 브랜치, 이 작업의 STEP 0 상당 부분을 이미 수행함 — 여기서는 새로 세지 않고 이어받는다)
- branch: `group/g0-result` (계속 사용, main 직접 작업 안 함)

## STEP 0 — Council Inventory (요약, 상세는 GROUP-G0-RESULT.md)

raw inventory 정본: `docs/inventory/C-DEV-2026-09-15.json`(33 저장소, 69 체크아웃). 새로 다시 세지 않음.

## P0 결과표 (가장 명확한 항목 우선 — 33개 전부가 아니라 즉시 실행 가능한 것부터)

| asset | current_path(대표) | repo | role | data_ssot | deploy | dirty_state | classification | reviewer_consensus | first_action | risk |
|---|---|---|---|---|---|---|---|---|---|---|
| freepasserp4 워크트리 군 | `C:\dev\freepasserp4-*`, `.wt-*`, `_wt-*`, `fp-*`, `worktrees\*` (30개 체크아웃, 1개 repo) | freepass-creator/freepasserp4 | ERP4 자회사 | Firebase ERP5(원천 대조 필요) | Vercel+Firebase | 대부분 CLEAN, 일부 dirty | `COLOCATE_ONLY` — 워크트리 자체는 합칠 게 아니라 `C:/dev/_worktrees/<repo>/<작업번호>` 아래로 위치만 재정렬(저장소지도.md에 이미 코덱스안으로 확정돼 있음) | 미실행(단일 AI, aiops/docs/저장소지도.md의 사람 합의만 있음) | 워크트리 30개를 지금 강제 이동하지 않는다 — 본체(`freepasserp4`)와 현재 작업 중 1개만 C 유지, 나머지 배치 재정리는 별도 작업 | 高 — freepasserp4는 실운영 배포 중, 잘못 옮기면 배포 경로 깨짐 |
| ai-core 3중 체크아웃 | `C:\dev\ai-core`, `ai-core-audit`, `ai-core-control-tower` | freepass-creator/ai-core | 본사 자체 | 없음(문서/코드 저장소) | 없음 | ai-core: 커밋 대기중(사용자 작업), audit: dirty, control-tower: clean | `KEEP_SEPARATE`(당분간) — 세 개가 각각 다른 브랜치의 병렬 작업 중이라 지금 합치면 진행 중인 작업을 잃음 | 미실행 | 각 체크아웃이 어느 브랜치·목적인지 `docs/handoffs/`에 명시만 하고 병합은 각 작업 완료 후 | 中 — 사용자가 지금 `ai-core`에서 직접 커밋 작업 중, 손대지 않음 |
| freepass-sales 브랜치 분기 | `C:\dev\sales`(main), `sales-mail-automation`(codex/mail-intake-automation) | freepass-creator/freepass-sales | 영업 자회사 | 자체 | 미상 | sales: dirty 1(스크래치 스크립트), automation: clean | **정정(P0 초안 오류)** — 단순 중복 체크아웃이 아니라 `codex/mail-intake-automation` 브랜치에 main 대비 **21개 미병합 커밋**(SMS 프로모션·판매 UI 개편, 19파일) 존재. `KEEP_SEPARATE`가 아니라 **미병합 실작업 — 병합 검토 필요** | 미실행 | 두 체크아웃을 합치기 전에 21개 커밋 리뷰·main 병합 여부부터 결정 — **머지 안 함, 사용자 확인 대기** | 中 — 실제 판매 화면(app.js/index.html/rent.html) UI 변경 포함, 검토 없이 병합하면 회귀 위험 |
| teamjpkwork 중복 | `C:\dev\teamjpkwork`, `worknavi` | freepass-creator/teamjpkwork | 워크 UI 자회사(★UI/UX 정본, 저장소지도.md 확정) | 없음(화면) | Vercel | teamjpkwork 5 dirty, worknavi 1 dirty | `RETIRE` 후보(worknavi 쪽) — 저장소지도.md가 이미 "worknavi·worknavi-security = 옛 폴더, [보관], 손대지 않는다"로 확정함 | 기존 사람 합의(대표+3AI, 2026-08-30) — 새로 Council 안 돌림 | worknavi는 그대로 보관, 신규 작업 원천으로 안 씀(이미 확정된 결정 재확인만) | 低 |
| 본사 조정 체계 3원화 | `aiops`(협업판+승인등급), `ai-core`work/codex/control-tower(work ledger), `ai-core`work/codex/order-control-v1(오더 UI) | 3개 서로 다른 브랜치/저장소 | 조정 인프라 | 각자 다름 | 없음 | 각자 dirty | `EXTRACT_SHARED`(work ledger를 본사 표준으로) | **CONSENSUS** — Cursor Agent(`--mode ask`)와 Gemini CLI(`--skip-trust`) 독립 질의, 둘 다 Control Tower를 본사 표준으로, order-control-v1은 그 위 intake 어댑터로, aiops는 실행 레이어 유지로 일치(`docs/handoffs/GROUP-G0-RESULT.md` 하단 기록) | Control Tower 기준으로 G1(본사 최소 골격) 진행, order-control-v1 어댑터화는 별도 작업으로 분리 | 中 — aiops의 실사용 승인체계를 건드리면 실제 운영(과태료 등) 중단 위험, 그래서 건드리지 않고 유지 |
| devcenter registry.json 이중화 | `C:\dev\devcenter\registry.json` | freepass-creator/devcenter | 본사 DevCenter | 없음 | 없음 | 이번 세션에 1개 entry 추가함(clean 유지) | `COLOCATE_ONLY` — 이미 dataset-scope 등록부로 존재, 새 스키마로 갈아엎지 않고 이번 세션 registry.json에 AI-CORE-GROUP 포인터 1줄만 추가함(완료) | 미실행(단일 AI 판단, 저위험 추가라 Council 안 거침) | 완료됨 — 되돌릴 필요 없음 | 低 |

## 확인하지 못한 것

- 나머지 23개 저장소(jpkerp 계열, freepasserp2/3, welrix*, billincar 등)는 이번 P0에서 표로 못 만들었다 — `aiops/docs/저장소지도.md`의 기존 사람 판정(보관/미확정)을 그대로 상속하고 재조사하지 않았다.
- 원격에는 없고 로컬에만 있는 작업: `aiops`가 원격보다 189커밋 앞서 있음(2026-09-15 기준, 대형 파일 이력 문제로 push 자체가 막힘) — 이번 P0 범위 밖, 별도 이력 수술 필요.
- 중복 코드/문서 후보: `docs/aiknowhow`(aiops) vs `docs/aiknowhow`류 문서가 다른 저장소에도 있는지는 확인 안 함.
- 공통 기능 후보: `aiops/lib/{goog,drive,sheet,lease,task-board}.mjs`가 shared-service 후보라는 건 이전 세션 Agent 분석으로 나왔으나 EXTRACT_SHARED 실행은 안 함.
- 실제 retire가 아직 안 된 대상: `jpkerp5`(RETIRE 확정이나 저장소 자체는 그대로 존재), `worknavi`/`worknavi-security`(보관 확정이나 삭제 안 됨).
- 운영 경로 변경 시 필요한 승인: freepasserp4 워크트리 재배치, aiops 이력 수술, ai-core 3중 체크아웃 정리 — 전부 사용자 승인 필요 항목으로 남김.

## 우선 통합 대상 1~3개 (제안, 실제 대조 후 정정됨)

1. **본사 조정 체계 결정 집행** — Control Tower를 G1 기반으로 실제 확정(이미 CONSENSUS 나옴, 실행만 남음). 이제 위험이 가장 낮고 준비된 항목이라 1순위로 올림.
2. **freepass-sales `codex/mail-intake-automation` 21개 커밋 검토** — 단순 중복이 아니라 실제 판매 SMS/UI 기능 작업. 병합 여부는 화면 회귀 검토 후 결정. 자동 병합하지 않음.
3. **freepasserp4 워크트리 재배치**는 위험이 높아 3순위로 미룬다 — 실운영 배포 경로와 직결.

## 기존 데이터/배포를 건드리지 않는 첫 실행안

당초 "freepass-sales는 단순 중복이라 안전하게 합칠 수 있다"는 초안은 실제 대조 결과 **틀렸다** — `git log main..codex/mail-intake-automation`으로 확인한 결과 21개 미병합 커밋(SMS 프로모션·판매 UI 개편, `app.js`/`index.html`/`rent.html` 등 19파일)이 있었다. 자동 병합·삭제 없이 정정만 하고 실행은 보류했다.

## 다음 한 작업

사용자 확인 필요: (1) Control Tower 기반 G1 착수 승인, (2) freepass-sales의 21개 미병합 커밋을 지금 리뷰할지 나중으로 미룰지.
