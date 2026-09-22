# CSS와 원자 부품 창고

사용자 요청(2026-09-09): 버튼 종류와 CSS를 미리 준비해 개발센터에서 찾아 활용한다.

## 지금 사용할 수 있는 것

- 브라우저 **원자 실험실 → 버튼**: 원본 Btn의 4가지 형태(solid/ghost/danger/bare), 3가지 크기, 활성·비활성 24개 조합. 폭 채우기, 아이콘 버튼, ButtonLabel, IconSeg, 링크형, 처리 중 조합 예제.
- 선택한 설정에 맞춰 완결된 React 사용 예제를 생성하고 복사한다. 해당 프로젝트의 경로 별칭·원본 모듈 의존성이 있어야 한다.
- 기존 입력·Select·Checkbox·Textarea·SearchInput·DataTable·Section·FormCard·토큰 실험실도 유지한다. 원본 모듈 참조는 `portal/app/specimen/page.tsx`와 `portal/app/button-gallery.tsx`에 있다.
- 브라우저 **CSS 스타일 창고**: CSS/SCSS 241개, 동일 내용 35묶음, 코드 안의 스타일 후보 3,795개 파일. 프로젝트·선택자·변수 검색, 원본 경로와 원문/표시본 해시, 코드 보기·복사.
- 센터 자체 CSS 원본: `portal/app/foundation.css`(기본 레이아웃), `portal/app/globals.css`(화면 스킨·배치·작업실). 빌드 스크립트 안의 CSS를 foundation.css로 분리했으며 중복 정의를 남기지 않았다.

## 원본과 적용 범위

기존 프로젝트의 컴포넌트와 CSS가 정본이다. 개발센터는 원본 연결과 파생 미리보기·검색 자료를 제공한다. `public/catalog/styles.json`, `static/catalog`, `dist`는 생성 자료이므로 규격 수정은 원본에서 한다.

CSS 파일을 하나의 거대한 전역 파일로 합쳐 넣지 않는다. 선택자, 상속, 전역 reset, 테마, 반응형 조건이 다르면 충돌한다. 같은 바이트의 파일도 다른 프로젝트에서 교체 가능한지는 별도 검토한다. 중복 묶음은 조사 결과이며 자동 삭제/정본 지정이 아니다.

CSS 원문에 외부 주소·내장 데이터 등이 있으면 가려 표시한다. 원본 SHA와 표시본 SHA를 구분하고 가림본 복사를 표시한다. 선택한 CSS를 센터에 동적으로 적용하거나 실행하지 않는다.

인라인 스타일은 JSX style, styled, css, cva 등의 문법 패턴으로 발견한 **후보 위치**다. 동적 표현식의 실제 값·우선순위·실제 적용까지 판정하지 않는다. 제외 폴더, 민감 가능 파일, 파일 크기·발췌 제한은 수집기의 코드와 화면에 명시한다. 모든 CSS 의미의 통합 완료를 뜻하지 않는다.

## 재생성과 검증

1. `python scripts/collect-style-assets.py`: 원본을 읽고 CSS·인라인 후보를 갱신.
2. `npm --prefix portal run typecheck`: 센터 UI와 버튼 갤러리를 원본 props에 대조.
3. `node scripts/verify-button-recipes.cjs`: 표시되는 실제 예제의 형태·크기·비활성·폭 채우기 48조합 타입검사.
4. `npm --prefix portal run build`: 원본 해시 드리프트 확인, 선택한 코드만 읽는 파일별 자료 생성, 완성된 출력 교체.

브라우저 확인: danger/sm 변경 후 버튼 클릭, disabled 동작, 예제 코드 복사, CSS 프로젝트 필터·원문 개별 로딩, 인라인 경로 검색. 원본 CSS 뒤에 센터 전역 reset/focus 스타일을 덧붙이지 않고 갤러리 보조 클래스만 사용한다. 제품 전체 provider·상속 문맥 검증은 각 사용처에서 별도로 한다.

## 검토 상태

사용자 요청 범위의 창고 구현이다. 모든 스타일의 전역 표준 승인·제품 전체 회귀 검수는 아니다. Claude 설명 기반 검토의 정본·맥락·완료 범위 구분을 반영했다. 보조 Codex 코드 검토에서 배포 출력 잔존, iframe 전역 CSS 혼합, 가림본 해시 혼동을 지적해 수정했다. Cursor/Gemini 읽기 전용 검토는 workspace trust 요구로 실패했으며 전원 검수는 HOLD다.
