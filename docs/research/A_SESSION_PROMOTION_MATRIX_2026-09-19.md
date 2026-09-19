# A 세션 Promotion Matrix — 2026-09-19

상태: **RESEARCH ROUTING INDEX / NOT CANONICAL**

## 목적

A 세션이 조사한 내용을 B·C·D·Security·QA·Governance 세션이 다시 전수조사하지 않도록,
각 후보를 **근거 성숙도 + 실제 프로젝트 + 다음 담당 세션 + 승격 게이트**로 정리한다.

이 표는 `COMMON_ADOPTED`를 선언하지 않는다.
`COMMON_ADOPTED_CANDIDATE`는 “정본 세션에서 machine contract와 consumer regression을 만들 가치가 충분하다”는 뜻이다.

## 등급

- `PROPOSED`: 외부 표준/분석상 후보, 실제 프로젝트 채택 증거 부족
- `PLATFORM_CONSENSUS`: 널리 쓰이는 외부 규격/플랫폼 합의
- `PROJECT_VERIFIED`: 한 실제 프로젝트에서 구현·검증
- `CROSS_PROJECT_VERIFIED`: 둘 이상 실제 프로젝트에서 같은 원칙이 독립적으로 관측/검증
- `COMMON_ADOPTED`: AI Core 정본 세션만 선언 가능

## 승격 우선 후보

| Candidate | 축 | Evidence | 실제 근거 | 넘길 세션 | 다음 단계 |
|---|---|---|---|---|---|
| `data.canonical-owner-writer` | Data/SSOT | CROSS_PROJECT_VERIFIED | freepasserp4, aiops | C | COMMON_ADOPTED_CANDIDATE |
| `data.stable-identity` | Data/SSOT | CROSS_PROJECT_VERIFIED | freepasserp4, freepass-sales, jpkerp5 | C | COMMON_ADOPTED_CANDIDATE |
| `data.snapshot-revision` | Data/SSOT | CROSS_PROJECT_VERIFIED | freepass-admin, freepasserp4, welrixtable | C | COMMON_ADOPTED_CANDIDATE |
| `data.source-provenance` | Data/SSOT | CROSS_PROJECT_VERIFIED | freepasserp4, aiops | C | COMMON_ADOPTED_CANDIDATE |
| `data.current-vs-history` | Data/SSOT | CROSS_PROJECT_VERIFIED | freepass-admin, aiops, freepasserp4 | C/D | COMMON_ADOPTED_CANDIDATE |
| `engine.boundary` | Engine/Adapter | CROSS_PROJECT_VERIFIED | freepass-admin, freepasserp4, welrixtable | C | COMMON_ADOPTED_CANDIDATE |
| `engine.repository-idempotency` | Engine/Adapter | CROSS_PROJECT_VERIFIED | freepass-admin, freepass-sales | C | COMMON_ADOPTED_CANDIDATE |
| `engine.fail-closed-provider` | Engine/Adapter | CROSS_PROJECT_VERIFIED | welrixtable, freepass-sales, freepasserp4 | C | COMMON_ADOPTED_CANDIDATE |
| `api.problem-details` | API/Error | PROPOSED | 외부 기준 | C | RESEARCH_REQUIRED |
| `api.stable-error-code` | API/Error | PROJECT_VERIFIED | freepass-admin | C | SECOND_PROJECT_REQUIRED |
| `api.idempotency-key` | API/Error | CROSS_PROJECT_VERIFIED | freepass-admin, freepasserp4 | C | COMMON_ADOPTED_CANDIDATE |
| `event.append-only-correction` | Event | CROSS_PROJECT_VERIFIED | aiops, freepass-admin, freepasserp4 | C/D | COMMON_ADOPTED_CANDIDATE |
| `event.cloudevents-envelope` | Event | PROPOSED | 외부 기준 | C | RESEARCH_REQUIRED |
| `workflow.fact-vs-state` | Workflow | CROSS_PROJECT_VERIFIED | freepass-admin, jpkerp5, aiops | D | COMMON_ADOPTED_CANDIDATE |
| `workflow.guard-vs-evidence` | Workflow | CROSS_PROJECT_VERIFIED | jpkerp5, aiops | D | COMMON_ADOPTED_CANDIDATE |
| `workflow.launch-vs-completion` | Workflow | CROSS_PROJECT_VERIFIED | freepass-sales, aiops | D | COMMON_ADOPTED_CANDIDATE |
| `workflow.hold-resume` | Workflow | PROJECT_VERIFIED | aiops | D | SECOND_PROJECT_REQUIRED |
| `workflow.obligation-pair` | Workflow | PROJECT_VERIFIED | aiops | D | SECOND_PROJECT_REQUIRED |
| `security.role-org-scope-action` | Security | PROJECT_VERIFIED | freepasserp4 | Security | SECOND_PROJECT_REQUIRED |
| `security.exact-subject-approval` | Security | PROJECT_VERIFIED | aiops | Security | SECOND_PROJECT_REQUIRED |
| `security.audit-pii-scrub` | Security | PROJECT_VERIFIED | freepasserp4 | Security | SECOND_PROJECT_REQUIRED |
| `security.rules-negative-tests` | Security | CROSS_PROJECT_VERIFIED | freepasserp4, freepass-sales | Security/QA | COMMON_ADOPTED_CANDIDATE |
| `qa.negative-control` | Observability/QA | CROSS_PROJECT_VERIFIED | freepasserp4, freepass-sales | QA | COMMON_ADOPTED_CANDIDATE |
| `qa.proof-levels` | Observability/QA | CROSS_PROJECT_VERIFIED | freepasserp4, freepass-admin, freepass-sales | QA | COMMON_ADOPTED_CANDIDATE |
| `obs.freshness-first-class` | Observability/QA | CROSS_PROJECT_VERIFIED | freepasserp4, aiops | QA | COMMON_ADOPTED_CANDIDATE |
| `obs.otel-semantics` | Observability/QA | PROPOSED | 외부 기준 | QA | RESEARCH_REQUIRED |
| `release.production-revision-proof` | Build/Deploy | PROJECT_VERIFIED | freepasserp4 | Governance | SECOND_PROJECT_REQUIRED |
| `governance.capability-pin` | Governance | CROSS_PROJECT_VERIFIED | ai-core, freepasserp4, freepass-admin | Governance | COMMON_ADOPTED_CANDIDATE |
| `governance.checker-manifest` | Governance | PROJECT_VERIFIED | freepasserp4 | Governance/QA | SECOND_PROJECT_REQUIRED |
| `governance.semver` | Governance | PLATFORM_CONSENSUS | 외부 기준 | Governance | PILOT_REQUIRED |
| `governance.slsa-provenance` | Governance | PROPOSED | 외부 기준 | Governance/Security | RISK_PROFILE_PILOT |
| `governance.sbom` | Governance | PROPOSED | 외부 기준 | Governance/Security | RISK_PROFILE_PILOT |

## 즉시 C 세션이 contract로 만들 가치가 높은 묶음

1. Canonical Owner / Writer
2. Stable Entity Identity
3. Snapshot + Revision
4. Source Provenance
5. Current Projection vs History/Event
6. Engine / Port / Adapter / Repository / Connector boundary
7. Repository/Service idempotency
8. Authoritative provider fail-closed
9. Business idempotency key
10. Append-only event + correction

## 즉시 D 세션이 contract로 만들 가치가 높은 묶음

1. Fact vs State vs Derived State
2. Multi-axis state
3. Guard vs Evidence
4. Launch/Human Report vs System Verified Completion
5. Idempotent transition
6. Append-only transition history

`hold/resume`, `open-close obligation`은 AIOps 한 프로젝트 근거가 강하지만 두 번째 도메인 pilot 후 공통 승격이 안전하다.

## Security/QA에서 빠르게 공통화 가능한 것

- DB/Storage allow + deny negative tests
- proof level 구분
- known-bad/negative control
- freshness를 1급 상태로 관리

반대로:
- exact-subject approval
- role×org×scope×action
- audit PII scrub

은 매우 좋은 패턴이지만 현재 독립 두 번째 프로젝트 적용증거를 더 확보한다.

## 아직 “국제표준이니 바로 공통”으로 하면 안 되는 것

- RFC 9457 Problem Details
- CloudEvents envelope
- OpenTelemetry conventions
- SLSA provenance
- SBOM
- SemVer

외부 규격 자체는 성숙했지만 **우리 프로젝트 소비자 호환성/마이그레이션 증거**가 별도 필요하다.

## A 세션 다음 작업 방식

이제부터는 새 프레임워크를 더 만들기보다 다음 반복을 한다.

```text
새 repo/변경 관측
→ 후보와 기존 matrix 비교
→ 같은 의미인가?
→ 반례/실패가 있는가?
→ evidence level 상승/하락
→ 정본 세션에 delta만 전달
```

즉 A 세션은 앞으로 **continuous comparative audit** 역할을 맡는다.


## 2026-09-19 재검사 승격

- `api.stable-error-code`: **PROJECT_VERIFIED → CROSS_PROJECT_VERIFIED**.
  - FreePass Admin: typed `AppError` / stable code.
  - FreePass Estimate `work/ui-baseline`: provider error `PROVIDER_UNAVAILABLE`을 execution blocker와 함께 보존하고 contract test가 확인.
- `security.exact-subject-approval`: **PROJECT_VERIFIED → CROSS_PROJECT_VERIFIED**.
  - AIOps: plan/artifact/target/command digest + TTL.
  - AI Core: authority receipt가 `subject_revision`, scopes, ledger head, action/target, expiry를 다시 검증.
- `release.production-revision-proof`는 **유지: PROJECT_VERIFIED**.
  - Estimate에는 `/api/version` 구현과 contract/CI 근거가 있으나 실제 production serving revision 관측은 HOLD이므로 두 번째 운영증거로 세지 않는다.

이 재검사는 “비슷해 보인다”가 아니라 현재 source/revision의 실행계약을 읽고 올린 것이다.


### `workflow.hold-resume` 재검사 승격

**PROJECT_VERIFIED → CROSS_PROJECT_VERIFIED**

- AIOps: 보류 시 다시 볼 날짜를 받고 그 전까지 업무를 다시 띄우지 않는다.
- FreePass Sales: `나중에`/재통화 흐름이 `다음연락일`을 보존하고, 날짜가 오늘까지 도래한 대상만 다시걸사람 큐로 올린다. 진행중 목록도 경과/오늘 약속을 우선한다.

따라서 공통 의미는 특정 앱의 “보류” 라벨이 아니라 **defer until / resume at** 계약으로 잡을 수 있다.


## 2026-09-19 ERP4 recovery replay delta

| Candidate | 축 | Evidence | 실제 근거 | 넘길 세션 | 다음 단계 |
|---|---|---|---|---|---|
| `workflow.recovery-slot-no-replay` | Workflow / Recovery | PROJECT_VERIFIED | freepasserp4 | D/C | SECOND_PROJECT_REQUIRED |

- 근거 revision: `freepasserp4@1cf94b788a204777109cf2031b1f518fbcd99b01` (observed head `44a67cedc5f0d3e38efc68f1e8f84e6c28ab97b3`).
- 같은 logical 18:05 slot이 native schedule 성공 후 fallback으로 다시 실행된 것이 확인됐다.
- 일반화 후보: **logical execution identity + success-evidence reconciliation + monotonic recovery no-replay**.
- AIOps의 deterministic requestKey/lease/run manifest는 인접 근거지만 exact second-project proof로 계산하지 않는다.
- 상세: `docs/research/A_SESSION_DISCOVERY_ERP4_RECOVERY_SLOT_REPLAY_2026-09-19.md`.


## 2026-09-19 FP Settlement UI conformance delta

| Candidate | 축 | Evidence | 실제 근거 | 넘길 세션 | 다음 단계 |
|---|---|---|---|---|---|
| `ui.machine-conformance-gate` | UI/UX / Design QA | PROJECT_VERIFIED | fp-settlement | B | SECOND_PROJECT_REQUIRED |

- 근거: `fp-settlement@b1e833dfed37ed08f5cc5ed83bdd55a29bf5bc24`, current observed head `b406da67a9cb2b85b5572a7f5d28d350ca84cb58`.
- 프로젝트 전용 retro skin/픽셀값을 공통화하는 것이 아니라 **semantic token-role + effective-style + actually-used selector + CI fail** 메커니즘만 일반화한다.
- 상세: `docs/research/A_SESSION_DISCOVERY_FP_SETTLEMENT_UI_CONFORMANCE_2026-09-19.md`.


## 2026-09-19 Vehicle Master identity/provenance backport

- Direction: **Core > Project**
- Project revision: `vehicle-master@233115fb1daf9f17ba58a4fae2c30eaaf99b2e8c`
- Breaking impact: **HIGH if IDs are replaced in place**
- Gap:
  - trim ID is generated from mutable trim name;
  - generation/model/manufacturer IDs have mutable-name fallback;
  - powertrain identity includes mutable semantic attributes;
  - export manifest has output version but only coarse source provenance.
- Migration: consumer inventory → immutable canonical ID 추가 → current ID alias 보존 → dual-read Adapter → source/schema/normalizer lineage 추가 → consumer regression.
- Destination: **C**
- 상세: `docs/research/A_SESSION_GAP_VEHICLE_MASTER_IDENTITY_PROVENANCE_2026-09-19.md`.


## 2026-09-19 DevCenter proof-input binding delta

| Candidate | 축 | Evidence | 실제 근거 | 넘길 세션 | 다음 단계 |
|---|---|---|---|---|---|
| `result.proof-input-digest-binding` | Result / Receipt / Evidence | PROJECT_VERIFIED | devcenter | C | SECOND_PROJECT_REQUIRED |

- 근거: `devcenter@6a838a28b3c25b068e5bbe010071fd1de0242d30`, `verify-acceptance.mjs@6178e5fa...`, `card-audit.mjs@59b61085...`.
- AI Core는 revision-bound proof 원칙이 더 넓고, DevCenter는 **source + checker/fixture input digest**로 stale proof를 실제로 판정하는 메커니즘이 더 구체적이다.
- 상세: `docs/research/A_SESSION_DISCOVERY_DEVCENTER_PROOF_INPUT_BINDING_2026-09-19.md`.


## 2026-09-19 DevCenter registry revision binding backport

- Direction: **Core > Project**
- Project revision: `devcenter@6a838a28b3c25b068e5bbe010071fd1de0242d30`
- Gap: `registry.json` source locator entries lack entry-level revision/hash binding.
- Migration: additive revision/hash metadata → stale detection → re-review gate.
- Central stale observation: AI Core `registry/projects.json` still records DevCenter at `132189799a...`; actual observed head is `6a838a28...`.
- Destination: **C / Registry provenance**
- 상세: `docs/research/A_SESSION_GAP_DEVCENTER_REGISTRY_REVISION_BINDING_2026-09-19.md`.
