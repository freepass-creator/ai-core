# Document Hub Runtime v1

## 목적

DocsHub의 문서 템플릿을 Development Center가 복제하지 않고 **exact revision으로 참조하여 프로젝트 문서 작업에 적용·검증·증빙**한다.

## 구조

```text
Document Job
  ↓
DocsHub source binding / blob verification
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

## 정본

- DocsHub binding: `hubs/document/source-binding.json`
- Job contract: `contracts/document-job.schema.json`
- Receipt contract: `contracts/document-receipt.schema.json`
- Lock contract: `contracts/document-lock.schema.json`
- Runtime/planner: `scripts/document-hub.mjs`
- Consumer registry: `hubs/document/consumers.json`

## SSOT 경계

DocsHub가 template body와 renderer source를 소유한다. Document Hub는 pinned revision과 blob SHA를 읽고 catalog/plan/receipt를 만든다.

따라서:
- template HTML/CSS/JS를 DevCenter에 복사하지 않는다.
- 프로젝트가 template을 임의 fork하면 별도 candidate/evidence로 취급한다.
- source revision이 바뀌면 기존 receipt/lock은 새 버전 검증 없이 재사용하지 않는다.

## Receipt

문서 완료 주장은 최소 다음을 포함한다.

- 대상 project exact revision
- template ID + DocsHub source revision
- 생성 artifact format/ref/SHA-256
- content accuracy check
- numeric/text accuracy check
- layout overflow/visual check
- 최종 PASS/HOLD/FAIL

## Recovery

승인된 artifact만 Document Lock으로 만들 수 있다. 다음 승인본은 `previous_lock_ref`를 통해 last-known-good chain을 만든다.

## 현재 consumer

FreePass Admin 전자계약/약관은 `contract`, `terms` template 소비 후보로 등록했다. 실제 Admin renderer와 generated artifact receipt가 없으므로 MAPPED 수준이며 conformance 완료가 아니다.
## Canonical receipt

Document 결과는 `core-receipt/v1` 공통 봉투와 `hub.document` payload를 사용한다. [CORE-HUB-RECEIPTS](../../docs/CORE_HUB_RECEIPTS.md)를 따른다.
