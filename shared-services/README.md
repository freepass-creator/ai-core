# Shared Services

AI Core 본사의 공통 서비스 영역이다.

여기에는 둘 이상의 프로젝트에서 재사용 가능하고, 프로젝트 고유 계정·ID·업무 규칙과 분리된 공통 연결/실행 유틸리티만 들어온다.

## 현재 상태

첫 extraction은 AIOps의 `lib/atomic-stream-write.mjs` 하나다.

- source: `freepass-creator/aiops@3d6ec8c6a0e826ae0472e3fb3e8bbaa8399b68c9`
- source blob: `4e4da3becc6d3d3eebbc8108708c0d5e5dc4197d`
- target: `fs/atomic-stream-write.mjs`
- 상태: **EXACT_COPY_SHADOW**
- AIOps 호출자 cutover: **아직 안 함**

이 단계에서는 AI Core가 재사용 후보를 보존·검증할 뿐, AIOps runtime authority를 빼앗지 않는다.

## 반입 원칙

- 공통 기능만 허용
- 회사별 ID/credential/계정 경로를 포함하면 refactor 전까지 HOLD
- source revision과 blob을 provenance에 고정
- exact-copy 또는 명시적 adapter 변환을 구분
- parity test 없이 호출자 전환 금지
- 기존 원본 retirement는 consumer cutover 뒤 별도 결정

Google/Drive/Sheet/lease/task-board 계열은 아직 AIOps 실행 문맥과 회사 설정에 결합되어 있어 이 폴더로 그대로 복사하지 않는다.

## security/secret-scan.mjs — 비밀·주민번호 검사 (2026-09-25)

renman `scripts/check-secrets.mts`(추적 파일의 키·토큰)와 aiops `scripts/check-staged.mjs`(커밋 전 .env·서비스계정 파일 차단)를 하나로 합친 공통판이다. 2026-09-25 aiops 에서 실제로 나온 **주민등록번호 전체** 규칙을 더했다.

- 실행: `npm run security:secrets`(추적 파일) · `node scripts/check-secrets.mjs --staged`(커밋 전). ai-core CI 는 매 PR 에 돈다.
- 결과에는 파일·줄·규칙만 나온다. **값은 절대 찍지 않는다.**
- 예외는 그 줄에 `secret-scan: allow <이유>` 를 적는 것뿐이다. 흔한 가짜 예시(뒤 7자리 `1234567` 등)는 주민번호로 세지 않는다.
- 다른 저장소는 이 파일을 고정 revision 으로 가져가 자기 CI 에 건다(renman 의 기존 검사를 대체할 수 있다).
