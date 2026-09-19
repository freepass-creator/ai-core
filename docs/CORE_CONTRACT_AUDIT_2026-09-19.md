# C Session Core Contract Audit — 2026-09-19

기준 revision: `444066bea9ac00e4cf4ba539c7b5344154bd407e`

상태: **P0 IMPLEMENTED ON PR #94 / CI VERIFICATION IN PROGRESS**

## 감사 결론

기존 AI Core에는 Capability/Work/Receipt 관련 강한 구현이 있었지만 전사 backend convention 정본은 분산되어 있었다.

특히 부족했던 것:
- company-wide Data/SSOT contract registry
- source priority/fallback machine contract
- canonical money/percentage/time/null semantics
- general Engine/Port/Adapter/Binding declaration
- common API pagination/query/request idempotency contract
- RFC9457-compatible error object + code registry
- general event envelope/type registry
- generic result vs execution receipt separation
- parser/normalizer/mapper declaration
- import/export pipeline semantics
- schema compatibility/migration policy

## 역수입 근거

A-session cross-repo evidence에서 일반화:
- ERP4: canonical writer, provenance, fixed snapshot, no silent legacy fallback
- Admin: typed domain boundary, repository idempotency, version conflict
- AIOps: evidence/event/correction, source registry thinking
- Welrix: canonical percentage vs provider ratio conversion
- JPK ERP5: optimistic conflict and multi-axis-state lesson
- Sales: server truth/local recovery separation

옛 PR #15에서 Engine/Port/Adapter/Binding 연구 아이디어를 현재 main 기준으로 재검증해 구조화된 v1 계약으로 역수입했다. PR #15 자체를 wholesale merge하지 않는다.

## 구현된 P0

- 23 canonical schemas in `registry/core-contracts.json`
- canonical error-code registry
- canonical event-type registry
- AJV Draft 2020-12 validator
- semantic SSOT source/pipeline validators
- Engine/Adapter binding resolver
- legacy adapter shadow bridge
- CI `contracts:validate`
- contract tests
- canonical standard + migration guide

## 경계

- B: UI 표현
- C: data/system/transport contract
- D: workflow state/transition/guard/approval semantics

C event/code schemas가 D workflow content를 소유하지 않는다.

## P1 backlog

P0 merge 이후 별도 작업으로 남길 것:
- OpenAPI document generation/lint integration
- contract diff checker for breaking-change detection
- generated TypeScript types from canonical schemas
- cross-repo adoption dashboard
- concrete event-type registrations as projects migrate
- project source-registry instances and freshness telemetry
- contract package/version publishing strategy

P1은 P0 CI와 adoption proof 없이 먼저 확장하지 않는다.
