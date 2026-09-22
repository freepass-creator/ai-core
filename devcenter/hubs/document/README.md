# Document Hub

Development Center의 문서 자산·템플릿·렌더링 허브.

## 관장
- 보고서 / 기획안 / 제안서
- 계약서 / 약관 / 전자문서
- 반복 업무 양식
- A4 / 16:9 / PDF / PPT 출력 규격
- 문서 Template / Renderer / Export
- 문서 버전·재사용 패턴

## 현재 authoritative source
- `freepass-creator/docshub`
- DevCenter `registry.json`의 `doc-form`

## 연계
문서의 시각 언어는 Design Hub, 내용 정확성·회귀 검수는 Quality Hub와 연계한다.

## 경계
DocsHub 저장소를 이 폴더로 복제하지 않는다. Document Hub가 포인터와 소비 규칙을 관장한다.


## Runtime / Receipt

- DocsHub source binding: `source-binding.json`
- Document Job: `../../contracts/document-job.schema.json`
- Document Receipt: `../../contracts/document-receipt.schema.json`
- Document Lock: `../../contracts/document-lock.schema.json`
- Runtime/planner: `../../scripts/document-hub.mjs`
- Regression definitions: `../../test/document-hub.test.mjs`
- Consumer registry: `consumers.json`
- Guide: `../../docs/DOCUMENT-HUB-RUNTIME.md`

DocsHub template body는 이 Hub로 복제하지 않는다. pinned revision과 blob SHA를 통해 source를 검증하고 artifact receipt/lock만 Development Center가 관장한다.
