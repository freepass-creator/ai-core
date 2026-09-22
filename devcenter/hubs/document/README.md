# Document Hub

Development Center의 문서 자산·템플릿·렌더링 실행·검증 허브.

## 관장
- 보고서 / 기획안 / 제안서
- 계약서 / 약관 / 전자문서
- 반복 업무 양식
- A4 / 16:9 / PDF / PPT 출력 규격
- 문서 Template 소비 / Render Plan / Export 검증
- 문서 버전·재사용 패턴
- Document Receipt / Lock

## 권한 경계

Document Hub는 **템플릿 본문 SSOT가 아니다.** 템플릿을 소비하고 검증·증빙하는 실행 허브다.

현재는 전환 단계다.

- 현재 임시 템플릿 원천: `freepass-creator/docshub@4059d82779b7e1796afa2bbdf644e1d3bbdba3e7`
- exact source binding: `source-binding.json`
- 전환 계획: `../../../docs/integration/DOCSHUB_IMPORT_CLASSIFICATION_2026-09-23.json`
- 최종 템플릿 소유 목표: AI Core `management-support/templates/`
- 프로젝트/수명 상태 정본: AI Core 루트 `registry/projects.json`

외부 DocsHub와 `management-support/templates/`가 동시에 writable template SSOT가 되는 것은 금지한다.

## 현재 HOLD

원격 DocsHub 19개 추적 파일은 source review가 끝났지만, 실제 대형 로컬 `C:\dev\docshub`는 Git 저장소가 아니고 이 세션에서 파일 bytes를 재관측하지 못했다. 과거 분류상 회사 원본·사건 자료가 섞여 있으므로 로컬 폴더의 물리 복사는 계속 HOLD다.

다음 조건이 모두 충족된 뒤에만 관리지원 템플릿 정본으로 cutover한다.

1. 로컬 파일 전체 fresh inventory
2. 회사 원본·개인정보·재무 원본·사건 자료 제외
3. 가져올 템플릿/생성기 exact provenance 기록
4. 기존 DocsHub 대비 artifact parity 검증
5. Document Hub binding을 내부 `management-support/templates/`로 전환
6. Work Map / capability의 문서 authority 동시 전환
7. 외부 DocsHub를 reference-only로 내림

## Runtime / Receipt

- Transitional DocsHub source binding: `source-binding.json`
- Document Job: `../../contracts/document-job.schema.json`
- Document Receipt: `../../contracts/document-receipt.schema.json`
- Document Lock: `../../contracts/document-lock.schema.json`
- Runtime/planner: `../../scripts/document-hub.mjs`
- Regression definitions: `../../test/document-hub.test.mjs`
- Consumer registry: `consumers.json`
- Guide: `../../docs/DOCUMENT-HUB-RUNTIME.md`

현재는 외부 template body를 복제하지 않고 exact revision + blob SHA로 검증한다. 물리 통합 시에는 management-support가 template body를 소유하고 Document Hub는 계속 소비·검증 역할만 유지한다.
