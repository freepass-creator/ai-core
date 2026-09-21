# UI/UX New Project Starter

새 프로젝트가 공통 UI를 다시 설계하지 않도록 AI Core의 현재 revision에 묶인 시작 파일을 생성한다.

```powershell
npm run uiux:init -- --target C:\dev\new-project\src\styles\ai-core --profile freepass-product --product "FreePass Example"
```

Profiles:

- `freepass-product`: 공개 상품, Sales, Estimate 계열의 기본값
- `internal-work`: Admin, 운영, 데이터 관리 화면
- `mobile-work`: 현장 업무와 모바일 단일 작업 화면

생성 결과:

- `ai-core-ui.css`: token + component + runtime + product presentation
- `starter.html`: 버튼, 검색, 카드 목록, 상태, 하단 액션의 의미 구조
- `starter.js`: 검색 전환, 작업 보존, 전체 행 선택, 화면 상태와 실행 피드백의 참조 동작
- `ai-core-ui.profile.json`: 선택 profile과 AI Core revision
- `AI_CORE_UI_STARTER.md`: 적용 및 검증 체크리스트

기본값은 기존 FreePass 규격을 그대로 따른다.

## 빠른 화면 구성 원칙

새 화면마다 UI를 다시 디자인하지 않는다. 아래 공통 블록을 업무 흐름에 맞게 배열하고 데이터와 문구만 바꾼다.

1. 상단 정보
2. 검색·필터
3. 목록 또는 상세
4. 상태 표시
5. 하단 실행

선택 상태는 기존 항목의 옅은 배경 변화만 사용한다. 별도 선택 바, 장식 테두리, 중복된 선택 문구를 추가하지 않는다. 페이지별 차이는 블록의 순서, 표시 데이터, 실행 버튼 이름으로 제한한다.

- 버튼은 기본적으로 테두리를 쓰지 않고 면, 글자, 간격으로 위계를 만든다.
- 검색창과 입력창은 기능적 경계를 유지한다.
- 목록은 전체 행이 눌리는 카드형을 사용한다.
- 상단은 정보, 실행은 하단에 둔다.
- 한 실행 영역에는 primary action을 하나만 둔다.
- 모바일은 PC 축소판으로 만들지 않는다.
- loading, empty, error, populated 상태를 따로 구현한다.

이 생성기는 공통 시작점을 제공한다. 실제 프로젝트가 `CONFORMANT`가 되려면 consumer manifest, revision-bound browser evidence와 Quality Hub receipt가 별도로 필요하다.
