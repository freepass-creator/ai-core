# Document Hub Runtime v1

## 목적

문서 템플릿 본문을 두 벌로 만들지 않고, **exact source revision에 결속된 템플릿을 적용·검증·증빙**한다.

현재 DocsHub 외부 저장소는 전환 전 임시 template source다. 최종 통합 뒤에는 AI Core `management-support/templates/`가 템플릿 본문을 소유하고, Development Center Document Hub는 planner / validator / receipt 역할만 유지한다.

## 구조

```text
Document Job
  ↓
Template source binding / source verification
  ↓
Template Catalog
  ↓
Render Plan
  ↓
Project/renderer execution
  ↓
Artifact hashes
  ↓
Content + Visual checks
  ↓
Document Receipt
  ↓
Approved Template Lock / Last-known-good
```

## 현재 전환 원천

- repository: `freepass-creator/docshub`
- exact revision: `4059d82779b7e1796afa2bbdf644e1d3bbdba3e7`
- binding: `hubs/document/source-binding.json`
- import/cutover classification: `../integration/DOCSHUB_IMPORT_CLASSIFICATION_2026-09-23.json` (AI Core 루트 기준 `docs/integration/...`)

이 revision에서 `README.md`, `app.js`, `index.html`, `styles.css`의 blob SHA는 기존 binding과 동일하다. 즉 template source content drift는 없고 revision pointer만 최신 관측으로 갱신됐다.

## 목표 SSOT 경계

**Cutover 전**
- template body/source: external DocsHub exact revision
- project status/revision: AI Core `registry/projects.json`
- planning/validation/receipt: DevCenter Document Hub

**Cutover 후**
- template body/source: AI Core `management-support/templates/`
- planning/validation/receipt: DevCenter Document Hub
- external DocsHub: reference-only

따라서:
- 외부 DocsHub와 management-support를 동시에 writable template SSOT로 운영하지 않는다.
- Document Hub 폴더 자체에 template body를 별도 복제하지 않는다.
- 로컬 `C:\dev\docshub`는 fresh inventory 전까지 import하지 않는다.
- 회사 원본·인사/개인정보·재무 원본·사건 자료는 AI Core Git에 복제하지 않는다.
- source revision 또는 source digest가 바뀌면 기존 receipt/lock을 새 검증 없이 재사용하지 않는다.

## Cutover gate

다음이 모두 PASS여야 한다.

1. `FRESH_LOCAL_INVENTORY_OBSERVED`
2. `SENSITIVE_AND_CASE_CONTENT_EXCLUDED`
3. `TARGET_PROVENANCE_WRITTEN`
4. `TEMPLATE_ARTIFACT_PARITY_VERIFIED`
5. `DOCUMENT_HUB_BINDING_MOVED_TO_INTERNAL_SOURCE`
6. `WORK_MAP_AND_CAPABILITY_AUTHORITY_UPDATED`
7. `OLD_DOCSHUB_SOURCE_MARKED_REFERENCE_ONLY`

## Receipt

문서 완료 주장은 최소 다음을 포함한다.

- 대상 project exact revision
- template ID + template source revision/digest
- 생성 artifact format/ref/SHA-256
- content accuracy check
- numeric/text accuracy check
- layout overflow/visual check
- 최종 PASS/HOLD/FAIL

Document 결과는 `core-receipt/v1` 공통 봉투와 `hub.document` payload를 사용한다.

## Recovery

승인된 artifact만 Document Lock으로 만들 수 있다. 다음 승인본은 `previous_lock_ref`를 통해 last-known-good chain을 만든다.

## 현재 consumer

FreePass Admin 전자계약/약관은 `contract`, `terms` template 소비 후보로 등록돼 있다. 실제 Admin renderer와 generated artifact receipt가 없으므로 MAPPED 수준이며 conformance 완료가 아니다.
