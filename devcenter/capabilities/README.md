# capabilities — Engineering / Integration Hub backing assets

상태: 기존 기능의 정적 수집과 브라우저 기능 창고를 구현했다. `shared`는 **Engineering Hub**, `integrations`는 **Integration Hub**의 backing source다. 전체 업무 의미·실행 검수 완료는 아니다.

- `shared`: 의미·입출력·버전이 명확한 공통 기능
- `integrations`: 외부 API·데이터 연결 계약과 어댑터

파트를 활성화할 때 책임자·입출력·원본 참조·실행 진입점·완료 기준을 명시한다. 기존 원본은 이동·복제하지 않는다.

## 기능 찾기

브라우저 **기능 창고**에서 프로젝트 → 그룹 → 함수/모듈을 선택한다. 원본 경로·SHA·입력 이름·반환 표기·직접 상대경로 참조를 확인한다. 구현 본문·민감 원문은 이 창고에 게시하지 않는다. JS/TS와 Python은 구문 트리로 추출하며 나머지 지원 범위와 누락은 화면에 표시한다.

수집 실행: `node scripts/collect-functions.mjs`. 결과 `portal/public/catalog/functions.json`은 로컬 파생 자료이며 빌드가 프로젝트별 브라우저 자료를 생성한다. 다른 환경에서는 동일한 프로젝트 원본 접근이 필요하다.

[오류·부족·개선 기록](IMPROVEMENTS.md)을 함께 확인한다. 함수 선언 수는 독립된 업무 기능 수나 검증 통과 수가 아니다.
