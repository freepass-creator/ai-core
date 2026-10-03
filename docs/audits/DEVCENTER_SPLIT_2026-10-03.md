# 개발 센터(devcenter) 나누기 — AI-CORE / AI-OPS 분류표 (2026-10-03)

> 대표 10-03: 「개발 센터를 AI-OPS 랑 AI-CORE 로 나눠서 갖고 와야 된다」(경영지원실 오더).
> 대상은 이 저장소의 `devcenter/` 다 — 원본 `freepass-creator/devcenter` 는 2026-09-29 보관(archive)됐고, 9/22 복사 뒤 실제 개발은 이 사본에서 이어져 사본이 정본이다(`registry/sunset.json` devcenter 항목).
> 분류 기준: `registry/platforms.json` — Core=두뇌(규칙·노하우·검증·계약·허브 판정), Ops=손발(PC·카톡·업무 실행 도구).
> 조사: Codex(gpt-6-astra, read-only) / 검증: Claude — 바깥 의존(19개 파일이 `devcenter/` 를 참조)을 따로 실측해 대조. 비밀·주민번호 검사 222개 + tgz 내부 0건.
> 이 표대로 옮기는 PR 들이 이 문서를 가리킨다. 옮긴 뒤 `devcenter/` 를 지우는 것은 바깥 의존 0 을 다시 확인한 다음.

---

**222개 파일: AI-CORE 162개 · AI-OPS 3개 · 중복 12개 · 버림 후보 45개.** 파일 변경 없음. 기준: `main@a7e75d750d03f88dae0d2ebb1a9447c5b9d20536`.

경로는 `devcenter/` 기준이다. 옮길 곳은 **제안 경로**이며, 중복은 바이트 동일성이 아니라 **이미 본체가 맡는 규칙·안내의 중복**이다. 버림 후보도 복구본 검증 전 삭제를 뜻하지 않는다.

의존 열의 약어:

- **공통**: 모든 222개는 `registry/sunset-devcenter-absorption.json`, `test/sunset-devcenter-absorption.test.mjs`, `test/devcenter-physical-copy.test.mjs`의 목록·계보 검사 대상이다. 아래 `없음`은 이 공통 검사를 제외한 추가 소비처가 없다는 뜻이다.
- **D**: `registry/devcenter-datasets.json`의 해당 파일 locator. 실행 import와 구별되는 등록부 참조다.
- **R**: `test/core-hub-receipt.test.mjs:32`의 동적 스키마 읽기.
- **E**: `src/engine/core-hub-receipt.mjs:207`의 동적 `commandRef` 생성. 해당 스크립트를 import하거나 실행하지는 않는다.
- **C**: `registry/canonical-development-lines.json`.
- **U**: `registry/ui-ux-entrypoint.json`, `src/engine/ui-ux-entrypoint.mjs`.
- **T**: `package.json`의 `test:devcenter`.

| 경로 | 분류 | 옮길 곳 | 근거 한 줄 | 의존 |
|---|---|---|---|---|
| `.gitattributes` | 버림 후보 | 이관 없음 | 별도 저장소였던 사본 설정; 본체 설정과 통합 여부만 확인 | 없음 |
| `.gitignore` | 버림 후보 | 이관 없음 | 옛 디렉터리 허용 목록; 경로 이동 뒤 그대로 사용할 설정 아님 | 없음 |
| `AGENTS.md` | 중복 | 기존 `docs/AI_WORKING_STANDARD.md` | 본문 자체가 루트 헌법·Academy·라우팅으로 위임 | D |
| `PROVENANCE.json` | 버림 후보 | 복구 이력 보존 | 사본 계보 자료이며 실행 기능 아님; 삭제 전 보존 필수 | 공통 검사가 직접 읽음 |
| `README.md` | AI-CORE | `docs/hubs/README.md` | 허브별 자산·실행 입구 목록 보존 | 없음 |
| `어디를보나.md` | 중복 | 기존 `registry/work-map.json` 소비 | Primary/Secondary Hub 표가 본체 `hub_routes`와 역할 중복 | D |
| `틀.mjs` | AI-CORE | `scripts/standards-find.mjs` | 등록 규격 검색·실재 경로·브랜치 확인; 템플릿 생성기는 아님 | 없음 |
| 모든 `.gitkeep` **12개** | 버림 후보 | 이관 없음 | 빈 디렉터리 유지용: capabilities 2, design 3, operations 2, quality 3, standards 2 | 없음 |
| `capabilities/README.md` | AI-CORE | `docs/hubs/engineering-assets.md` | 정적 함수 수집과 실제 실행 검증의 경계 설명 | 없음 |
| `capabilities/IMPROVEMENTS.md` | AI-CORE | `docs/episodes/` | 타입검사 누락·Python 인코딩 등 재현과 개선 노하우 | 없음 |
| `capabilities/packages/VERIFIED.json` | AI-CORE | `test/fixtures/format-preview/` | 패키지 원본 해시·검증 범위를 고정하는 증거 | 없음 |
| `capabilities/packages/fp4-format-preview.tgz` | AI-CORE | `test/fixtures/format-preview/` | `scripts/verify-portable-package.mjs`가 사용하는 패키지 검증 자산 | 없음 |
| `contracts/` **17개 전부** | AI-CORE | `contracts/hubs/` | 작업·계획·잠금·영수증·connector 계약; 실행기와 분리해서 유지 | D; 영수증 6개는 R; `integration-connector.schema.json`은 C |
| `design/README.md` | 중복 | 기존 `docs/UI_UX_START_HERE.md` | 토큰·컴포넌트·binding 정본을 본체로 위임 | 공통 검사가 직접 읽음 |
| `design/AI_DESIGNER_OPERATING_GUIDE.md` | AI-CORE | `docs/design/` | 독자·정보구조·브랜드·시안 승인 제작 방법론 | 없음 |
| `design/AI_EDITORIAL_LAYOUT_COMPILER.md` | AI-CORE | `docs/design/` | 페이지 계산·레이아웃·시각 검수 방법론 | 없음 |
| `design/components/CATALOG.md` | AI-CORE | `docs/design/` | 실제 portal 원자 예제와 사용 범위 안내 | D |
| `design/patterns/RESPONSIVE-SHELL.md` | AI-CORE | `docs/design/` | 적용 범위가 제한된 승인 반응형 패턴 | D |
| `docs/BASELINE.md` | 중복 | 기존 `docs/AI_WORKING_STANDARD.md` | `COMPATIBILITY POINTER`; 공통 규칙 승계 명시 | 공통 검사가 직접 읽음 |
| `docs/BOOTSTRAP.md` | 버림 후보 | 복구 이력 보존 | 9월 9일 비공개 저장소 최초 준비 기록 | 없음 |
| `docs/BROWSER-VERIFICATION.md` | AI-CORE | `docs/verification/` | 브라우저 검수 절차; 검증 기준의 소유자는 Core | 없음 |
| `docs/CURRENT-STANDARDS.md` | 중복 | 기존 `docs/UI_UX_START_HERE.md` 등 | `HISTORICAL EVIDENCE INDEX`; 현행 정본은 본체라고 명시 | 공통 검사가 직접 읽음 |
| `docs/DATA-HUB-EVIDENCE.md` | AI-CORE | `docs/hubs/` | 데이터 허브의 증거·검증 범위 | 없음 |
| `docs/DELIVERY-HUB-RUNTIME.md` | AI-CORE | `docs/hubs/` | `scripts/delivery-gate.mjs`의 배포 가능 판정 설명 | D |
| `docs/DESIGN-HUB-COMPILER.md` | AI-CORE | `docs/hubs/` | 디자인 작업을 계획·검증 요구로 변환하는 규격 | 없음 |
| `docs/DESIGN-HUB-EVIDENCE.md` | AI-CORE | `docs/hubs/` | 디자인 증거와 채택 경계 | 없음 |
| `docs/DESIGN-LOCK.md` | AI-CORE | `docs/hubs/` | 승인한 디자인과 revision 잠금 계약 | 없음 |
| `docs/DESIGN-VISUAL-QA.md` | AI-CORE | `docs/verification/` | 시각 검증 계획·capture manifest·영수증 관계 | 없음 |
| `docs/DOCUMENT-HUB-RUNTIME.md` | AI-CORE | `docs/hubs/` | 원본 binding·문서 계획·영수증 설명 | 없음 |
| `docs/ENGINEERING-HUB-RUNTIME.md` | AI-CORE | `docs/hubs/` | 자산 출처·소비자·승격 판정 | 없음 |
| `docs/FOLDER-CONSOLIDATION.md` | 버림 후보 | 복구 이력 보존 | 초기 한글 폴더 정리의 완료 기록 | 없음 |
| `docs/FOUR-AI-WORKFLOW.md` | 중복 | 기존 `docs/AI_WORKING_STANDARD.md` | `SUPERSEDED`; 현재 협업 정책 포인터 | 공통 검사가 직접 읽음 |
| `docs/HUB-ARCHITECTURE.md` | AI-CORE | `docs/hubs/` | 허브별 책임 경계 보존; 옛 물리 구조 설명은 수정 필요 | D |
| `docs/HUB-READINESS-BASELINE-2026-09-21.md` | 버림 후보 | 복구 이력 보존 | 날짜가 고정된 초기 점수 기준선 | D |
| `docs/HUB-READINESS.md` | AI-CORE | `docs/hubs/` | readiness 점수와 critical axis 해석 | 없음 |
| `docs/HUB-ROUTER-RUNTIME.md` | AI-CORE | `docs/hubs/` | 요청 라우팅·동점·불일치 HOLD 규칙 | 없음 |
| `docs/IMPROVEMENT-REPORT.md` | 버림 후보 | 복구 이력 보존 | 초기 조사 시점의 문제 목록; 현행 판정 아님 | 없음 |
| `docs/INTEGRATION-HUB-RUNTIME.md` | AI-CORE | `docs/hubs/` | connector 출처·권한 경계·승격 판정 | 없음 |
| `docs/PHASE1-SCOPE.md` | 버림 후보 | 복구 이력 보존 | 9월 9일의 1차 구축 범위 | 없음 |
| `docs/QUALITY-HUB-EVIDENCE.md` | AI-CORE | `docs/verification/` | 품질 증거와 사용 범위 | 없음 |
| `docs/QUALITY-RECEIPT.md` | AI-CORE | `docs/verification/` | 품질 영수증·결과 판정 규격 | D |
| `docs/README.md` | AI-CORE | `docs/hubs/README.md`에 병합 | 고유 허브 문서의 탐색 연결 보존 | 공통 검사가 직접 읽음 |
| `docs/SESSION-TOUR.md` | 중복 | 기존 `docs/AI_ACADEMY_CURRICULUM.md` | Academy→재사용→검증→인계 절차 반복 | 공통 검사가 직접 읽음 |
| `docs/STARTER-TEMPLATES.md` | AI-CORE | `docs/research/` | 미구현 후보와 템플릿 제작 원칙; 채택 표준으로 올리지 않음 | 없음 |
| `docs/baseline-sources.json` | 버림 후보 | 복구 이력 보존 | 옛 원본 경로·해시 스냅샷 | 없음 |
| `engine/README.md` | 버림 후보 | 이관 없음 | 미구현 Control Plane 및 옛 로컬 SSOT 경로 안내 | 없음 |
| `engine/자동커밋.mjs` | AI-OPS | `ai-ops/scripts/dev/` | 파일 지정·별도 인덱스·CAS 커밋·감시 실행기 | 없음 |
| `evidence/` **3개 전부** | AI-CORE | `test/fixtures/hubs/evidence/` | 원본 revision에 고정된 데이터·디자인·품질 검증 표본 | D |
| `hubs/README.md` | 중복 | 기존 `registry/hubs.json`·`registry/work-map.json` | 7허브 조직·라우팅 목록은 이미 본체 소유 | 없음 |
| `hubs/data/` **4개** | AI-CORE | README→`docs/hubs/`; JSON→`src/hubs/data/` | 데이터 패턴·소비자·복구 정책; 업무 데이터 원장 아님 | D |
| `hubs/delivery/` **2개** | AI-CORE | README→`docs/hubs/`; JSON→`src/hubs/delivery/` | 배포 권한·환경·소비자 판정 자료 | D |
| `hubs/design/README.md` | AI-CORE | `docs/hubs/design.md` | 현재 UI/UX 실행 입구로 본체가 고정 참조 | D·U |
| `hubs/design/feedback.json` | AI-CORE | `src/hubs/design/` | 디자인 채택·피드백 판단 자료 | D |
| `hubs/document/README.md` | AI-CORE | `docs/hubs/document.md` | 템플릿 정본과 소비·검증 허브의 경계 | D |
| `hubs/document/consumers.json` | AI-CORE | `src/hubs/document/` | 문서 소비자와 템플릿 연결 | D |
| `hubs/document/source-binding.json` | AI-CORE | `src/hubs/document/` | docshub revision·blob 고정 자료 | D; `test/management-support-transition.test.mjs:13` |
| `hubs/engineering/` **3개** | AI-CORE | README→`docs/hubs/`; JSON→`src/hubs/engineering/` | 공통 코드 자산·원본·소비자 등록 | D |
| `hubs/integration/README.md` | AI-CORE | `docs/hubs/integration.md` | 본체가 지정한 integration 정본 입구 | D·C |
| `hubs/integration/connectors.json` | AI-CORE | `src/hubs/integration/` | 연결 계약·출처·후보 상태; credential 저장소 아님 | D·C |
| `hubs/integration/consumers.json` | AI-CORE | `src/hubs/integration/` | connector 소비자 매핑 | D |
| `hubs/quality/README.md` | AI-CORE | `docs/hubs/quality.md` | 현재 UI/UX 품질 입구로 본체가 고정 참조 | D·U |
| `hubs/quality/`의 `consumers.json`, `patterns.json`, `retention.json` **3개** | AI-CORE | `src/hubs/quality/` | 품질 패턴·소비자·증거 보존 정책 | D |
| `hubs/readiness.json` | AI-CORE | `src/hubs/readiness.json` | 허브 성숙도 평가 항목·증거·미충족 상태 | D |
| `operations/README.md` | 중복 | 기존 `docs/AI_WORKING_STANDARD.md`·`registry/work-map.json` | 요청·범위·배정·인계 책임 안내; 자체 실행 구현 없음 | 없음 |
| `operations/inspection/POLICY.md` | AI-CORE | `docs/verification/` | 점검→시정→재검사 규칙 | 없음 |
| `operations/inspection/FIRST-PATROL.md` | 버림 후보 | 복구 이력 보존 | 9월 9일 특정 ERP revision 점검 기록 | 없음 |
| `operations/progress-handoff/`의 날짜 문서 **4개** | 버림 후보 | 복구 이력 보존 | 9월 9~10일 의견·인계·견학·API 수정 기록 | 없음 |
| `portal/.gitignore` | AI-CORE | `src/catalog-portal/` | portal 생성물 제외 설정; 유지할 소스와 함께 조정 | 없음 |
| `portal/.openai/hosting.json` | 버림 후보 | 이관 없음 | 옛 Sites project ID·출력 디렉터리 설정; 현행 배포 증거 없음 | 없음 |
| `portal/README.md` | AI-CORE | `docs/catalog-portal.md` | 정본/파생물·재생성·검증 한계 설명 | 없음 |
| `portal/app/` 중 `globals.css` 제외 **24개** | AI-CORE | `src/catalog-portal/app/` | 규격·원자·함수·학습·증거 탐색 UI와 모델; PC 업무 실행기가 아님 | 없음 |
| `portal/app/globals.css` | AI-CORE | `src/catalog-portal/app/` | portal 표시 소스이며 본체 CSS 기준선에 등록 | C:176 |
| `portal/build-static.mjs` | AI-CORE | `scripts/catalog-portal/` | pinned source 복원·타입검사·정적 카탈로그 생성 | 없음 |
| `portal/package.json` | AI-CORE | `src/catalog-portal/` | 실제 React·TypeScript 의존성과 build/dev/typecheck 명령 | T가 이 디렉터리에 `npm ci` |
| `portal/package-lock.json` | AI-CORE | `src/catalog-portal/` | 위 의존성의 고정 설치 입력 | T |
| `portal/public/catalog/` **4개 전부** | AI-CORE | `src/catalog-portal/public/catalog/` | 파생 자료지만 현재 UI·타입검사·빌드의 입력이므로 즉시 폐기 불가 | 없음 |
| `portal/tsconfig.json` | AI-CORE | `src/catalog-portal/` | portal 타입검사 입력 | T의 검증기에서 간접 소비 |
| `portal/tsconfig.gallery.json` | AI-CORE | `src/catalog-portal/` | 원자 갤러리 타입검사 입력 | T의 검증기에서 간접 소비 |
| `quality/README.md` | 중복 | `docs/hubs/quality.md`·`delivery.md`에 통합 | 자체 구현 없이 품질/배포 허브 backing 경로 안내 | 없음 |
| `quality/COMPLETION.md` | AI-CORE | `docs/catalog-portal/` | 과거 기록이지만 `portal/build-static.mjs:72`가 실제 배포 산출물로 복사 | 없음 |
| `quality/acceptance-v1.json` | AI-CORE | `test/fixtures/catalog-portal/` | `scripts/report-acceptance.mjs`가 읽는 수용 기준 | 없음 |
| `quality/card-evidence.json` | AI-CORE | `test/fixtures/catalog-portal/` | `scripts/card-audit.mjs`, `verify-card-evidence.mjs`의 증거 입력 | 없음 |
| `quality/acceptance-browser.json` | 버림 후보 | 복구 이력 보존·새 실행에서 재생성 | 시점별 브라우저 영수증; `report-acceptance.mjs`는 없으면 null 처리 | 없음 |
| `quality/acceptance-machine.json` | 버림 후보 | 복구 이력 보존·새 실행에서 재생성 | 시점별 기계 검사 영수증; 현재 PASS로 승계 불가 | 없음 |
| `quality/CATALOG-RECOVERY.md`, `DISCOVERY.md`, `EXPANSION.md`, `INSPECTION-CONTROL.md`, `LEARNING-HISTORY.md`, `SEARCH-RELIABILITY.md`, `SETTLEMENT-FUNCTION-REVIEW-2026-09-10.md` **7개** | 버림 후보 | 복구 이력 보존 | 특정 시점 구현·검증 기록; 현행 규격 아님 | 없음 |
| `quality/acceptance-claude-review.md`, `discovery-claude.md`, `expansion-claude.md`, `history-claude.md` **4개** | 버림 후보 | 복구 이력 보존 | 옛 독립 검토 원문; 현재 코드 승인으로 사용할 수 없음 | 없음 |
| `quality/discovery-review-inputs.json`, `expansion-review-inputs.json`, `history-review-inputs.json` **3개** | 버림 후보 | 복구 이력 보존 | 위 검토 당시 입력 스냅샷 | 없음 |
| `runs/README.md` | 버림 후보 | 이관 없음 | 실제 run 기록이 아닌 옛 저장 위치 안내 | 없음 |
| `scripts/acceptance-evidence.mjs` | AI-CORE | `src/verification/catalog/` | 소스 digest·필수 수용 검사 정의 | 없음 |
| `scripts/assess-learning.mjs` | AI-CORE | `src/learning/` | 학습·실습 평가 로직 | 없음 |
| `scripts/browser-capture.mjs` | AI-OPS | `ai-ops/scripts/pc/` | Chromium 프로세스를 띄워 실제 screenshot 생성 | D |
| `scripts/card-audit.mjs` | AI-CORE | `scripts/catalog/` | 규격 카드의 원본 해시·증거 검증 | 없음 |
| `scripts/collect-functions.mjs` | AI-CORE | `scripts/catalog/` | 함수 선언·출처·소비 관계 정적 수집 | 없음 |
| `scripts/collect-style-assets.py` | AI-CORE | `scripts/catalog/` | 디자인 자산 색인과 정제 | 없음 |
| `scripts/collect-toolbox.mjs` | AI-CORE | `scripts/catalog/` | 재사용 부품·패키지 메타데이터 수집 | 없음 |
| `scripts/data-hub.mjs` | AI-CORE | `src/hubs/data/` | 데이터 결과·패턴·복구·승격 판정; 운영 데이터 쓰기 아님 | D·E |
| `scripts/delivery-gate.mjs` | AI-CORE | `src/hubs/delivery/` | release·품질·rollback 조건 판정; 배포 실행기 아님 | D·E |
| `scripts/design-compiler.mjs` | AI-CORE | `src/hubs/design/` | 본체 binding으로 작업을 디자인 계획으로 변환 | D |
| `scripts/design-feedback.mjs` | AI-CORE | `src/hubs/design/` | 채택 영수증·피드백 검증 | D·E |
| `scripts/design-lock.mjs` | AI-CORE | `src/hubs/design/` | 디자인 승인·원본 잠금 검증 | D |
| `scripts/design-visual-qa.mjs` | AI-CORE | `src/hubs/design/` | capture 계획·manifest·시각 영수증 판정 | D·E |
| `scripts/document-hub.mjs` | AI-CORE | `src/hubs/document/` | 원본 Git blob 확인·템플릿 목록·render **계획**·영수증; 실제 렌더러 아님 | D·E |
| `scripts/engineering-hub.mjs` | AI-CORE | `src/hubs/engineering/` | 자산 출처·소비자·승격 증거 검증 | D |
| `scripts/function-python-index.py` | AI-CORE | `scripts/catalog/` | Python AST 기반 함수 색인 | 없음 |
| `scripts/hub-readiness.mjs` | AI-CORE | `src/hubs/` | 성숙도 점수·critical axis 평가 | D |
| `scripts/hub-router.mjs` | AI-CORE | `src/routing/` | 본체 `registry/hubs.json`, `work-map.json`을 읽어 허브 판정 | D |
| `scripts/inspect-project.mjs` | AI-CORE | `scripts/verification/` | 프로젝트 revision·규칙·검사 증거 점검 | 없음 |
| `scripts/integration-hub.mjs` | AI-CORE | `src/hubs/integration/` | connector 출처·요청·권한·승격 판정 | D |
| `scripts/quality-receipt.mjs` | AI-CORE | `src/hubs/quality/` | 허브별 검사 결과·품질 영수증 검증 | D·E |
| `scripts/report-acceptance.mjs` | AI-CORE | `scripts/verification/` | 수용 기준과 실행 영수증을 합쳐 검증 상태 산출 | 없음 |
| `scripts/scan-standards.py` | AI-CORE | `scripts/catalog/` | 규격 문서·코드 색인과 출처 수집 | 없음 |
| `scripts/typecheck-gate.mjs` | AI-CORE | `scripts/verification/` | pinned portal 원본 복원·TypeScript 검사 | T의 검증기에서 간접 소비 |
| `scripts/validate-hubs.mjs` | AI-CORE | `scripts/verification/` | 허브 등록부·라우팅 규칙 검증 | D |
| `scripts/verify-acceptance.mjs` | AI-CORE | `test/catalog-portal/` | 수용 검사 묶음·소스 안정성 확인 | 없음 |
| `scripts/verify-browser.cjs` | AI-CORE | `test/catalog-portal/` | portal UI·오류·브라우저 회귀검사; 업무 실행 도구 아님 | 없음 |
| `scripts/verify-button-recipes.cjs` | AI-CORE | `test/catalog-portal/` | 버튼 사용 예제 검증 | 없음 |
| `scripts/verify-card-evidence.mjs` | AI-CORE | `test/catalog-portal/` | 카드 증거 신선도·원본 대조 회귀검사 | 없음 |
| `scripts/verify-catalog-input.mjs` | AI-CORE | `test/catalog-portal/` | 카탈로그 입력·해시 검증 | 없음 |
| `scripts/verify-design-tools.mjs` | AI-CORE | `test/catalog-portal/` | 디자인 도구 모델 검증 | 없음 |
| `scripts/verify-discovery.mjs` | AI-CORE | `test/catalog-portal/` | 기술 학습 탐색 모델 검증 | 없음 |
| `scripts/verify-function-collector.mjs` | AI-CORE | `test/catalog/` | 함수 수집기·경로 경계·한글 인코딩 검증 | 없음 |
| `scripts/verify-function-examples.mjs` | AI-CORE | `test/catalog/` | 수집 함수 예제의 실제 동작 검증 | 없음 |
| `scripts/verify-inspection.mjs` | AI-CORE | `test/verification/` | 프로젝트 점검기 회귀검사 | 없음 |
| `scripts/verify-learning.mjs` | AI-CORE | `test/catalog-portal/` | 학습 이력·평가 모델 검증 | 없음 |
| `scripts/verify-portable-package.mjs` | AI-CORE | `test/catalog/` | tgz의 독립 JS/TS 소비 검증 | 없음 |
| `scripts/verify-reuse.cjs` | AI-CORE | `test/catalog-portal/` | 재사용 UI 흐름 검증 | 없음 |
| `scripts/verify-toolbox.mjs` | AI-CORE | `test/catalog/` | toolbox 수집·안전한 메타데이터 검증 | 없음 |
| `scripts/verify-typecheck-gate.mjs` | AI-CORE | `test/verification/` | 잘못된 타입을 실제로 차단하는지 검증 | T가 직접 실행 |
| `ssot/PART.md` | 중복 | 기존 `docs/AI_WORKING_STANDARD.md` | `LEGACY PART RECORD / CURRENT POINTER`; 정본·HOLD 원칙 위임 | D; 공통 검사가 직접 읽음 |
| `standards/README.md` | 중복 | 기존 `docs/AI_ACADEMY_CURRICULUM.md` | 별도 규격 정본이 아니라고 명시 | 공통 검사가 직접 읽음 |
| `standards/backend/FREEPASS-ADMIN-PILOT.md` | AI-CORE | `docs/research/` | 두 번째 프로젝트 검증이 필요한 backend 후보 노하우 | 없음 |
| `standards/cards.json` | AI-CORE | `src/learning/` | 원문 해시·범위가 있는 학습 카드; 새 권한 정본 아님 | 없음 |
| `test/browser-capture.test.mjs` | AI-OPS | `ai-ops/test/` | 이동하는 capture 실행기의 계약·동작 검사 | T |
| `test/`의 나머지 **12개** | AI-CORE | `test/hubs/` | data/delivery/design/document/engineering/readiness/router/integration/quality 판정 회귀검사 | T |

**필수 확인 결과**

1. **`test:devcenter`와 portal의 실제 연결**

   `package.json:10–11`은 루트 테스트 뒤에 다음을 실행하도록 되어 있다.

   ```text
   npm --prefix devcenter/portal ci --ignore-scripts
   → node devcenter/scripts/verify-typecheck-gate.mjs
   → node --test devcenter/test/*.test.mjs
   ```

   `scripts/typecheck-gate.mjs`는 `portal/node_modules/typescript/lib/typescript.js`를 직접 import한다. `portal/build-static.mjs`는 `app/center.tsx`, `app/specimen/page.tsx`, CSS, 카탈로그와 품질 자료를 읽는다. 따라서 **portal은 현재 테스트·빌드 소비 관계가 있는 소스**다.

   다만 현재 로컬에는 `portal/node_modules`, `portal/static`, `portal/public/catalog/functions.json`, `toolbox.json`이 모두 없다. **실행·게시 상태는 미확인**이며, 설치와 네트워크 확인은 **`BLOCKED_NETWORK`**로 실행하지 않았다. `.github/workflows`에서는 `devcenter`·`portal` 직접 문자열을 찾지 못했다.

2. **밖에서 끌어쓰는 파일과 등록부 참조**

   `rg`로 확인한 실행·검사상 핵심 연결은 다음이다.

   - `test/core-hub-receipt.test.mjs`: `data-receipt`, `delivery-receipt`, `design-adoption-receipt`, `design-visual-receipt`, `document-receipt`, `quality-receipt` 스키마 **6개를 동적으로 읽음**.
   - `test/management-support-transition.test.mjs`: `hubs/document/source-binding.json` 읽음.
   - `registry/canonical-development-lines.json`: integration README·schema·connectors와 portal `globals.css`.
   - `registry/ui-ux-entrypoint.json`, `src/engine/ui-ux-entrypoint.mjs`: design·quality README 경로 고정.
   - `src/engine/core-hub-receipt.mjs`: 표의 E 6개에 대한 명령 참조 문자열 생성.
   - `registry/devcenter-datasets.json`: 표의 D 항목을 개별 locator로 보유.
   - `registry/hubs.json`: `devcenter/design` 대표 자산 경로. `registry/work-map.json`, `registry/lanes.json`: 디렉터리 범위·lane 연결.
   - `registry/sunset.json`, `registry/sunset-devcenter-absorption.json`, 관련 sunset/physical-copy 테스트: 은퇴·보존·전수 목록 검사.

   `test/shared-extraction-candidate.test.mjs`의 `devcenter/capabilities/shared/krw-display`, `test/sunset-progress.test.mjs`의 `devcenter/z.mjs`는 **검사용 문자열**이다. 실제 파일 소비로 세지 않았다. `src/governance/sunset.mjs`의 일치도 주석이다. `scripts/`에서는 `devcenter/` 직접 문자열 일치가 없었다.

3. **이미 본체에 있는 기능과 부분 중복**

   중복 12개는 표에 대응 정본을 적었다. 다음은 **일부만 겹치므로 통째로 버리면 안 되는 것**이다.

   | 후보 | 이미 있는 곳 | 판정 |
   |---|---|---|
   | 허브별 영수증 코드·스키마 | `src/engine/core-hub-receipt.mjs`, `contracts/core-receipt.schema.json` | 공통 봉투만 본체에 있음. 허브별 payload·검증은 추가 기능 |
   | 허브 라우터 | `registry/hubs.json`, `registry/work-map.json#hub_routes` | 조직·규칙은 이미 승격됨. `devcenter/scripts/hub-router.mjs`의 판정 구현은 보존 |
   | 디자인 compiler | `registry/design-hub-binding.json`, `design-system/` | 값·binding은 본체 소유. compiler는 이를 소비하는 별도 기능 |
   | 규격·함수 검색 | `src/reuse/reuse-preflight.mjs` | 재사용 사전판정과 함수 AST 색인·portal 탐색은 범위가 다름 |
   | 자동커밋 | `ai-ops/scripts/dev/commit-checked.ps1` | 파일 지정 커밋은 겹침. 별도 인덱스·CAS·감시 방식은 다르므로 통합 검토 |
   | browser capture | `ai-ops/scripts/pc/browser.mjs:118` | screenshot 기능은 이미 있음. visual-plan→manifest adapter는 추가 기능 |

4. **공개 저장소에 옮기기 전 정리할 내용**

   `src/security/secret-scan.mjs`로 추적 222개를 검사했고, tgz도 **메모리에서 풀어 내부 5개 파일을 추가 검사**했다. 해당 검사기의 비밀·주민번호 탐지는 **0건**이었다. 추가 전화번호 패턴도 0건이며, 이메일 패턴 1건은 `hubs/readiness.json:208`의 코드 출처 표기 `docshub@app.js/index.html/styles.css`였다. 이 결과가 모든 개인정보의 부재를 보증하지는 않는다.

   **Windows 절대경로가 있는 파일**은 다음과 같다. `C:/dev` 계열은 원본 위치나 예제이고, browser capture는 설치 경로 후보다. 이 PC에서 실제 사용 가능한 경로라는 뜻은 아니다.

   | 위치 | 파일 |
   |---|---|
   | 루트·패키지 | `README.md`, `틀.mjs`, `capabilities/packages/VERIFIED.json`, `fp4-format-preview.tgz` 내부 `package/PROVENANCE.json` |
   | 문서 | `docs/BROWSER-VERIFICATION.md`, `DESIGN-HUB-COMPILER.md`, `DESIGN-VISUAL-QA.md`, `DOCUMENT-HUB-RUNTIME.md`, `IMPROVEMENT-REPORT.md`, `STARTER-TEMPLATES.md`, `baseline-sources.json` |
   | 허브·운영 | `engine/README.md`, `hubs/document/README.md`, `operations/inspection/FIRST-PATROL.md`, `operations/progress-handoff/2026-09-09-PM-의견-SSOT고도화.md`, `2026-09-09-PM-인계.md` |
   | portal | `portal/README.md`, `app/discovery.tsx`, `app/evidence.tsx`, `public/catalog/atomic-audit.json`, `index.json`, `styles.json` |
   | 품질 | `quality/CATALOG-RECOVERY.md`, `DISCOVERY.md`, `EXPANSION.md`, `LEARNING-HISTORY.md`, `SEARCH-RELIABILITY.md`, `SETTLEMENT-FUNCTION-REVIEW-2026-09-10.md`, `acceptance-claude-review.md`, `card-evidence.json` |
   | 스크립트 | `scripts/browser-capture.mjs`, `collect-functions.mjs`, `collect-style-assets.py`, `scan-standards.py` |

   `portal/.openai/hosting.json`에는 **hosting project ID**도 있다. 인증키로 판정하지 않았으며, 새 위치에 승계할 배포 설정으로도 확정하지 않았다.

Claude 독립 검토·원격 배포 확인은 **`BLOCKED_NETWORK`**다. 테스트와 빌드는 실행하지 않았다. 시작·종료 시 Git 상태는 동일했고, 기존 미추적 duo 파일 2개도 그대로 보존했다.

**옮기는 순서 제안**

1. `contracts/`와 `source-binding.json`, integration 등록 자료부터 옮기고 R·C·U 소비 경로를 함께 변경한다.
2. 허브 판정 구현·자료·테스트를 Core로 옮기며 `core-hub-receipt.mjs`의 E 경로를 갱신한다.
3. capture 실행기·테스트와 자동커밋 고유 기능을 Ops 기존 도구에 통합하고 Core 계약을 소비하게 한다.
4. portal·수집기·검증 입력을 함께 옮긴 뒤 누락 카탈로그·의존성을 준비하고 `test:devcenter`를 새 경로로 검증한다.
5. 복구 태그 검증 후 중복·옛 기록·공통 계보 검사·lane 참조를 정리하고, 외부 의존 0을 재확인한 다음 `devcenter/`를 삭제한다.

