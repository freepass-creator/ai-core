# Data Hub Evidence & Promotion v1

## 목적

Data Hub를 추상 규격 모음이 아니라 **실제 프로젝트 구현을 revision-bound receipt로 평가하고 검증된 패턴을 공통화하는 계층**으로 만든다.

## 첫 subject

`freepass-creator/freepass-data@bd75b604fcd06358dedaa77edf62284cf0d17ae9`

범위는 **Catalog V1**이다.

## Data Receipt

실제 receipt:
`evidence/data/freepass-data-catalog-v1.json`

현재 결과는 **HOLD**다.

PASS 근거:
- RAW → reviewed Canonical → Projection 경계
- Field Authority
- Lineage / provenance
- expectedRevision / idempotency / append-only audit / durable outbox
- exact release manifest / evidence-gated activation

HOLD:
- production Firebase binding / IAM / auth
- backup/restore operational verification

HOLD를 PASS로 바꾸지 않고도 이 receipt 자체가 현재 revision의 정확한 증거가 된다.

## Project → Hub Promotion

`hubs/data/patterns.json`은 FreePass Data에서 검증된 반복 가능 패턴을 Data Hub 공통 패턴으로 승격한 결과다.

현재 ADOPTED:
- immutable RAW / Canonical / Projection
- Field Authority + Lineage
- Revision + Idempotency + Audit + Outbox
- Evidence-gated Release

제품 고유 collection명/도메인 필드는 역수입하지 않는다.

## Recovery

`hubs/data/recovery.json`은 필요한 recovery 계약을 명시한다. Backup/restore rehearsal이 없으므로 현재 HOLD이며 readiness에서도 PARTIAL만 인정한다.

## Consumer Map

`hubs/data/consumers.json`은 Admin/Sales/ERP4/Estimate의 현재 관계를 구분한다. 직접 Firebase 사용/legacy/reference를 Canonical consumer와 같은 상태로 세지 않는다.
