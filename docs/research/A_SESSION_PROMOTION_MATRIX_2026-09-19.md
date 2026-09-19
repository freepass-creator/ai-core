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
