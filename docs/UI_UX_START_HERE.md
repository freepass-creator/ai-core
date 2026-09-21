# AI Core UI/UX — START HERE

Status: **CANONICAL ENTRYPOINT**

이 문서는 사용자가 “AI Core 규격 봐”, “UI/UX 규격 맞춰”, “디자인 통일해”라고 했을 때
모든 AI/개발자가 **가장 먼저** 읽는 진입점이다.

규격이 이미 있는데 프로젝트별로 임의 UI를 다시 만들지 않도록,
UI/UX 작업은 아래 순서를 생략하지 않는다.

---

## 0. 먼저 고정할 것

작업 시작 전에 반드시 다음을 적는다.

- 대상 프로젝트 / 저장소
- 대상 화면
- 대상 프로젝트 revision
- 사용할 **AI Core exact revision**
- 제품 프로필
- 실제 브랜드/CI 정본 위치
- 구현 후 검증 viewport

“AI Core 최신 거 대충”처럼 HEAD를 의미 없이 참조하지 않는다.
실행/검증 증거는 exact revision에 묶는다.

새 프로젝트는 공통 UI를 다시 만들지 말고 먼저 starter를 생성한다.

```powershell
npm run uiux:init -- --target <프로젝트 안의 UI 폴더> --profile freepass-public --product "프로젝트 이름"
```

상세 사용법과 profile 선택 기준은 `docs/UI_UX_NEW_PROJECT_STARTER.md`를 따른다.

---

## 1. 읽는 순서

### A. 전사 공통 규칙

1. `docs/UI_UX_START_HERE.md` — 지금 문서
2. `docs/UI_UX_CONSTITUTION.md` — 소유권/정본 순서/전역 불변 규칙
3. `docs/SCREEN_DESIGN_STANDARD.md` — 화면/접근성/버튼/액션 위치
4. `docs/RESPONSIVE_STANDARD.md` — 모바일/웹/재배치/viewport
5. `registry/ui-ux-features.json` — 사용할 feature ID와 상태
6. `design-system/tokens.json` — 수치/색/간격/높이 SSOT
7. `design-system/components.registry.json` — component runtime
8. `design-system/patterns.registry.json` — pattern/workflow runtime
9. `design-system/interaction.contract.json` — cross-component invariants
10. `design-system/runtime-v2.css` — 실제 공통 runtime CSS
11. `docs/UI_UX_NEW_PROJECT_STARTER.md` — 새 프로젝트 기본틀 생성

### B. 제품 전용 규칙

FreePass 제품이면 반드시 추가로:

- `docs/FREEPASS_PRODUCT_UI_PROFILE.md`

FreePass 전용 프로필은 전사 규칙을 덮어쓰는 두 번째 표준이 아니다.
브랜드, 제품 밀도, 모바일 문법처럼 허용된 특화를 더한다.

### C. 실제 브랜드 정본

AI Core는 브랜드 자산을 임의 생성하지 않는다.
프로젝트/브랜드 SSOT에서 실제 CI/BI를 찾는다.

브랜드 자료를 못 찾으면 **HOLD**한다.
임의 로고, 임의 색, 임의 워드마크를 만들지 않는다.

---

## 2. 화면을 만들기 전에 feature ID부터 정한다

화면 CSS부터 작성하지 않는다.

예: FreePass 모바일 검수 상세라면 최소 후보는 다음과 같다.

- `navigation.header`
- `navigation.bottom-action`
- `action.primary`
- `action.secondary`
- `data.detail`
- `data.audit`
- `feedback.alert`
- `system.responsive`
- `system.safe-area-keyboard`
- `system.focus`

최상위 모바일 화면이라면:

- `navigation.bottom-nav`

전역 하단 메뉴와 로컬 하단 액션은 같은 것이 아니다.

---

## 3. AI Core → Development Center 실행 경로

AI Core는 규격의 정본이고, 실제 프로젝트 적용의 공식 진입점은
Development Center **Design Hub**다.

```text
사용자 UI/UX 요청
  ↓
AI Core exact revision 고정
  ↓
이 START HERE + 공통 규격 + 제품 프로필
  ↓
feature ID 결정
  ↓
Development Center Design Hub
  ↓
프로젝트 구현
  ↓
Quality Hub 검증
  ↓
Delivery Hub 배포 증거(배포가 범위일 때)
```

Design Hub 시작점:

- repo: `freepass-creator/devcenter`
- `hubs/design/README.md`
- `hubs/design/core-binding.json`
- `docs/DESIGN-HUB-COMPILER.md`

**Design Hub core-binding revision이 이번 작업에서 쓰려는 AI Core revision과 다르면 먼저 binding을 갱신/검증한다.**
서로 다른 revision을 섞은 상태에서 “AI Core 규격 적용 완료”라고 하지 않는다.

---

## 4. FreePass 모바일의 필수 체크

FreePass 모바일은 특히 다음을 먼저 본다.

### 최상위(depth 0)

- `navigation.bottom-nav`
- 전역 하단 메뉴
- 64px 모바일 업무행 기준 + safe-area
- 아이콘/라벨
- 동일 폭
- 상단은 정보 중심

### 상세/검수/입력(depth 1+)

- 전역 하단 메뉴 숨김
- `navigation.bottom-action`
- 주행동 1개
- Primary 48px 권장, 44px 미만 금지
- 보조 + 주행동이면 FreePass 기본 3:7
- 저장/반영/완료/다음 CTA는 상단에 두지 않음

### 반응형

검증 viewport:

- 360
- 390
- 412
- 1280
- 1440

모바일은 PC 축소판이 아니다.
일반 페이지 전체가 좌우로 흔들리면 responsive 검증 실패다.

---

## 5. Fail-closed

아래 중 하나면 임의 디자인하지 않고 HOLD한다.

- 브랜드/CI 정본을 못 찾음
- 제품 프로필이 필요한데 안 읽음
- feature ID가 존재하는데 로컬 대체 패턴을 새로 만듦
- runtime이 `CONTRACT_ONLY`인데 실제 구현이 있다고 가정함
- Design Hub binding이 의도한 AI Core revision과 다름
- 360/390/412 검증 없이 모바일 완료 주장
- screenshot/브라우저 검토 없이 Visual QA PASS 주장
- 프로젝트 preview만 만들어놓고 CONFORMANT라고 주장

---

## 6. “완료”라는 말의 단계

다음은 서로 다른 상태다.

- DESIGNED
- CODED
- RESPONSIVE VERIFIED
- INTERACTION TESTED
- VISUAL REVIEWED
- QUALITY RECEIPT PASS
- DEPLOYMENT VERIFIED
- USER APPROVED

하나를 했다고 다음 단계까지 했다고 말하지 않는다.

---

## 7. 구현 전에 쓰는 짧은 체크문

UI 작업 시작 전에 작업 메모/PR에 최소 아래를 남긴다.

```text
AI Core UI/UX preflight
- core revision:
- product profile:
- brand SSOT:
- feature IDs:
- target viewports:
- Design Hub binding:
- Quality evidence required:
```

이 항목을 못 채우면 구현보다 먼저 정본을 찾는다.

---

## 한 문장

**“AI Core를 보라”는 뜻은 AI Core 문서를 참고하라는 뜻이 아니라,
정해진 정본 순서 → feature mapping → Design Hub → Quality Hub 절차를 타라는 뜻이다.**
