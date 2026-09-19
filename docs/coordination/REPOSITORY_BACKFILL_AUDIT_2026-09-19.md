# Repository Backfill Audit — 2026-09-19

## 목적

AI Core가 일부 중앙 문서만 앞서가고 실제 프로젝트 저장소의 더 성숙한 구현·운영규격을 놓치는 문제를 막기 위해, 연결된 GitHub installation의 **36개 repository 전체**를 최신 commit 기준으로 재점검했다.

이 문서는 "등록 안 됨 = 폐기"라고 판단하지 않는다. 프로젝트 정본/최근 사용/현재 사용자 업무와의 연결이 불명확하면 **source-review 전까지 승격하지 않는 것**이 원칙이다.

## 이번에 AI Core로 역수입한 실제 우위

### FreePass Sales
- server truth와 local recovery 분리
- 외부 앱 launch와 업무 완료 분리
- append-only evidence / Storage overwrite-delete 방지
- work-key idempotency와 async entity binding
- draft continuity
- stable trim deep-link continuity
- customer-facing price fail-closed gate

정리: `docs/coordination/FREEPASS_SALES_RUNTIME_LEARNING.md`

### ERP4
- Product Browse와 인증 경계 완전 분리
- canonical ERP5 source only / legacy fallback 금지
- 기간·렌트료·보증금 same-price-row 무결성
- filter/facet/sort/card 동일 후보집합
- stabilization lifecycle + `check:erp4-main`

정리: `docs/coordination/ERP4_STABILITY_QUERY_LEARNING.md`

### AIOps
- lease, atomic stream write, reconcile, connector/cache, task-board, SSOT mechanics 등 shared-infrastructure 후보
- 업무 의미 코드는 이동하지 않고 계약/증거/두 번째 프로젝트 재사용부터 검증

정리: `docs/coordination/AIOPS_SHARED_INFRA_LEARNING.md`

### Welrix Table / FreePass Estimate
- 제품/domain authority와 현재 실행 구현 증거를 분리
- authoritative provider fail-closed
- canonical quote unit vs provider unit 변환 Adapter
- offline contract vs live parity 분리

정리: `docs/coordination/FREEPASS_SELF_QUOTE_ENGINE_ADAPTER_LEARNING.md`

## 전체 repository 분류

### 이미 AI Core registry가 추적 중
- ai-core
- aiops
- casemap-private
- devcenter
- docshub
- fp-settlement
- freepass-admin
- freepass-estimate
- freepass-homepage
- freepass-sales
- freepasserp4
- sonogong-estimator
- teamjpkwork
- workcontrol

### 이번에 등록
- **mewcar** — 현재 자동차 구독사업 내용/결정 SSOT. ACTIVE.
- **welrixtable** — 현재 신차 quote 실행/reference runtime. ACTIVE. 장기 제품 authority는 FreePass Estimate.
- **mewcar-jbwoori-proposal** — JB우리캐피탈 제안 전용 manuscript/deliverable history. REFERENCE. Mewcar 사업 사실을 덮지 않는다.

### 발견했지만 자동 승격하지 않음
다음은 연결돼 있지만, 현재 central routing authority로 승격할 근거가 이번 source review에서 충분하지 않다.

- freeepasserp2
- teamjpk
- freepasserp
- ci_center
- jpkerp
- jpkerp2
- jpkerp-v4
- freepasserp3
- gukminchagimpo
- rentsafe
- billincar
- vehicle-master
- renman
- freepasspartner
- chakhandeal
- welrix-proposal
- webtoon-studio
- `-`

이 목록은 RETIRE 판정이 아니다. 향후 실제 오더가 들어오거나 현재 운영 정본임이 확인되면 Project Capsule/source review 후 등록한다. 이름이나 과거 commit만 보고 legacy를 canonical로 올리지 않는다.

## 중앙 규칙

1. **Project authority와 implementation evidence를 분리한다.**
2. 다른 repo가 AI Core보다 앞서면 먼저 learning packet으로 역수입한다.
3. 공통 승격은 최소 두 번째 실제 프로젝트 재사용/검증 뒤에 한다.
4. project-specific business meaning은 원 프로젝트에 남긴다.
5. 등록 안 된 repo를 자동 폐기/무시하지 않는다. 필요 시 source review 후 승격한다.
6. 레지스트리 head는 실제 remote revision 관측 없이는 갱신하지 않는다.

## 이번 감사의 직접 결과

- stale project heads 갱신
- FreePass Estimate authority/runtime 오기 정정
- Sales/ERP4/AIOps 공통 학습패킷 생성
- FreePass Product UI profile 생성
- Mewcar / Welrix Table / Mewcar-JB우리 Proposal 중앙 발견성 추가
- Mewcar 자연어 업무 route 추가(실행 권한은 HOLD)
- 견적 capability에 Welrix runtime/reference project 연결


## A-session continuation — DevCenter / FP Settlement / Vehicle Master

### FP Settlement → B candidate
- `ui.machine-conformance-gate`
- Project-verified machine UI conformance using rendered-selector scope, last-effective CSS evaluation and CI failure on semantic token/role drift.
- Project-specific retro styling remains local.

### Vehicle Master → C backport gap
- Core is ahead on immutable identity and revision-level provenance.
- Existing exported IDs are documented as stable external keys but leaf IDs are derived from mutable semantic/display values.
- Direct replacement is HIGH breaking risk; migration must preserve current IDs as aliases during canonical-ID cutover.

### DevCenter → C candidate
- `result.proof-input-digest-binding`
- DevCenter binds evidence to source + checker/fixture input digests and invalidates PASS when either source or test implementation changes.
- AI Core already has broader revision-bound proof policy; this candidate supplies the missing executable specialization.
- Second-project exact proof was searched in ERP4/Sales/Admin/AIOps and was **not** established. ERP4's checker-manifest known-bad mechanism is adjacent QA evidence, not the same proof-input binding contract. Evidence level remains PROJECT_VERIFIED.

### DevCenter → C backport gap
- DevCenter `registry.json` source locators are not entry-level revision/hash bound.
- AI Core central project registry is also stale for DevCenter: recorded `132189799a...`, observed actual head `6a838a28...`.
- The one-commit delta only extends `standards/backend/FREEPASS-ADMIN-PILOT.md`; no runtime code drift was found in that delta.


## A-session continuation — TeamJPKWork / WorkControl / Sonogong

### TeamJPKWork → B promotion
- `ui.machine-conformance-gate` receives its second independent project implementation.
- Evidence: `teamjpkwork@75bb285a241b68c13acbe532c30d6d91110f8082` plus FP Settlement first evidence.
- Promotion: `PROJECT_VERIFIED → CROSS_PROJECT_VERIFIED`.
- Route: B / `COMMON_ADOPTED_CANDIDATE`.
- Local design values and theme-specific rules remain project/profile-specific.

### WorkControl → D supporting evidence
- Human/UI completion claims are independently checked against business evidence.
- Adds a third project to `workflow.guard-vs-evidence` and `workflow.launch-vs-completion`.
- `workflow.obligation-pair` is not promoted because due/timeout enforcement was not proven in the inspected runtime.

### Sonogong Estimator → production-proof HOLD
- Repository contains live-bundle feature-marker and app-commit verification mechanics.
- Historical handoff says the Vercel site was live, but the currently connected Vercel team exposes zero projects.
- Current production target/revision cannot be independently resolved.
- `release.production-revision-proof` evidence level remains unchanged; Sonogong is not counted as second production proof.


## A-session continuation — Mewcar / Homepage / Renman / Chakhandeal

### Mewcar → C backport gap
- Project content SSOT is strong: four-file canonical set, explicit assertion maturity (`확정/대표 의견/내부안/미정`), history retention, planning vs legal execution separation.
- Gap: `PROJECT_READ_FIRST.md` still opens with the older 2026-09-16 canonical route while the 2026-09-18 `정본/README.md` supersedes it with the four-file canonical set.
- Direction: **Core > Project** for canonical-entrypoint/supersession discipline.
- Migration: repoint entrypoint → preserve old docs as source/history → explicit supersession verification.

### FreePass Homepage → B backport gap
- Current head: `5f0152c26ac1f106a5f5aee46a3e0020d653c8f5`.
- Smooth scroll, reveal transitions, marquee, count-up and continuous canvas animation are present.
- No reduced-motion branch was found.
- Direction: **Core > Project**; AI Core B standard already requires reduced-motion behavior.
- No new B standard candidate created.

### Renman → D candidate
- New candidate: `workflow.compensated-multiwrite`.
- Evidence: `renman@262e06de09db94a116fa377ea2f5dbe024bb086b`.
- Multi-write failure compensates already-applied effects in reverse order using domain-owned undo patches.
- Compensation failure is not swallowed; remaining partial state is surfaced explicitly.
- Evidence level: `PROJECT_VERIFIED`; second exact project required.

### Chakhandeal → no promotion / implementation HOLD
- Identity-token subject binding, PII vault and e-contract read-through are real code/test evidence.
- But Phase 4 `consent_grants` remains design-only:
  - `hasValidConsentGrant` is still a `return false` stub.
  - planned `tests/phase4-grant.test.js` is absent.
- Therefore granular consent-grant behavior is **not** counted as project-verified.
- This is retained as a negative promotion-control example: spec/brief presence is not implementation evidence.

### DocsHub / FreePass Homepage promotion decision
- DocsHub was inspected but no new B/C/D common mechanism met the promotion threshold.
- Homepage produced a backport accessibility gap, not a reverse-import candidate.
