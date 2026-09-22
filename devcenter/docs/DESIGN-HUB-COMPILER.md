# Design Hub Compiler v1

## 목적

“디자인 통일”을 추상 지시로 끝내지 않고, **AI Core UI/UX revision에 고정된 실행 가능한 Design Plan**으로 바꾼다.

Design Hub는 AI Core의 token/component/pattern 값을 복제하지 않는다. 루트 `registry/design-hub-binding.json`이 canonical source bundle digest를 고정하고, compiler가 같은 AI Core 저장소의 **현재 정본 파일을 직접 읽어 digest를 대조한다**.

## 실행 전 preflight

Design Job을 만들기 전에 pinned AI Core revision에서 다음을 먼저 확인한다.

- `docs/UI_UX_START_HERE.md`
- `registry/ui-ux-entrypoint.json`
- 대상 제품 profile
- 실제 brand/CI SSOT

FreePass 계열 Design Job은 `product_profile.ui_profile_ref = "FREEPASS"`가 아니면 compile 전에 실패한다.

## 흐름

```text
AI Core UI/UX entry preflight
  ↓
Design Job
  ↓
AI Core revision/blob verification
  ↓
feature_id validation
  ↓
component/pattern runtime mapping
  ↓
required states + QA probe expansion
  ↓
Design Plan
  ↓
Quality Draft
  ↓
browser renderer / Visual QA (next runtime layer)
  ↓
Quality Receipt
```

## 정본

- AI Core binding: `registry/design-hub-binding.json`
- Job contract: `contracts/design-job.schema.json`
- Plan contract: `contracts/design-plan.schema.json`
- Compiler: `scripts/design-compiler.mjs`
- Regression definitions: `test/design-compiler.test.mjs`

## 핵심 경계

### 복제 금지
Design Job에 token 값 자체를 넣어 별도 정본을 만드는 방식을 금지한다. 브랜드/프로젝트 특화 값도 `brand_profile_ref`로 참조한다.

### exact revision
대상 프로젝트도 40-char revision을 사용하고 AI Core도 binding에 exact revision을 고정한다.

### runtime mapping
요청 feature가 AI Core에 존재해도 `CONTRACT_ONLY`면 실제 렌더 구현이 있다는 뜻이 아니다.

`require_runtime_implementation=true`일 때:
- `RUNTIME_V2`, `BASE_COMPAT` → 실행 후보
- `CONTRACT_ONLY`, `UNMAPPED` → HOLD

### Visual QA
Compiler가 QA probe와 required state를 자동 확장하지만 **screenshot을 보지 않았는데 Visual QA PASS라고 하지 않는다.**

`require_visual_receipt=true`면 Quality Draft의 `DESIGN.VISUAL_QA`는 브라우저 증거가 생길 때까지 HOLD다.

## 실행

AI Core가 DevCenter의 형제 폴더일 때:

```powershell
node scripts/design-compiler.mjs compile design-job.json design-plan.json
```

다른 위치면:

```powershell
$env:AI_CORE_PATH="C:\dev\ai-core"
node scripts/design-compiler.mjs compile design-job.json design-plan.json
```

## 다음 구현

v1은 **Contract-bound compiler**다. 다음 layer는 Design Plan을 받아 실제 브라우저 surface를 렌더하고 360/390/412/1280/1440, locale, zoom/reflow, keyboard/touch 상태를 캡처하는 renderer/visual receipt runtime이다.
