# AI Core Development Continuity Baseline — 2026-09-26

Status: **CRITICAL BRANCH DEBT / ACTIVE-LINE CLASSIFICATION IN PROGRESS**

## 1. Project profile

AI Core profile: **COMPLEX**

근거:

- 전사 공통 AI Academy / governance
- Core Contract, Workflow, Capability Runtime
- UI/UX Design System
- DevCenter 실행 계층
- shared-services와 imported AIOps provenance
- 여러 자회사 repository를 연결하는 registry와 coordination 기능

복잡도가 높지만 branch budget을 늘리는 근거로 사용하지 않는다. 이 구조에서는 오히려 canonical scope와 Work 분해가 더 강해야 한다.

정상 목표:

- target active work branches: **2**
- hard max active work branches: **3**
- target branch lifetime: **24h**
- 72h 초과 unique branch: 원칙적으로 **0**
- merged-equivalent branch: 목표 **0**
- actor-owned 신규 branch: **0**

## 2. Current observed state

관측 시점: 2026-09-26

- remote branches: **289** (이번 continuity audit Work branch 포함)
- open PR head branches: **5**
  - draft: 3
  - non-draft: 2
- main protection: **disabled** at last observation
- repository rulesets: **0** at last observation

Branch family snapshot:

| prefix | count |
|---|---:|
| work/ | 84 |
| gpt/ | 74 |
| research/ | 32 |
| codex/ | 27 |
| docs/ | 19 |
| feat/ | 14 |
| fix/ | 12 |
| claude/ | 6 |
| c-session/ | 5 |
| feature/ | 3 |
| other prefixes combined | 12 |
| main | 1 |

**주의:** 289는 DORA의 “active branches”와 같은 지표가 아니다. 다수는 역사·merged·superseded일 수 있다. 그러나 AI 환경에서는 이 오래된 branch 집합 자체가 retrieval noise와 잘못된 continuation 후보를 만든다. 따라서 raw total은 **branch debt**로 관리한다.

## 3. External benchmark comparison

DORA trunk-based development의 대표 기준:

- application repository의 active branches가 **3개 미만**
- branch/fork lifetime이 **1일 미만**
- 최소 일 1회 trunk/main 통합

GitHub Flow는 PR merge 뒤 branch 삭제를 권장한다. 완료된 작업의 branch를 남겨 실수로 다시 사용하는 것을 피하기 위해서다.

우리 내부 기준은 이를 AI 환경에 맞춰 더 구체화한다.

- AI별 branch 금지
- Work별 branch 하나
- RESUME BEFORE CREATE
- 같은 canonical scope의 active line 중복 = 즉시 경고
- historical preservation은 PR/commit/tag로 이동

## 4. Current assessment

### CRITICAL — branch debt

289개 branch는 현재 프로젝트의 정상적인 “live development set”으로 볼 수 없다. 특히 `gpt/`, `codex/`, `claude/`, `work/<actor>/` 계보는 AI가 작업 identity가 되어 분기된 역사와 직접 연결된다.

### REVIEW REQUIRED — active line count

열린 PR head가 5개이므로 active-line proxy가 내부 hard max 3을 넘는다. 다만 open PR = active development가 아니므로 각각을 다음으로 분류해야 한다.

- ACTIVE
- HOLD
- REVIEW_ONLY
- SUPERSEDED
- READY_TO_MERGE
- RETIRE

### CRITICAL — protection gap

main이 protected가 아니고 ruleset이 없는 상태에서는 AI Core 규칙을 우회해 직접 push하거나 임의 branch naming을 사용하는 것을 GitHub 자체가 막지 못한다.

## 5. Reduction target

최종 목표는 숫자 자체가 아니라 다음 상태다.

```text
main
├─ work/<project>/<work-id>   # 0~2 normally
└─ work/<project>/<work-id>   # up to 3 hard max
```

AI Core는 별도 release branch가 현재 필요하지 않으므로 **정상 live remote branch set은 main 포함 약 2~4개**를 목표로 한다.

과거 이력은 branch로 보존하지 않는다.

## 6. Cleanup order

1. ahead=0 / main fully contains branch → 즉시 retire 후보
2. merged/closed PR head → retire
3. actor-prefixed unique branch → main과 의미 diff 회수 후 retire
4. 오래된 unique branch → Work/PR 연결 여부 확인
5. open PR 5개 → active scope와 canonical overlap 판정
6. 신규 AI-specific branch 생성 차단
7. main protection + required CI + merged-head auto-delete 활성화
8. audit 결과가 안정화되면 `continuity:gate`를 blocking gate로 승격

## 7. Audit responsibility

ChatGPT 감사 역할은 이후 프로젝트를 볼 때 최소 다음을 확인한다.

- branch 총량과 증가 추세
- active-line proxy
- 24/48/72h lifetime
- actor prefix
- open PR overlap
- canonical scope split
- unique-ahead orphan branch
- main protection / CI gate
- merge 후 branch cleanup

기능이 잘 만들어졌는지만 보지 않고 **개발이 한 탑으로 누적되고 있는지**를 같이 판정한다.
