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
