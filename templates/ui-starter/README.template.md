# {{PRODUCT_NAME}} 화면 기본 규격

이 폴더는 AI Core UI/UX 규격 `{{AI_CORE_REVISION}}`에서 생성했습니다.

**상단은 상태와 제목, 하단은 이동과 실행.**

**버튼과 선택은 테두리 없이, 입력과 표는 테두리 있게, 목록은 카드 하나.**

**하단 이동은 아이콘, 페이지 실행은 테두리 없는 박스 버튼.**

```text
┌ 상단 ─ 제목 · 현재 위치 · 상태 ┐
│ 가운데 ─ 현재 페이지 내용      │
└ 하단 ─ 전역 이동 또는 페이지 실행 ┘
```

- 화면 유형: `{{PROFILE_ID}}` ({{PROFILE_LABEL}})
## Start

`ai-core-ui.css`를 한 번 불러오고 `starter.html`과 `starter.js`의 블록을 업무 순서대로 배열합니다. 최상위 화면의 하단 이동은 `ui-bottom-nav`에 아이콘 버튼으로 두고 각 버튼에 `aria-label`을 제공합니다. 상세·입력·검수 화면은 `ui-bottom-action`에 primary action 하나를 둡니다. 둘 다 필요한 경우에는 서로 겹치지 않는 두 영역으로 분리합니다.

`models/index.html`에서 여섯 개 표준 화면을 고르고, 용도에 맞는 HTML을 복사해 시작합니다.

## Required verification

키보드 이동, 보이는 포커스, 44px 터치 영역, safe area, 가상 키보드, 스크롤·작성 내용 보존은 생성기 검증 대상으로 유지합니다.
