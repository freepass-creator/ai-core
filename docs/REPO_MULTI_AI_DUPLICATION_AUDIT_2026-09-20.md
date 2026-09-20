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


---

## 13. 2차 감사 — 중대형 Repo 확장 점검

이번 구간도 **관찰/기록만 수행**했다.

### Docshub

Repo: `freepass-creator/docshub`

Branch:

- `main`
- `cursor/mucar-residual-value-template-67bf`
- `cursor/setup-docshub-env-aeaf`

두 Cursor branch 모두 main과 diverged 상태다.
main 자체는 현재 `README.md / app.js / index.html / styles.css` 정도의 소형 구조다.

따라서 branch 이름만 보고 폐기하면 안 되고,
실제 문서 허브 정본이 main에 있는지 또는 별도 branch에 남았는지 확인이 필요하다.

### Workcontrol

Repo: `freepass-creator/workcontrol`

Branch는 `main` 하나로 단순하다.

다만 main tree에:

- `backups/`
- `backups/프라임구독 운영관리.json`
- `tmp-dev.log`
- `tsconfig.tsbuildinfo`

등의 운영/개발 산출물이 추적되고 있다.

branch 중복은 거의 없지만,
향후에는 **소스와 runtime/debug/backup artifact의 경계**를 확인할 필요가 있다.

현재 삭제하지 않는다.

### TeamJPKWork

Repo: `freepass-creator/teamjpkwork`

Branch는 `main` 하나다.

main에 `CLAUDE.md`가 존재한다.
큰 branch 중복은 없으며, 이번 감사 범위에서는 구조가 비교적 단순하다.

향후 AI 지시문이 AI Core 공통 규칙과 충돌하는지만 별도 확인하면 된다.

### WelrixTable

Repo: `freepass-creator/welrixtable`

총 8 branches 확인.

주요 branch:

- `audit/ui-ux-unification-20260918`
- `feat/mobile-ux-qa-unify`
- `feat/share-quote-snapshot`
- `improve/self-quote-contract-20260919`
- `polish/quote-ui-final-pass-20260918`
- `qa/capture-web-mobile-20260918`
- `cursor/freepass-sales-ad-links-cd11`
- `main`

검사한 작업 branch들은 모두 main과 **diverged** 상태였다.

즉 현재는 단순한 "완료 branch 잔재"가 아니라
각 branch에 main에 없는 변경이 남아 있을 가능성이 있다.

특히 WelrixTable은 과거 견적/셀프견적 근원 기능을 가진 Repo이므로,
정리 전에 FreePass Sales / Self Quote / AI Core와 기능 계보를 대조해야 한다.

### Mewcar

Repo: `freepass-creator/mewcar`

Branch:

- `main`
- `work/gpt/ai-core-subscription-read-adapter-v1`

GPT 작업 branch는 main보다 뒤에 있고 별도 미흡수 diff가 없는 상태로 확인되었다.

main에는 사업기획/매뉴얼/정본/검토 문서와 함께
ChatGPT 및 Gemini 검토 기록이 존재한다.

branch 정리 위험은 낮지만,
문서에서는 **정본 vs 검토초안/AI 검토 evidence** 구분이 중요하다.

### Vehicle Master

Repo: `freepass-creator/vehicle-master`

Branch는 `main` 하나다.

현재 branch 중복 위험은 낮다.
차종 SSOT 성격상 다른 ERP/견적기 Repo의 복제 차종 데이터와의 관계를
향후 별도 SSOT 감사에서 확인하는 것이 맞다.

### FP Settlement

Repo: `freepass-creator/fp-settlement`

Branch:

- `main`
- `cursor/about-settlement-content-df7a`
- `work/claude/settlement-ui-v1`

두 작업 branch 모두 main이 전부 포함하고 있는 상태로 확인되었다.

따라서 향후 cleanup 후보가 될 수 있으나,
현재는 삭제하지 않는다.

main에는 `lib/domain/legacy-sheets.ts`가 있어
legacy adapter 경계는 추후 정리 필요하다.

### FreePass Partner

Repo: `freepass-creator/freepasspartner`

Branch:

- `main`
- `docs/ai-core-ui-reference-20260919`

AI Core UI reference branch는 main에 전부 포함된 상태다.

main tree에는:

- `트래커.html.bak`
- `제안서원본/제안서_기본.pdf.bak`

같은 .bak 파일이 실제 추적되고 있다.

이는 기능 중복보다는 source/backup artifact hygiene 문제다.
현재 삭제하지 않는다.

---

## 14. 3차 감사 — 기타 큰 Repo

### Renman

Repo: `freepass-creator/renman`

8 branches 확인.

특이사항:

- `agent/mobile-closeout-viewer` — main보다 약 116 commits 앞섬
- `agent/operator-upload-readiness` — 약 114 commits 앞섬
- `agent/penalty-loading-state` — 약 112 commits 앞섬
- `chore/tokenize-atoms` — 약 410 commits 앞섬
- `redesign/pagedef-p0` — 약 123 commits 앞섬
- `design/home-2026-08`, `reborn/2026-08-21`은 main이 포함

즉 Renman은 **실제 구현이 main 밖의 오래된 작업 branch에 크게 남아 있을 가능성**이 있다.

이 Repo는 FreePass Estimate와 비슷하게 default main만 보고 정리하면 위험하다.

또한 main에:

- `.cursor/`
- `CLAUDE.md`
- `RENMAN-CURSOR.md`
- 다수 `docs/CURSOR-ORDER-*`
- `docs/CODEX-CROSSREVIEW-*`
- `tools/archive/`

가 존재한다.

archive 폴더는 명시적으로 구분되어 있어 ERP4보다는 낫지만,
AI별 작업 지시가 상당히 많이 남아 있다.

### Chakhandeal

Repo: `freepass-creator/chakhandeal`

5 branches 확인.

- `cursor/econtract-scaffold-9796` — main보다 앞선 변경 존재
- `cursor/phase2-can-read-transaction-9796` — main보다 앞선 변경 존재
- `cursor/phase3-pii-vault-9796` — main보다 앞선 변경 존재
- `cursor/freepass-esign-issue-20260808` — main이 포함

전자계약 관련 구현이 일부 Cursor branch에 남아 있을 수 있으므로,
FreePass ERP4 / FreePass Admin의 e-sign 구현과 대조 후 정리해야 한다.

### FreePass Homepage

Repo: `freepass-creator/freepasshomepage`

5 branches 확인.

- `main`
- `backup-old-main`
- `claude/youthful-dijkstra-ay2l4j`
- `docs/ai-core-ui-reference-20260919`
- `redesign-2026`

특이사항:

- `backup-old-main`과 `main`은 **공통 조상이 확인되지 않음**
- `redesign-2026`은 main보다 약 28 commits 앞선 상태
- Claude branch는 main과 diverged
- AI Core UI reference branch는 main이 포함

따라서 `backup-old-main`은 단순 과거 branch라기보다
별도 역사(lineage)를 가진 보존본일 수 있다.

### TeamJPK

Repo: `freepass-creator/teamjpk`

3 branches:

- `main`
- `backup-old-main`
- `redesign-2026`

`backup-old-main`은 main과 공통 조상이 확인되지 않았다.

`redesign-2026`은 현재 main과 동일한 상태다.

따라서 backup-old-main은 별도 lineage evidence로 취급해야 한다.

### Sonogong Estimator

Repo: `freepass-creator/sonogong-estimator`

3 branches.

- `feat/notice-stock-consult` — main보다 약 17 commits 앞섬
- `work/shared-work-ui-v2` — main이 전부 포함
- `main`

손오공 견적 관련 실제 기능 일부가 feature branch에 남았을 가능성이 있으므로
WelrixTable / FreePass Estimate / FreePass Sales Self Quote 계보와 함께 봐야 한다.

### CI Center

Repo: `freepass-creator/ci_center`

`feat/card-print-spec` branch는 main과 동일한 상태로 확인됐다.

현재 branch 중복 위험은 낮다.

### Casemap Private

Repo: `freepass-creator/casemap-private`

Branch는 main 하나지만 tree가 약 2,373 entries로 크다.

main에:

- `.cursor/`
- `AGENTS.md`
- 다수의 Claude/Cursor/Gemini/GPT 검증 문서
- `tmp/`
- `tmp/pdfs/`
- 브라우저 프로필/cache/network artifact로 보이는 다수 임시 파일

이 존재한다.

즉 branch 중복은 없지만 **임시 실행물과 evidence가 source tree에 함께 들어간 구조**가 강하다.

법률 사건 자료 특성상 임의 삭제는 금지해야 하며,
향후에는 source/evidence/tmp/runtime artifact를 논리적으로 분리할 필요가 있다.

### Webtoon Studio

Repo: `freepass-creator/webtoon-studio`

Branch는 main 하나다.

명시적인 `archive/` 아래 legacy Next app, broken assets, drafts 등이 구분되어 있어
중복이 있더라도 **archive 경계가 명확한 편**이다.

여러 하위 프로젝트별 `AGENTS.md`가 존재하므로
AI 지시문 상속 관계만 추후 확인하면 된다.

### Billincar

Repo: `freepass-creator/billincar`

Branch는 main 하나이며,
이번 감사 범위에서는 특별한 AI branch/backup 중복은 확인되지 않았다.

---

## 15. 2~3차 감사에서 추가된 핵심 위험

새로 중요하게 잡힌 것은 다음 네 가지다.

1. **Renman**
   - main 밖에 100~400 commits 앞선 branch가 존재
   - 정본/default branch 오판 위험

2. **FreePass Homepage / TeamJPK**
   - `backup-old-main`이 main과 공통 조상이 없는 별도 lineage
   - 단순 backup 삭제 대상으로 보면 안 됨

3. **Casemap Private**
   - branch는 단순하지만 tmp/browser/runtime artifact가 대량 추적됨
   - 법률 evidence와 임시 산출물 경계가 혼재

4. **WelrixTable / Sonogong Estimator / Chakhandeal**
   - main에 없는 실질 변경이 작업 branch에 남아 있을 가능성
   - 견적/전자계약 정본 통합 전에 diff 회수 필요

현재 역시 어떤 정리 작업도 수행하지 않았다.
