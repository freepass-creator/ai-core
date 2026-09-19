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
