# Global Product Standard Evidence Pack — 2026-09-19

상태: **INPUT_TO_CANONICAL / NOT_CANONICAL**

목적:
- 다른 세션에서 만드는 AI Core 공통 표준 정본에 **외부 표준 근거 + 내부 실전 근거 + 권장 회사값**을 공급한다.
- 이 문서 자체가 정본을 대체하지 않는다.
- 숫자·행동·상태를 “취향”이 아니라 **근거 등급**과 함께 선택하게 한다.

## 1. 표준을 4층으로 나눈다

### L0 — Normative floor
법·접근성·웹 표준처럼 제품이 임의로 낮출 수 없는 최저선.

예:
- WCAG 2.2 AA
- native HTML semantics
- WAI-ARIA/APG widget semantics/keyboard model
- 보안상 server-side validation

### L1 — Platform consensus
Apple / Material / Carbon 등 여러 성숙한 디자인 시스템에서 반복되는 값.

예:
- touch target 44~48
- compact control 40
- 8 단위 중심 spacing
- focus / pressed / disabled / loading 상태 구분

### L2 — Company standard
L0/L1 + 우리 프로젝트의 실제 검증을 결합해 AI Core가 고정할 값.

예:
- touch effective target 44 minimum
- frequent one-hand quick action 48 preferred
- desktop compact control visual 40
- task action 44
- FreePass common spacing 4/8/12/16/24/32/48

### L3 — Product profile / exception
업무밀도·브랜드·플랫폼 특성 때문에 제품별로 달라지는 값.

예:
- radius
- brand color
- 공개 상품 카드 density
- 내부 ERP table density
- 허용 파일형식/파일크기

**L3가 L0를 낮출 수는 없다.**

---

## 2. 근거 등급

| 등급 | 의미 | 정본 승격 |
|---|---|---|
| NORMATIVE | W3C/WCAG 등 준수 기준 | 즉시 floor |
| PLATFORM_CONSENSUS | 2개 이상 성숙 플랫폼에서 반복 | 회사값 후보 |
| CROSS_PROJECT_VERIFIED | 우리 2개 이상 실제 프로젝트에서 검증 | 공통 승격 가능 |
| PROJECT_VERIFIED | 한 프로젝트에서만 검증 | profile/candidate |
| PROPOSED | 조사상 타당하지만 미검증 | 정본 금지 |

표준값에는 반드시 `evidence_level`과 source pointer가 붙는다.

---

## 3. Control / Touch Target

### 외부 근거

- WCAG 2.2 AA target-size 최저선: **24×24 CSS px** 또는 규정된 spacing 예외.
- Apple HIG 일반 hit region: **44×44 pt 이상**.
- Material: touch target **48×48 dp**, 보통 8dp 이상 간격 권장.
- Carbon: software product에서 Medium 40 / Large 48이 반복적으로 사용됨.

### 우리 회사값

| 용도 | 값 | 판정 |
|---|---:|---|
| WCAG compliance floor | 24×24 | NORMATIVE FLOOR, 디자인 기본값으로 쓰지 않음 |
| Desktop compact visual control | 40px | COMPANY STANDARD |
| Task action / 일반 touch effective target | **44×44px min** | COMPANY STANDARD |
| 반복 한손 quick action | **48×48px preferred hit area** | COMPANY STANDARD |
| icon visual | 20~24px | COMPANY STANDARD, hit area와 분리 |
| Mobile list interactive row | **64px min** | CROSS_PROJECT CANDIDATE (Sales 근거), 글로벌 floor 아님 |

원칙:
- **보이는 크기와 hit area를 분리할 수 있다.**
- 24px 아이콘도 44/48 hit box 안에 둔다.
- 40px 데스크톱 컨트롤을 touch-capable surface에서 쓸 때 effective hit target은 44 이상 확보한다.
- 작은 아이콘을 촘촘하게 나열해 24px WCAG 예외에 의존하지 않는다.

---

## 4. Spacing

### 회사 spacing scale

`4 / 8 / 12 / 16 / 24 / 32 / 48`

판정:
- 현재 AI Core tokens와 일치.
- Material의 8dp 중심 rhythm과 양립.
- 4px은 micro adjustment, 8px은 primary rhythm.

규칙:
- 새 화면에서 임의 13/17/21px spacing을 만들지 않는다.
- 예외는 Product Profile에 이유와 사용처를 등록한다.

---

## 5. Typography

회사 기본 역할:

| 역할 | 기본 |
|---|---:|
| compact/meta | 12~14 |
| body compact | 14 |
| body/input default | 16 |
| page/list title baseline | 18 |
| section/large title | 20+ profile |

규칙:
- 숫자·금액·날짜 비교면 tabular numeral 사용 가능.
- 숫자/금액 비교열은 우측정렬.
- 입력 placeholder를 label 대신 사용하지 않는다.
- brand typography는 Product Profile 소유.

절대값은 WCAG 규범이 아니라 회사 UI profile 값으로 관리한다.

---

## 6. Color / Contrast / Focus

### Normative floor
- 일반 text contrast: **4.5:1**
- large text: **3:1**
- UI component/state indicator: **3:1**
- color alone으로 상태 의미 전달 금지
- focus는 보이고 sticky header/footer 등에 완전히 가려지면 안 됨

### 회사값
- `:focus-visible` 기본 ring: 현재 AI Core **3px** + offset 2px 유지 후보
- selected / focus / pressed를 서로 다른 상태로 표현
- success / warning / destructive를 selection color와 섞지 않는다

브랜드 색은 공통 정본이 아니라 Product Profile.

---

## 7. Button / Action Hierarchy

회사 공통:
- 한 section의 primary action은 원칙적으로 1개.
- secondary는 시각적으로 낮은 위계.
- destructive는 별도 danger semantics + confirmation boundary.
- custom button은 default / hover / focus-visible / active / disabled / busy 상태 보유.
- external app launch와 business completion을 동일 상태로 쓰지 않는다.

FreePass profile:
- **Top informational / Bottom actionable**
- task CTA는 ActionBar/footer.
- 단일선택 auto-advance step에서는 redundant Next를 숨긴다.

Top/Bottom 규칙은 글로벌 normative가 아니라 CROSS_PROJECT 회사 패턴이다.

---

## 8. Navigation Depth

공통 후보:
- mobile depth 0: global navigation
- depth 1/2: local task context + local ActionBar
- desktop panel을 단순 세로쌓아 모바일로 만들지 않는다.
- current location은 semantics로 노출.
- Back은 선택값/draft/scroll continuity를 보존.

다른 표준 세션에서 만드는 depth contract의 근거 입력으로 사용한다.

---

## 9. Dialog / Modal

WAI-ARIA APG 기반:
- open 시 focus는 dialog 내부로 이동
- Tab / Shift+Tab은 modal 내부에서 순환
- Escape로 닫기
- 닫으면 원칙적으로 invoker에 focus 복귀
- destructive final step은 least-destructive action initial focus 검토
- dialog header는 제목/정보, task action은 footer

회사 표준:
- Dialog를 page replacement로 남용하지 않는다.
- 긴 multi-step work는 page/flow 우선.

---

## 10. Tabs

APG 기반:
- Tab으로 tablist에 진입
- Arrow/Home/End로 tab 내부 이동
- selected state와 focus state 분리

회사 표준:
- panel 전환이 즉시(local DOM)면 auto activation 허용.
- network request / 큰 latency / page refresh가 걸리면 **manual activation(Enter/Space)** 우선.
- tab 이동 자체가 저장/외부 side effect를 발생시키지 않는다.

---

## 11. Select / Combobox

- 짧은 single choice는 native `select` 우선.
- 검색/자동완성 필요 시 APG combobox.
- label은 항상 visible.
- required selection은 explicit unselected state.
- popup의 focus/keyboard contract를 임의 구현하지 않는다.
- provider raw label/value를 UI가 직접 소유하지 않고 canonical option contract를 사용한다.

---

## 12. Search / Filter

회사 표준 후보:
- search open/close가 현재 work context를 파괴하지 않는다.
- query/filter/sort/list/card는 동일 state revision 사용.
- same semantic axis 내부 OR, axis 간 AND 같은 규칙은 Domain Query Contract에서 선언.
- close/Escape 시 기존 scroll/draft/context 복원.
- result count와 실제 result는 같은 query engine 사용.

Sales/ERP4 cross-project evidence를 근거로 승격 후보.

---

## 13. Table / Data List

공통:
- relational row/column이면 table semantics 사용.
- visual alignment만 필요하면 CSS layout.
- narrow width에서는 글자를 과도하게 축소하지 말고 horizontal scroll / responsive projection.
- sort/selection state는 semantics 제공.
- loading / empty / error / populated 별도 정의.
- stable row identity 필수.
- 큰 dataset은 pagination/virtualization 정책 명시.

회사 density:
- compact desktop control/row: 40 후보
- standard desktop: 48 후보
- mobile tappable business list: 64 후보

40/48/64는 역할 token으로 관리하고 페이지별 임의값 금지.

---

## 14. File Upload — 공통 규격 후보

### UX

- **파일 선택 버튼은 항상 제공.**
- drag/drop은 optional enhancement.
- drag-only upload 금지.
- button/drop-zone과 uploaded file row는 같은 size family 사용.
- desktop medium: **40px**
- touch/mobile or roomy form: **48px**
- selected files는 세로 stack.
- 파일별 상태를 독립 표시.

상태:
`SELECTED → VALIDATING → UPLOADING → SUCCEEDED | FAILED | CANCELLED`

추가:
- progress가 있으면 programmatic status 제공.
- 실패는 파일별 retry 가능.
- 전체 form 실패가 다른 성공 파일을 거짓 실패로 만들지 않음.
- 업로드 중 화면이동 정책(draft/pending/background)을 명시.

### Accessibility

- drag/drop 기능에는 click/tap single-pointer alternative 필수.
- keyboard만으로 파일 선택/삭제/retry 가능.
- icon-only remove에는 accessible name.
- success/error/progress status를 live semantics로 전달.

### Security / Data Contract

- `accept`는 picker hint일 뿐 security validation 아님.
- server에서 allowlist extension 검증.
- MIME header는 신뢰하지 않고 보조 신호로만 사용.
- 필요 시 file signature 검증.
- max file size는 **global 숫자로 고정하지 않고 domain profile**에서 선언.
- storage filename은 user filename 그대로 사용하지 않고 generated stable id/UUID 사용.
- original filename은 metadata로 별도 보존 가능.
- webroot 밖/분리 storage + 권한 경계 우선.
- ZIP/압축 파일은 unzip 전 size/path/compression 검증.

**파일형식과 max size는 업무마다 다르므로 전사 공통 숫자를 만들지 않는 것이 표준이다.**

---

## 15. Drag / Reorder / Slider

WCAG 2.2:
- dragging movement가 있으면 single-pointer non-drag alternative 필요.

회사 표준:
- reorder는 drag + up/down 또는 move menu 제공.
- slider는 tap/number input 등 대체 입력 제공.
- swipe-only navigation 금지.
- drag는 convenience이지 유일한 execution path가 아니다.

---

## 16. Feedback / Status

공통 상태:
`IDLE / LOADING / EMPTY / ERROR / POPULATED`

write/action:
`READY / BUSY / SUCCEEDED / FAILED / RETRYABLE`

외부 실행:
`REQUESTED / LAUNCHED / SERVER_COMMITTED / BUSINESS_CONFIRMED`

접근성:
- 일반 진행/성공: polite status
- blocking error: alert 또는 명확한 inline association
- toast만으로 critical information을 소멸시키지 않는다.

Sales runtime learning과 WCAG Status Messages를 합친 회사 후보.

---

## 17. Async Save / Idempotency

회사 공통 후보:
- button disabled는 UX일 뿐 무결성 경계가 아니다.
- work/entity key 기반 idempotency.
- same key + same payload retry는 동일 결과로 수렴.
- same key + different payload는 conflict/HOLD.
- timeout은 cancel/failed/succeeded 판정이 아니다.
- async response는 요청 당시 entity/work key에만 귀속.
- local cache 존재를 server commit으로 간주하지 않는다.
- external app open을 business completion으로 간주하지 않는다.

Admin + Sales cross-project evidence가 있으므로 COMMON_ADOPTED 후보.

---

## 18. Responsive / Device Verification

공통 verification profile 후보:
- mobile: 360 / 390 / 412 CSS px
- desktop: 1280 / 1440
- keyboard-only
- 200% zoom
- reduced-motion
- focus-visible
- loading/empty/error/populated
- light/dark when supported
- safe-area
- virtual keyboard
- scroll restore
- draft preservation
- async response identity

viewport 숫자는 법적 규범이 아니라 우리 consumer-device regression set.

---

## 19. Product Profile로 반드시 남길 것

전사 core가 강제하지 않는다:
- brand color
- radius family
- icon family
- public product vs dense admin density
- exact card gap
- exact column count
- accepted file types
- file max size
- business labels
- domain state names
- primary workflow priority

공통 규격은 **semantics / behavior / states / evidence / floor tokens**를 소유한다.

---

## 20. 다른 표준 세션에 넘길 값

현재 표준 정본에서 우선 고정할 추천:

1. `control.desktop.compact.visual = 40`
2. `target.touch.minimum = 44`
3. `target.quick_action.preferred = 48`
4. `row.mobile.interactive.minimum = 64` (CROSS_PROJECT candidate)
5. `spacing.scale = [4,8,12,16,24,32,48]`
6. `text.body.compact = 14`
7. `text.body.default = 16`
8. `focus.ring.width = 3`, `offset = 2`
9. `contrast.text.minimum = 4.5`
10. `contrast.ui.minimum = 3.0`
11. `upload.desktop.medium = 40`
12. `upload.touch.large = 48`
13. `drag.requires_non_drag_alternative = true`
14. `dialog.escape_close = true`
15. `dialog.focus_return = invoker`
16. `tabs.latency_sensitive = manual_activation`
17. `file.accept_is_hint_only = true`
18. `file.server_validation_required = true`
19. `async.idempotency_boundary = repository/service`
20. `completion.external_launch_is_not_completion = true`

### 승격 조건

- 외부 normative인지 확인
- 내부 기존 프로젝트와 충돌 검사
- 2개 이상 프로젝트 적용 시 cross-project verified
- rendered/runtime regression proof
- exception registry
- rollback/compatibility 확인
- 그 뒤 canonical standard에 promote

---

## 21. 조사 출처

### W3C / WAI
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Target Size Minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- Dragging Movements: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- Focus Not Obscured: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum
- Non-text Contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast
- Status Messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages
- ARIA APG Patterns: https://www.w3.org/WAI/ARIA/apg/patterns/

### Apple
- Human Interface Guidelines / Buttons: https://developer.apple.com/design/human-interface-guidelines/buttons
- Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility

### Material
- Accessibility touch targets: https://m1.material.io/usability/accessibility.html

### IBM Carbon
- Button: https://carbondesignsystem.com/components/button/
- File uploader: https://carbondesignsystem.com/components/file-uploader/usage/
- Dropdown: https://v10.carbondesignsystem.com/components/dropdown/usage/

### MDN / OWASP
- file input / accept: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file
- accept attribute: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/accept
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

---

## 22. 핵심 결론

> **전 세계 누구라도 같은 결과를 내려면 “값 하나”만 적으면 안 된다. 각 값에 적용범위, evidence level, 상태계약, 검증법, 예외등록 규칙이 함께 있어야 한다. AI Core 정본은 그 다섯 가지를 함께 기계판독 가능하게 만들어야 한다.**
