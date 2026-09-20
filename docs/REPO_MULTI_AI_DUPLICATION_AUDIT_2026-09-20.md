# Repo / Multi-AI Duplication Audit — 2026-09-20

## 목적

여러 AI(ChatGPT/GPT, Claude, Codex, Cursor, Gemini 등)를 병렬로 사용하면서 발생한
Repo/Branch/문서/작업물의 중복·복제·정본 혼선을 점검한 1차 감사 기록이다.

이 문서는 **관찰 내용과 후속 점검 포인트만 기록**한다.

- Branch 삭제 안 함
- Repo 삭제/Archive 안 함
- Merge/Rebase 안 함
- Default branch 변경 안 함
- AI 역할 규칙 수정 안 함
- 운영 코드 수정 안 함

정리 작업은 별도 승인/작업에서 수행한다.

---

## 1. 전체 관찰

2026-09-20 기준 연결된 GitHub 계정에서 확인 가능한 Repo는 36개다.

큰 프로젝트에서 반복되는 패턴:

1. AI별 별도 branch 생성
2. 같은 작업에 v1/v2/v3, final/final2/final3, refresh/replay/current-main 등 연속 branch 생성
3. 완료된 branch가 main에 흡수된 후에도 남아 있음
4. AI별 지시문(AGENTS/CLAUDE/GEMINI/CURSOR/AI_GUIDE)이 동시에 존재
5. 과거 진단/검수/handoff/variant 문서가 현재 정본 문서와 같은 위치에 병존
6. default branch와 실제 구현 branch가 다른 Repo 존재
7. 같은 계열 프로젝트가 Repo 단위로 여러 세대 존재

향후 정리 시에는 단순 이름 기준 삭제가 아니라
**MERGED / DIVERGED / ACTIVE / EVIDENCE_ONLY / LEGACY / REPLACED**
분류 후 처리해야 한다.

---

## 2. 주요 프로젝트 1차 상태

| Project | 관찰 상태 | 1차 판단 |
|---|---|---|
| ai-core | 144 branches 확인 | AI 세션/연구/버전 누적이 큼 |
| freepasserp4 | 416 branches 확인 | 가장 큰 branch/AI 산출물 누적 |
| freepass-estimate | main에는 README 1개 | 실제 구현과 default branch 불일치 가능성 매우 높음 |
| aiops | 9 branches | branch 수보다 AI 지시문 충돌이 중요 |
| freepass-sales | 29 branches | 중간 수준, AI/CI/backup branch 존재 |
| freepass-admin | 17 branches | AI별 구현 branch 병존 |
| devcenter | 4 branches | 상대적으로 단순 |

---

## 3. AI Core

Repo: `freepass-creator/ai-core`

### Branch 누적

144 branches가 확인되었다.

대표적인 반복 패턴:

- `c-session/logical-execution-identity-v1-20260920`
- `c-session/logical-execution-identity-v2-20260920`
- `c-session/logical-execution-identity-v3-current-main-20260920`

- `docs/session-missions`
- `docs/session-missions-2`
- `docs/session-missions-3`

- `research/a-review-allocator-v1-final-20260920`
- `research/a-review-allocator-v1-final2-20260920`
- `research/a-review-allocator-v1-final3-20260920`

- workflow 계열의 `refresh`, `final`, `replay`, `current-main` 변형

### main에 이미 포함된 것으로 확인된 예

아래 branch는 비교 당시 main이 해당 branch의 변경을 전부 포함하고 있었다.

- `c-session/logical-execution-identity-v3-current-main-20260920`
- `docs/session-missions`
- `docs/session-missions-3`

따라서 향후 cleanup 후보가 될 수 있으나,
현재 문서에서는 삭제를 승인하지 않는다.

### diverged 예

- `docs/session-missions-2`
- `research/a-review-allocator-v1-final-20260920`
- `research/a-review-allocator-v1-final2-20260920`
- `research/a-review-allocator-v1-final3-20260920`

이들은 main과 갈라져 있으므로 삭제 전에 유효 diff 확인이 필요하다.

---

## 4. FreePass ERP4

Repo: `freepass-creator/freepasserp4`

### Branch 규모

총 416 branches가 확인되었다.

현재 가장 큰 중복/누적 위험 구간이다.

대표 패턴:

- ChatGPT 계열
- Claude 계열
- Codex 계열
- Cursor 계열
- diag/debug 계열
- docs 계열
- save/deploy 계열
- 동일 작업의 v2/final/refresh 연속 버전

예:

- `chatgpt/erp5-downstream-canonical-20260918`
- `chatgpt/erp5-downstream-canonical-v2-20260918`

- `claude/mobility-com-homepage-refresh`
- `...-refresh-2`
- `...-refresh-3`
- `...-refresh-4`
- `...-refresh-5`
- `...-refresh-6`

- `codex/source-registry-current`
- `codex/source-registry-v2`

### main에 포함된 것으로 확인된 예

- `chatgpt/erp5-downstream-canonical-v2-20260918`
- `claude/mobility-com-homepage-refresh-5`
- `claude/mobility-com-homepage-refresh-6`

이 역시 cleanup 후보일 수 있지만 현재는 기록만 남긴다.

### 문서/작업물 누적

root와 docs에 다음 종류가 동시에 존재한다.

- CLAUDE 관련 진단/검수/handoff
- CODEX 진단/검증
- CURSOR 작업 지시/상태/handoff
- ChatGPT AI-SSOT audit 기록
- design-variants
- 과거 backup/archive 자료

특히 실제 운영 코드와 과거 AI 산출물이 같은 Repo에 함께 있어
새 AI가 과거 문서를 최신 정본으로 오인할 위험이 있다.

---

## 5. FreePass Estimate

Repo: `freepass-creator/freepass-estimate`

### 핵심 문제

default `main` tree에는 확인 당시 `README.md` 1개만 존재했다.

반면 실제 구현 규모가 큰 branch들이 존재한다.

| Branch | main 대비 |
|---|---:|
| `work/ui-baseline` | +260 commits / 약 226 files |
| `c-adoption/core-contract-shadow-v2` | +259 commits / 약 226 files |
| `c-adoption/core-contract-shadow` | +255 commits |
| `docs/ai-core-ui-reference-20260919` | +208 commits |
| `backup/new-provider-refactor-20260919` | +24 commits |

비교 결과:

- `work/ui-baseline`은 `c-adoption/core-contract-shadow-v2`보다 1 commit 앞선 관계가 확인됨.
- `backup/new-provider-refactor-20260919`은 `work/ui-baseline` 쪽 계보에 포함된 상태로 확인됨.

### 위험

새 세션/AI가 default main만 기준으로 프로젝트를 읽으면
실제 구현이 없는 것으로 판단하고 새 구현을 만들 수 있다.

따라서 이 Repo는 향후 정리 시 **정본 branch/default branch 확인이 P0**다.

현재는 변경하지 않는다.

---

## 6. AIOps — AI 지시문 충돌

Repo: `freepass-creator/aiops`

주요 지시 파일:

- `AGENTS.md`
- `AI_GUIDE.md`
- `CLAUDE.md`
- `GEMINI.md`
- `.cursorrules`
- `.cursor/`

### 확인된 충돌

`AI_GUIDE.md`와 `CLAUDE.md`에는 2026-09-16 정정으로
**AI 이름별 고정 역할을 폐지하고 실제 능력/도구 접근/독립 검토 조건으로 배정**한다는 최신 원칙이 들어가 있다.

반면 일부 지시에는 여전히:

- Codex = 실행/통합
- Claude = 설계/정책
- Cursor = 코드/회귀 검수
- Gemini = Workspace/읽기 전용

식의 이름 고정 규칙이 남아 있다.

특히 `GEMINI.md`는 Gemini의 역할을 강하게 읽기 전용으로 제한하고
Claude/Codex 쪽으로 넘기는 과거 구조가 유지되어 있다.

### 위험

같은 Repo에서도 어떤 AI가 어느 파일을 먼저 읽느냐에 따라
서로 다른 역할/승인/작업 방식으로 움직일 수 있다.

향후 목표 구조 후보:

```
공통 AI 운영 헌법 1개
  ↓
AI별 entrypoint는 얇은 adapter
  ↓
현재 capability / 권한 / 독립검토 조건으로 역할 결정
```

현재는 구조 변경하지 않는다.

---

## 7. FreePass Sales

Repo: `freepass-creator/freepass-sales`

29 branches 확인.

관찰 예:

- `ci/cross-platform-browser-20260918`
- `ci/cross-platform-browser-v2-20260918`
- `codex-backup-2026-09-16`
- Claude/Codex/Cursor/GPT 작업 branch
- AI Core adoption branch

main tree에는:

- `.ai-core/`
- `.claude/`
- `AGENTS.md`
- `AI_CORE_UI.md`

등이 존재한다.

ERP4보다는 정돈되어 있으나,
AI별 작업 branch와 backup 계열은 별도 분류가 필요하다.

---

## 8. FreePass Admin

Repo: `freepass-creator/freepass-admin`

17 branches 확인.

GPT/Codex/Claude/Cursor 기반 작업 branch가 각각 존재한다.

예:

- `work/gpt/admin-visual-implementation-r1`
- `work/gpt/admin-ui-integration-r2`
- `codex/functional-settlement-mvp-20260913`
- `work/claude/esign-center-v1`

일부 GPT 구현 branch는 main과 diverged 상태였다.
따라서 이름만 보고 구버전으로 판단하면 안 된다.

---

## 9. DevCenter

Repo: `freepass-creator/devcenter`

4 branches 확인.

큰 프로젝트 중에서는 상대적으로 branch 구조가 단순하다.

주요 top-level 구조:

- capabilities
- design
- docs
- engine
- operations
- portal
- quality
- ssot
- standards

현 시점에서는 우선 정리 위험도가 낮다.

---

## 10. ERP Repo 계보 중복

ERP/JPKErp 명칭 계열 Repo가 최소 8개 확인되었다.

- `freeepasserp2`
- `freepasserp`
- `jpkerp`
- `jpkerp2`
- `jpkerp-v4`
- `freepasserp3`
- `jpkerp5`
- `freepasserp4`

이들은 단순 중복으로 바로 삭제할 수 없다.

향후 각 Repo마다 다음 상태를 명시할 필요가 있다.

- CURRENT
- LEGACY
- REFERENCE
- REPLACED
- ARCHIVE

또한 다음을 확인해야 한다.

- 현재 실제 배포/서비스 사용 여부
- 데이터 SSOT 소유 여부
- 다른 Repo가 아직 참조하는지
- 역수입해야 할 기능이 남아 있는지
- 법적/감사/운영 증적 보존 필요 여부

---

## 11. 향후 정리 원칙

실제 cleanup을 시작할 때 권장하는 판정 순서:

1. 현재 default branch 확인
2. 실제 production/deployment 연결 확인
3. main 대비 branch ancestry 확인
4. branch의 유효 diff 존재 여부 확인
5. AI 산출물인지 실제 product source인지 구분
6. 문서가 current SSOT인지 historical evidence인지 구분
7. 외부 Repo/CI/deploy가 참조하는지 확인
8. 그 후에만 cleanup/archive 판단

Branch는 최소 다음 상태로 분류한다.

- ACTIVE
- MERGED
- DIVERGED
- EVIDENCE_ONLY
- EXPERIMENT
- BACKUP
- RETIRE_CANDIDATE

Repo는 최소 다음 상태로 분류한다.

- CURRENT
- LEGACY
- REFERENCE
- REPLACED
- ARCHIVE_CANDIDATE

---

## 12. 다음 점검 우선순위

1. FreePass Estimate — 정본/default branch 확인
2. AI Core — 144 branches 분류
3. FreePass ERP4 — 416 branches 분류
4. AIOps — AI 지시문 충돌 지도
5. ERP 계열 8 Repo 계보 작성
6. FreePass Sales
7. FreePass Admin
8. DevCenter
9. Docshub / Workcontrol
10. 나머지 Repo 전체

---

## 현재 결론

현재 문제는 단순히 "파일이 많다"가 아니다.

핵심은:

- 여러 AI가 같은 문제를 별도 branch/문서로 반복 해결
- 완료된 산출물과 진행 중 산출물이 섞임
- AI별 지시문이 서로 다른 세대의 규칙을 보유
- 실제 정본 branch와 default branch가 일치하지 않는 사례 존재
- 같은 제품 계열 Repo가 여러 세대 살아 있음

따라서 향후 정리는 **삭제 작업이 아니라 먼저 canonicalization 작업**으로 진행해야 한다.

이 문서는 2026-09-20 1차 감사 evidence이며,
현재 어떤 branch/Repo/문서의 삭제 또는 변경도 승인하지 않는다.
