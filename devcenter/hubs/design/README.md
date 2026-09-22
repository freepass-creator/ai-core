# Design Hub

Development Center의 디자인 실행 허브.

## 관장
- UI/UX
- Design Token
- Component
- Pattern
- Screen/Page Spec
- Responsive / Accessibility 표현
- 브랜드 적용
- Approved/Rejected Design DNA
- Render / Visual QA

## 현재 backing source
- `../../design/`
- AI Core UI/UX Constitution / Feature Registry / Design System Contract
- 각 프로젝트의 검증된 디자인 자산

## 경계
AI Core는 공통 UI/UX 헌법과 Contract를 소유한다. Design Hub는 이를 실제 프로젝트에 적용·재사용·검증하는 공식 운영 진입점이다. 동일 토큰 값을 별도 정본으로 복제하지 않는다.

“디자인 통일” 요청의 Primary Hub는 여기다.

## Mandatory UI/UX entry preflight

프로젝트 UI/UX 작업은 바로 시안을 만들지 않는다.

1. AI Core 루트 `registry/design-hub-binding.json`의 canonical source bundle digest 확인
2. 해당 revision의 `docs/UI_UX_START_HERE.md` 확인
3. `registry/ui-ux-entrypoint.json`의 read order와 fail-closed rules 확인
4. 대상 화면 feature ID 확정
5. 대상 제품 UI profile 확정
   - FreePass 계열은 반드시 `FREEPASS` → `docs/FREEPASS_PRODUCT_UI_PROFILE.md`
6. 실제 brand/CI SSOT 확인
7. 그 다음 Design Job compile

binding이 작업자가 의도한 AI Core revision과 다르면 **HOLD**한다.
브랜드 또는 제품 프로필을 못 찾으면 임의 디자인하지 않고 **HOLD**한다.

## Compiler Runtime

Design Hub는 AI Core UI/UX 값을 복제하지 않고 pinned binding으로 읽는다.

- AI Core binding: `../../../registry/design-hub-binding.json`
- Design Job: `../../contracts/design-job.schema.json`
- Design Plan: `../../contracts/design-plan.schema.json`
- Compiler: `../../scripts/design-compiler.mjs`
- Compiler tests: `../../test/design-compiler.test.mjs`
- Guide: `../../docs/DESIGN-HUB-COMPILER.md`

요청 feature가 `CONTRACT_ONLY`인데 실행 가능한 runtime을 요구하면 compiler는 **HOLD**한다. screenshot/visual evidence 없이 Visual QA PASS를 만들지 않는다.

## Design Lock / Recovery

승인된 디자인의 last-known-good 기준:

- Contract: `../../contracts/design-lock.schema.json`
- Runtime: `../../scripts/design-lock.mjs`
- Guide: `../../docs/DESIGN-LOCK.md`

명시적 승인 증거 없는 시안은 Design Lock으로 만들 수 없다.

## Browser Capture / Visual QA

Design Plan 이후의 실제 화면 증거 계층:

- Visual Job: `../../contracts/design-visual-job.schema.json`
- Visual Plan: `../../contracts/design-visual-plan.schema.json`
- Capture Manifest: `../../contracts/browser-capture-manifest.schema.json`
- Design Visual Receipt: `../../contracts/design-visual-receipt.schema.json`
- Planner/Reviewer: `../../scripts/design-visual-qa.mjs`
- Built-in Chromium adapter: `../../scripts/browser-capture.mjs`
- Guide: `../../docs/DESIGN-VISUAL-QA.md`

Capture 성공과 Visual QA PASS를 동일하게 취급하지 않는다. screenshot hash가 있는 Capture Manifest 뒤에 AI/Human Visual Review가 별도로 완료돼야 Design Visual Receipt가 생긴다.


## Source Adoption Evidence

- Adoption receipt: `../../evidence/design/freepass-admin-approved-shell.json`
- Feedback decisions: `feedback.json`
- Receipt contract: `../../contracts/design-adoption-receipt.schema.json`
- Feedback runtime: `../../scripts/design-feedback.mjs`
- Guide: `../../docs/DESIGN-HUB-EVIDENCE.md`

프로젝트 피드백은 ADOPT / HOLD_LOCAL / REJECT로 분리한다. 제품 전용 취향을 전사 Design Hub 규칙으로 자동 승격하지 않는다.
