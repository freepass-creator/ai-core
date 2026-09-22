# Design Hub Browser Capture & Visual QA v1

## 목적

Design Compiler가 만든 `Design Plan`을 **실제 브라우저 화면 증거**와 연결한다.

중요한 원칙은 세 단계가 서로 다른 주장이라는 것이다.

1. **Compile** — feature/state/QA 계약이 유효함
2. **Capture** — 특정 URL을 특정 viewport에서 screenshot으로 캡처함
3. **Visual Review** — 그 screenshot을 실제로 검토해 디자인 규격 적합 여부를 판정함

Screenshot 파일이 있다는 사실만으로 Visual QA PASS가 되지 않는다.

## 구조

```text
Design Plan
  ↓
Visual Job
  ↓
Visual Plan
  ↓
Browser Capture Adapter
  ↓
Capture Manifest + screenshot hashes
  ↓
AI/Human Visual Review
  ↓
Design Visual Receipt
  ↓
Quality Receipt
```

## 정본

- Visual Job: `contracts/design-visual-job.schema.json`
- Visual Plan: `contracts/design-visual-plan.schema.json`
- Capture Manifest: `contracts/browser-capture-manifest.schema.json`
- Visual Receipt: `contracts/design-visual-receipt.schema.json`
- Planner/reviewer runtime: `scripts/design-visual-qa.mjs`
- Built-in browser adapter: `scripts/browser-capture.mjs`

## Browser Adapter

기본 adapter는 Chromium CLI다. 다른 브라우저/agent-browser를 사용해도 **같은 Capture Manifest 계약**을 출력하면 된다.

Chromium 경로가 자동 탐지되지 않으면:

```powershell
$env:DESIGN_CHROMIUM_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

Sandbox 우회는 기본값이 아니며 격리된 환경에서 명시적으로 필요한 경우에만 `DESIGN_CHROMIUM_NO_SANDBOX=1`을 사용한다.

보안상 capture URL은 `http/https`만 허용한다. 임의 `file://` 읽기를 브라우저 adapter 기본 기능으로 제공하지 않는다.

## 실행

```powershell
node scripts/design-visual-qa.mjs plan design-plan.json visual-job.json visual-plan.json
node scripts/browser-capture.mjs capture visual-plan.json artifacts/visual capture-manifest.json
node scripts/design-visual-qa.mjs validate-captures visual-plan.json capture-manifest.json
```

그 다음 screenshot을 실제로 검토하여 case별 PASS/HOLD/FAIL을 작성하고 Visual Receipt를 만든다. Visual Receipt는 Design Lock 승인과 별개다.

## 아직 남은 것

현재 builtin adapter는 screenshot capture baseline이다. 다음 고도화에서 다음을 붙인다.

- controlled DOM assertions
- keyboard/focus interaction capture
- 200%/400% zoom/reflow
- reduced-motion / forced-colors
- locale/RTL runtime switch verification
- screenshot visual-diff baseline
- 실제 FreePass Admin/Sales/견적기 revision의 첫 Quality Receipt

이 항목들이 실행 증거로 확보되기 전에는 Design Hub runtime/validation을 VERIFIED로 승격하지 않는다.
