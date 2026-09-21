# UI/UX New Project Starter

새 프로젝트가 공통 UI를 다시 설계하지 않도록 AI Core의 현재 revision에 묶인 시작 파일을 생성한다.
생성기는 dirty/unresolved AI Core checkout을 거절한다. 먼저 변경을 검증·커밋한 exact revision에서 실행한다.

```powershell
npm run uiux:init -- --target C:\dev\new-project\src\styles\ai-core --profile freepass-product --product "FreePass Example"
```

Profiles:

- `freepass-product`: 공개 상품, Sales, Estimate 계열의 기본값
- `internal-work`: Admin, 운영, 데이터 관리 화면
- `mobile-work`: 현장 업무와 모바일 단일 작업 화면

생성 결과:

- `ai-core-ui.css`: token + component + runtime + product presentation
- `starter.html`: 버튼, 검색, 카드 목록, 상태, 하단 액션의 실행 가능한 의미 구조
- `starter.js`: 검색 열기/닫기 상태 보존, 목록 필터, data-state 전환의 framework-neutral reference
- `ai-core-ui.profile.json`: 선택 profile과 AI Core revision
- `AI_CORE_UI_STARTER.md`: 적용 및 검증 체크리스트

기본값은 기존 FreePass 규격을 그대로 따른다.

- 버튼은 기본적으로 테두리를 쓰지 않고 면, 글자, 간격으로 위계를 만든다.
- 검색창과 입력창은 기능적 경계를 유지한다.
- 목록은 전체 행이 눌리는 카드형을 사용한다.
- 상단은 정보, 실행은 하단에 둔다.
- 한 실행 영역에는 primary action을 하나만 둔다.
- 모바일은 PC 축소판으로 만들지 않는다.
- loading, empty, error, populated 상태를 따로 구현한다.

`registry/ui-ux-starter-profiles.json`이 profile별 밀도, 카드 배치, 하단 액션 배치와
기존 feature ID binding을 고정한다. `contracts/ui-ux-starter-profiles.schema.json`과
`npm run uiux:validate`가 이 등록부를 검증한다. 공통 interaction 의미는 profile이 바꾸지 않는다.

## Profile과 브랜드 경계

- `freepass-product`: 여유 있는 카드 밀도와 모바일 보조:주행동 3:7을 사용한다.
- `internal-work`: 더 조밀한 운영 목록을 사용하되 touch/accessibility floor는 유지한다.
- `mobile-work`: 한 화면 한 작업과 좁은 content width를 우선한다.
- 모든 profile의 실제 브랜드/CI는 consumer 정본에서 가져온다. 정본을 못 찾으면 `HOLD`이며 starter의 중립 token을 새 브랜드로 간주하지 않는다.

생성된 sample은 검색 영역을 숨겨도 DOM을 제거하지 않으므로 draft와 선택을 유지하고,
닫을 때 invoker focus와 이전 scroll 위치를 복구한다. 검색 결과와 count는 같은 input event에서
갱신되며 결과가 0이면 `empty`, 있으면 `populated`를 명시적으로 표시한다.

## 적용 순서와 migration 목록

운영 프로젝트에 일괄 적용하지 않는다. 프로젝트별로 아래 순서와 별도 변경/검증 기록을 사용한다.

1. 신규 프로젝트에서 starter 생성과 brand SSOT binding을 먼저 검증한다.
2. 기존 프로젝트는 화면별 inventory에서 `button → search → list/card → action boundary → data states → responsive` 차이를 기록한다.
3. 기능 의미를 바꾸지 않는 token/profile 연결부터 적용한다.
4. 검색의 scroll/selection/draft/query revision 보존을 회귀 테스트로 잠근다.
5. 목록을 stable ID가 있는 전체 클릭 카드로 옮기고 loading/empty/error/populated를 각각 검증한다.
6. task CTA를 하단 실행 영역으로 옮긴 뒤 모바일 safe-area/keyboard와 데스크톱 anchored 위치를 검증한다.
7. 360/390/412/1280/1440, keyboard, focus, reduced-motion, forced-colors 증거를 Quality Hub receipt에 묶는다.

프로젝트별 브랜드·업무 밀도·domain copy는 해당 profile/consumer에 남긴다. 공통 규격으로 역수입할 때는
두 번째 프로젝트 근거와 registry 변경을 별도로 심사한다.

이 생성기는 공통 시작점을 제공한다. 실제 프로젝트가 `CONFORMANT`가 되려면 consumer manifest, revision-bound browser evidence와 Quality Hub receipt가 별도로 필요하다.
