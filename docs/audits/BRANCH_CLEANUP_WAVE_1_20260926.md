# Branch Cleanup Wave 1 — 2026-09-26

Status: **EVIDENCE-BASED RETIREMENT CANDIDATES**

기준 revision: `main@be3b31becd746cadc0c0f68284c426713b7e6528`

브랜치 이름이 오래됐다는 이유로 삭제하지 않는다. GitHub compare에서 `ahead=0`이면 main에 없는 고유 commit이 없으므로 1차 안전 retire 후보로 본다.

## A. 즉시 retire 가능한 후보 — unique commit 0

| branch | relation to main | ahead | behind | disposition |
|---|---:|---:|---:|---|
| `claude/ai-core-integration-standardization-ntmoli` | exact same head at audit | 0 | 0 | DELETE_CANDIDATE |
| `c-session/core-contract-adoption-p1` | behind | 0 | 770 | DELETE_CANDIDATE |
| `c-session/core-contract-standard-v1` | behind | 0 | 819 | DELETE_CANDIDATE |
| `c-session/logical-execution-identity-v3-current-main-20260920` | behind | 0 | 444 | DELETE_CANDIDATE |
| `work/gpt/ui-ux-universal-contract-v1-refresh-20260919` | behind | 0 | 636 | DELETE_CANDIDATE |
| `work/gpt/uiux-b5-current-main-20260920` | behind | 0 | 439 | DELETE_CANDIDATE |
| `work/gpt/workflow-standard-v1-20260919` | behind | 0 | 649 | DELETE_CANDIDATE |
| `work/gpt/workflow-standard-v2-engine-admission-refresh-20260920` | behind | 0 | 626 | DELETE_CANDIDATE |
| `work/gpt/workflow-d8-current-main-20260920` | behind | 0 | 454 | DELETE_CANDIDATE |

이 목록은 코드 회수 없이 retire해도 **Git commit 기준 고유 변경을 잃지 않는다**. branch deletion 자체는 #305가 정본 경계를 main에 심은 뒤 실행하는 것을 권장한다.

## B. 삭제 전 diff 회수 검토가 필요한 후보

| branch | ahead | behind | disposition |
|---|---:|---:|---|
| `codex/ai-core-main-sync-20260920` | 6 | 342 | UNIQUE_REVIEW |
| `codex/ai-core-recovery-20260921` | 2 | 317 | UNIQUE_REVIEW |
| `codex/ai-core-usable-flow-20260920` | 1 | 347 | UNIQUE_REVIEW |
| `feature/orchestrator-v0.1` | 21 | 1206 (prior audit) | HISTORICAL_UNIQUE_REVIEW |
| `feature/cognitive-runtime-v0.6` | 23 | 1206 (prior audit) | HISTORICAL_UNIQUE_REVIEW |
| `feat/capability-engine-v1` | 82 | 1009 (prior audit) | SUPERSEDED_UNIQUE_REVIEW |
| `feat/connector-registry-v1` | 12 | 1000 (prior audit) | SUPERSEDED_UNIQUE_REVIEW |
| `claude/erp-platform-ui-ux-hvfyfa` / PR #283 | 108 | 199 (prior audit) | ACTIVE_PATTERN_EXTRACTION |

`ahead > 0`은 곧 채택해야 한다는 뜻이 아니다. main에 없는 commit이 있다는 뜻뿐이다. 현재 정본과 의미 diff를 비교해 필요한 부분만 회수하고 나머지는 retire한다.

## 다음 wave

1. `gpt/*` 74개
2. `work/*` 83개
3. `research/*` 32개
4. `codex/*` 27개
5. `docs/*` 19개

순으로 compare하여 `ahead=0` 후보를 먼저 제거하고, `ahead>0`만 사람이 읽을 목록으로 줄인다.
