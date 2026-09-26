# Canonical Development Lines — 2026-09-26

Status: **CANONICAL CONSOLIDATION MAP**

AI Core는 같은 관심사에 두 개 이상의 정본을 두지 않는다. 브랜치·실험·과거 문서는 근거와 역사를 보존할 수 있지만 현재 구현의 권위가 되지 않는다.

## 현재 정본

| concern | canonical line | 비고 |
|---|---|---|
| UI/UX | `docs/UI_UX_START_HERE.md` → `design-system/` + `registry/ui-ux-*` | `design/claude-v1/`은 역사자료 |
| Development Continuity | `docs/DEVELOPMENT_CONTINUITY_STANDARD.md` + `registry/development-continuity-policy.json` | repo-wide branch budget/lifetime audit; PR overlap is Canon Guard |
| Core Contract | `docs/CORE_CONTRACT_STANDARD.md` + `contracts/core-*` + `src/contracts/` | provider Adapter 표준 포함 |
| Capability Runtime | `src/engine/capability-engine.mjs` | runtime adapter envelope는 Core Adapter 표준을 대체하지 않음 |
| Workflow | `docs/workflow/WORKFLOW_CONSTITUTION.md` + `src/workflow/` + `registry/workflow-*` | 과거 D1~D8 브랜치는 정본 아님 |
| Integration Connector | `devcenter/hubs/integration/` + `devcenter/contracts/integration-connector.schema.json` | 과거 root connector-registry 계보는 정본 아님 |
| AIOps import | `aiops/README.md`가 import 경계를 설명 | 내부 legacy 문서의 과거 "정본" 선언은 AI Core 전체에 효력 없음 |

기계용 정본은 `registry/canonical-development-lines.json`이다.

## 기계 봉쇄 — 정본 지킴이 (2026-09-26)

대표: 「AI 코어에서 절대 정본이 두 개나 이렇게 갈리지 않게끔 메인 브랜치만 활용하게끔 뭔가가 있어야」.
등록부에 적는 것만으로는 막히지 않았다(2026-09-25 전 저장소 점검 — 과태료 정본 네 벌, 토큰 세 벌, AI 지시문 여덟 벌, main 밖 커밋에서 도는 운영 발행기). 그래서 등록부를 **CI 가 읽고 막는다.**

| 검사 | 막는 것 |
|---|---|
| `DEFINITION_OUTSIDE_CANON` | 줄(line)의 `guards` 패턴(예: CSS 토큰 정의)이 정본 뿌리 밖에서 새로 나타남 |
| `HISTORICAL_MARKER_MISSING` | `historical_or_noncanonical` 에 적힌 파일이 스스로 정본이라 말하면서 `NOT_CANONICAL` 표시가 없음 |
| `ENTRY_FILE_DIVERGED` | `CLAUDE.md`·`GEMINI.md` 가 `AGENTS.md` 와 같지도, 그것을 가리키는 한 줄도 아님 |
| `WORKFLOW_REF_PINNED` | 워크플로가 `main` 이 아닌 커밋·가지를 checkout 해 돎 |
| `BRANCH_TOO_FAR_BEHIND_MAIN` | PR 가지가 main 보다 `max_behind_main` 커밋 넘게 뒤처짐 — main 을 먼저 받는다 |
| `CANONICAL_PATH_CONTESTED` | 다른 «준비 완료» PR 이 같은 정본 뿌리를 고치고 있음 — 하나를 끝내거나 닫는다(초안끼리는 notice) |
| `BASELINE_EXPIRED` / `BASELINE_STALE` | 이미 있던 위반은 기한 붙은 `baseline` 에만 둔다. 기한이 지나거나 이미 고쳐졌으면 빨갛다 — 목록은 줄어드는 쪽으로만 간다 |

- 실행: `npm run canon:guard`(자가진단 + 이 저장소) · `npm run canon:branch`(PR 규율). 판정은 `src/governance/canonical-guard.mjs` 한 곳.
- 워크플로 `.github/workflows/canon-guard.yml` 은 모든 PR 에서 돈다(문서만 바꾼 PR 포함 — 정본 주장은 문서에서 생긴다).
- **다른 저장소**도 같은 형식의 `registry/canonical-development-lines.json` 을 두고, 이 워크플로를 `uses: freepass-creator/ai-core/.github/workflows/canon-guard.yml@<커밋>` 으로 부른다(버전 고정).
- 검사를 고쳐 통과시키지 않는다. 규칙을 바꾸려면 등록부를 고치고, 그 PR 자체가 이 검사를 통과해야 한다.

## Repository-wide 개발연속성 감사

Canon Guard의 `canon:branch`는 **현재 PR 하나가 main에서 너무 멀거나 같은 canonical path를 다른 ready PR과 동시에 고치는지** 막는다. 별도의 `continuity:audit`는 저장소 전체를 보며 다음을 감사한다.

- active work branch budget
- 24/48/72시간 branch lifetime
- stale unique-ahead branch
- merged-equivalent cleanup debt
- AI actor-prefixed branch
- 전체 branch debt와 수렴 추세

두 검사는 경쟁 정본이 아니라 서로 다른 층이다. PR gate는 국소 충돌을 막고, repository audit는 개발선이 전체적으로 흩어지는 것을 찾는다.

## 브랜치 정리 원칙

브랜치를 이름만 보고 삭제하지 않는다. 각 브랜치는 다음 중 하나로 분류한다.

- `MERGED_EQUIVALENT`: main과 핵심 구현이 동일하거나 이미 흡수됨.
- `SUPERSEDED`: main이 더 발전한 후속 구현이며 다시 merge하면 회귀 위험이 있음.
- `HISTORICAL`: 실험/연구 계보로 보존 가치만 있음.
- `UNIQUE_REVIEW`: main에 없는 의미 있는 구현이 남아 있어 회수 검토가 필요함.
- `ACTIVE`: 현재 열린 작업이며 정본과의 충돌 여부를 먼저 해결함.

삭제는 `MERGED_EQUIVALENT` 또는 검토 완료된 `SUPERSEDED/HISTORICAL`만 대상으로 한다.

검토가 끝난 `SUPERSEDED/HISTORICAL` 브랜치는 `registry/branch-retirements.json`에 **브랜치명 + 기대 head SHA**를 함께 고정한다. 실제 원격 head가 그 SHA와 정확히 일치할 때만 자동 retire하며, 이후 커밋이 하나라도 추가되면 삭제하지 않는다.

## 1차 확정 분류

### 역사/대체된 엔진 계보
- `feature/orchestrator-v0.1`
- `feature/cognitive-runtime-v0.6`
- `feat/capability-engine-v1`

현재 runtime 정본과 경쟁시키지 않는다.

### 역사/대체된 UI 계보
- `codex/ui-ux-new-project-starter`
- `codex/ui-ux-starter-completion`
- `codex/ui-ux-starter-runtime`
- `work/gpt/ui-ux-universal-contract-v1`

현재 Design System/Academy 진입 경로를 우회하는 신규 starter를 다시 만들지 않는다.

### Connector 구형 계보
- `feat/connector-registry-v1`

현 DevCenter Integration Hub와 의미를 대조한 뒤 retire한다.

### 검토 완료된 ERP UI 계보
- `claude/erp-platform-ui-ux-hvfyfa` (PR #283) — **SUPERSEDED**

2026-09-26 재검토 결과, 이 가지의 공통 의미는 현재 main의 `data.filter/list/detail/card`, `system.portable-task-panel`, `system.responsive`, `navigation.header`, `navigation.bottom-action`으로 이미 일반화되어 있다. 가지의 별도 ERP 색상·타이포·radius 값은 현재 전역 `design-system/tokens.json`과 경쟁하므로 두 번째 정본으로 회수하지 않는다. 따라서 PR 전체 병합이나 `design/erp-standard/` 복제 없이 역사 계보로 retire한다.

## Adapter 단일화

`contracts/core-adapter.schema.json`, `contracts/core-adapter-result.schema.json`, `src/contracts/engine-adapter-contract.mjs`가 provider/port Adapter 정본이다.

`src/engine/adapter-contract.mjs`는 Capability Engine 내부 호출 envelope다. 따라서 신규 provider Adapter가 이 runtime shape만 구현하고 canonical mapping/provenance/retry/compatibility 계약을 생략하는 것은 금지한다.

## Legacy 문서 규칙

과거 문서가 보존돼야 한다면 상단에 반드시 다음 의미가 표시돼야 한다.

- `NOT_CANONICAL`
- 현재 대체 정본
- 보존 목적

검색이나 AI retrieval이 과거 문서를 현재 정본으로 오인하지 않도록 하기 위함이다.

## AI Core 작업 레인과 프로젝트 소유권

AI Core의 작업은 `core / integration / audit / hardening` 네 레인으로 분류하지만, 레인 자체를 영구 branch로 만들지 않는다. 실제 branch는 구체적인 Work 하나에 대응하는 `work/<project-id>/<work-id>`만 허용한다.

도메인 구현은 원 프로젝트가 소유한다. AI Core는 다른 프로젝트를 감사하거나 공통 규격을 회수할 수 있지만, 과태료·Kakao Ops 같은 제품 기능을 AI Core의 장기 정본으로 복제하지 않는다. 기계용 기준은 `registry/development-continuity-policy.json#ai_core_work_lanes`다.
