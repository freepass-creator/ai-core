# Canonical Development Lines — 2026-09-26

Status: **CANONICAL CONSOLIDATION MAP**

AI Core는 같은 관심사에 두 개 이상의 정본을 두지 않는다. 브랜치·실험·과거 문서는 근거와 역사를 보존할 수 있지만 현재 구현의 권위가 되지 않는다.

## 현재 정본

| concern | canonical line | 비고 |
|---|---|---|
| UI/UX | `docs/UI_UX_START_HERE.md` → `design-system/` + `registry/ui-ux-*` | `design/claude-v1/`은 역사자료 |
| Development Continuity | `docs/DEVELOPMENT_CONTINUITY_STANDARD.md` + `registry/development-continuity-policy.json` | Work owns branch; RESUME BEFORE CREATE |
| Core Contract | `docs/CORE_CONTRACT_STANDARD.md` + `contracts/core-*` + `src/contracts/` | provider Adapter 표준 포함 |
| Capability Runtime | `src/engine/capability-engine.mjs` | runtime adapter envelope는 Core Adapter 표준을 대체하지 않음 |
| Workflow | `docs/workflow/WORKFLOW_CONSTITUTION.md` + `src/workflow/` + `registry/workflow-*` | 과거 D1~D8 브랜치는 정본 아님 |
| Integration Connector | `devcenter/hubs/integration/` + `devcenter/contracts/integration-connector.schema.json` | 과거 root connector-registry 계보는 정본 아님 |
| AIOps import | `aiops/README.md`가 import 경계를 설명 | 내부 legacy 문서의 과거 "정본" 선언은 AI Core 전체에 효력 없음 |

기계용 정본은 `registry/canonical-development-lines.json`이다.

## 브랜치 정리 원칙

브랜치를 이름만 보고 삭제하지 않는다. 각 브랜치는 다음 중 하나로 분류한다.

- `MERGED_EQUIVALENT`: main과 핵심 구현이 동일하거나 이미 흡수됨.
- `SUPERSEDED`: main이 더 발전한 후속 구현이며 다시 merge하면 회귀 위험이 있음.
- `HISTORICAL`: 실험/연구 계보로 보존 가치만 있음.
- `UNIQUE_REVIEW`: main에 없는 의미 있는 구현이 남아 있어 회수 검토가 필요함.
- `ACTIVE`: 현재 열린 작업이며 정본과의 충돌 여부를 먼저 해결함.

삭제는 `MERGED_EQUIVALENT` 또는 검토 완료된 `SUPERSEDED/HISTORICAL`만 대상으로 한다.

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

### 별도 검토가 필요한 현행 충돌선
- `claude/erp-platform-ui-ux-hvfyfa` (PR #283)

ERP 패턴 중 회수할 것은 현재 `design-system/` 정본에 흡수하고, 별도 ERP UI 정본을 추가하지 않는다. PR 전체를 그대로 병합하는 방식은 사용하지 않는다.

## Adapter 단일화

`contracts/core-adapter.schema.json`, `contracts/core-adapter-result.schema.json`, `src/contracts/engine-adapter-contract.mjs`가 provider/port Adapter 정본이다.

`src/engine/adapter-contract.mjs`는 Capability Engine 내부 호출 envelope다. 따라서 신규 provider Adapter가 이 runtime shape만 구현하고 canonical mapping/provenance/retry/compatibility 계약을 생략하는 것은 금지한다.

## Legacy 문서 규칙

과거 문서가 보존돼야 한다면 상단에 반드시 다음 의미가 표시돼야 한다.

- `NOT_CANONICAL`
- 현재 대체 정본
- 보존 목적

검색이나 AI retrieval이 과거 문서를 현재 정본으로 오인하지 않도록 하기 위함이다.
