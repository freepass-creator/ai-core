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
| freepass-sales 중복 | `C:\dev\sales`, `sales-mail-automation` | freepass-creator/freepass-sales | 영업 자회사 | 자체 | 미상 | 둘 다 clean | `MERGE_PHYSICAL` 후보 — 같은 repo, 같은 브랜치(main), 둘 다 clean이면 안전하게 중복 제거 가능 | 미실행 | 두 경로의 `git log -1`, `git diff` 동일한지 확인 후 하나로 정리 — **이번 세션에서 아직 실행 안 함** | 低 — 둘 다 clean, 원격 손실 위험 없음 |
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

## 우선 통합 대상 1~3개 (제안)

1. **freepass-sales 중복 제거**(위험 低) — 가장 안전하고 빠른 실물 증거. `sales`/`sales-mail-automation` 동일 여부 확인 후 하나로.
2. **본사 조정 체계 결정 집행** — Control Tower를 G1 기반으로 실제 확정(이미 CONSENSUS 나옴, 실행만 남음).
3. **freepasserp4 워크트리 재배치**는 위험이 높아 3순위로 미룬다 — 실운영 배포 경로와 직결.

## 기존 데이터/배포를 건드리지 않는 첫 실행안

freepass-sales 중복 제거부터: (a) 두 경로의 `git log -1 --format=%H`와 `git status --porcelain`을 대조해 완전히 같은 상태인지 확인, (b) 다르면 각 diff를 사람이 확인, (c) 같으면 `sales-mail-automation`은 별도 목적(메일 자동화)일 수 있으니 **디렉토리명이 다르다는 이유만으로 자동 삭제하지 않고** 실제 용도부터 사용자에게 확인. 이 단계는 아직 미실행.

## 다음 한 작업

사용자 확인 필요: 위 "우선 통합 대상" 순서 승인. 승인되면 freepass-sales 두 체크아웃의 실제 diff부터 대조 실행.
