# Build / Deploy / Governance Cross-Repo Findings — A 세션 — 2026-09-19

상태: **INPUT_TO_BUILD_DEPLOY_GOVERNANCE_STANDARD / NOT_CANONICAL**

## 목적

AI Core 본사 규격의 마지막 축인 Build / Deploy / Governance에 실제 프로젝트에서 검증된 패턴과 외부 표준을 공급한다.

이 문서는 프로젝트별 배포 명령·도메인·클라우드 설정을 AI Core로 복제하지 않는다.
공통으로 가져갈 것은 **품질 게이트·revision proof·버전·변경정책·복구·폐기 규칙**이다.

## 외부 기준

### Semantic Versioning 2.0.0
공개 API가 존재하는 공통 capability/package는 SemVer를 기본 후보로 한다.

- MAJOR: backward incompatible public API
- MINOR: backward-compatible functionality / deprecation
- PATCH: backward-compatible bug fix
- released version의 내용은 같은 버전으로 다시 덮어쓰지 않음

### SLSA 1.2
공급망 보안/출처 증거의 기준축.
특히:
- source provenance
- build provenance
- hosted/hardened build
- artifact provenance verification

AI Core는 처음부터 최고 레벨 준수를 선언하지 않고 **incremental adoption profile**로 사용한다.

### NIST SSDF
현재 최종본인 SP 800-218 v1.1을 secure SDLC 기준으로 사용한다.
SP 800-218 Rev.1 / SSDF 1.2는 현재 draft이므로 final baseline으로 오인하지 않는다.

### SBOM
CycloneDX / SPDX 계열을 artifact/dependency inventory 후보로 본다.
프로젝트마다 새 SBOM 포맷을 만들지 않는다.

---

## 1. Merge / Build / Deploy / Production은 서로 다른 상태

ERP4에서 실제로 검증된 핵심:

```text
SOURCE_COMMITTED
→ CI_VERIFIED
→ BUILD_CREATED
→ DEPLOYMENT_READY
→ PRODUCTION_OBSERVED
→ RELEASE_VERIFIED
```

금지:
- main merge = 배포 완료
- deploy platform READY = 운영 반영 완료
- preview 정상 = production 정상

Core invariant 후보:

```text
expected_revision == observed_production_revision
```

이 일치가 없으면 운영 완료를 주장하지 않는다.

---

## 2. 프로젝트는 자기 배포 정본을 소유한다

AI Core가 소유:
- release proof schema
- 공통 gate
- evidence level
- rollback requirement
- version/deprecation policy

각 프로젝트가 소유:
- Vercel/Firebase/Cloud Run 등 target
- domain
- deploy command
- project/account/credential binding
- environment-specific runtime config

즉 본사는 **배포 방법을 복제하지 않고 배포가 됐다는 증명 방식을 통일**한다.

---

## 3. CI에 연결되지 않은 검사기는 없는 것과 같다

ERP4에서 반복적으로 확인된 교훈.

검사기가 파일로 존재해도:
- PR/push gate에서 실행되지 않으면 회귀를 막지 못함.
- 검사기 목록과 실제 workflow를 대조하는 manifest가 필요.

Core 후보:

```json
{
  "check_id": "contract.schema",
  "required": true,
  "command": "...",
  "scope": "...",
  "negative_control": "...",
  "reason_if_manual": null
}
```

규칙:
- required checker는 CI에서 실제 호출되어야 함
- manual-only면 이유 필수
- disabled/skip은 PASS가 아님
- known-bad/negative-control로 검사기가 결함을 잡는지 검증

---

## 4. CI gate를 계층화

### Fast gate
PR마다:
- schema
- typecheck
- lint
- unit
- contract
- static policy

### Integration gate
- adapter/repository
- rules emulator
- migrations dry-run
- browser flow
- cross-project contract

### Release gate
- full build
- security checks
- migration readiness
- preview smoke
- rollback candidate

### Post-deploy gate
- production revision readback
- health/readiness
- critical smoke
- error spike check

모든 검사를 PR마다 무조건 돌릴 필요는 없지만, 어느 gate에 속하는지는 정본으로 선언한다.

---

## 5. Reproducible / Pinned Build

본사 후보:
- runtime version pin
- lockfile
- dependency resolution reproducible
- package manager version/profile
- build command explicit
- environment inputs declared
- build artifact ↔ source revision provenance

금지:
- 중요한 공통 capability를 `latest`로 자동 추종
- production build에서 암묵적 local state 사용
- unpinned external script/CDN을 build 핵심에 사용

SLSA 관점에서는 artifact가 **어떤 source/revision/build에서 나왔는지** 추적 가능해야 한다.

---

## 6. Shared capability adoption

AI Core 그룹 모델과 일치하는 규칙:

```text
Common capability version/revision
       ↓ pin
Project adoption record
       ↓ verify
Project release
```

프로젝트가 기록할 것:
- capability id
- adopted version/revision
- compatibility range
- adoption date
- verification evidence
- rollback version

공통 규격이 바뀌었다고 모든 프로젝트가 즉시 latest로 바뀌지 않는다.

---

## 7. Versioning — 세 종류를 분리

### Package / Capability Version
SemVer 후보.

### API / Contract Version
breaking contract를 표현.

### Deployment / Build Revision
commit SHA / immutable release ID.

예:

```json
{
  "capability_version": "2.3.1",
  "contract_version": "1.2",
  "source_revision": "git-sha",
  "build_id": "...",
  "deployment_id": "..."
}
```

이 다섯 개를 하나의 `version` 문자열로 뭉개지 않는다.

---

## 8. Environment Standard

최소:
- LOCAL / DEV
- TEST or CI
- STAGING/PREVIEW where applicable
- PRODUCTION

모든 프로젝트가 반드시 staging을 가져야 한다는 뜻은 아니다.
대신 environment가 **명시적**이어야 한다.

환경변수 contract:
- key name
- required/optional
- secret 여부
- scope
- environment availability
- default 허용 여부
- validation

`.env.example`에는 비밀값을 넣지 않는다.

Production/Preview env 차이는 값 노출 없이 **존재·구성 차이**를 검사 가능해야 한다.

---

## 9. Configuration vs Secret

Config:
- 공개 가능
- versioned 가능
- runtime behavior

Secret:
- credential/token/private key
- source repo 금지
- secret manager/env injection
- rotation/revocation

같은 `.env` 파일에 있다고 같은 정책을 쓰지 않는다.

---

## 10. Deployment Concurrency / Lock

ERP4 production workflow의 좋은 패턴:
- production release concurrency group
- cancel-in-progress 정책 명시

Core 후보:
- same environment production deployment serializes
- stale deployment가 최신 release를 덮지 못하게 함
- deploy request는 exact revision에 bind
- privileged environment approval optional profile

---

## 11. Migration Standard

Schema/data migration은 일반 코드 배포와 분리해서 계약해야 한다.

필수 후보:
- migration id
- source schema version
- target schema version
- forward plan
- rollback / forward-fix strategy
- dry-run
- affected count
- backup/snapshot
- idempotency
- resume/checkpoint
- compatibility window
- verification query

금지:
- UI 배포와 destructive migration을 같은 “완료”로 처리
- migration 성공을 row count만으로 단정
- source/target 양쪽을 동시에 SSOT로 오래 유지

---

## 12. Backward Compatibility

변경은 분류한다:
- additive
- compatible behavior change
- deprecation
- breaking

공통 capability/API는 public contract를 먼저 선언해야 SemVer를 의미 있게 쓸 수 있다.

Core 후보:
- compatibility test fixture
- consumer contract test
- minimum supported version
- migration window

---

## 13. Deprecation Contract

SemVer 원칙과 결합.

필수 후보:
- deprecated item
- replacement
- deprecated_since
- target removal version/date
- affected consumers
- migration guide
- runtime warning/telemetry where useful

Deprecation 선언만 하고 삭제시점을 모르게 두지 않는다.

---

## 14. Retirement / Removal

Project/capability/API 제거는 별 lifecycle.

후보:
```text
ACTIVE
→ DEPRECATED
→ READ_ONLY
→ RETIRED
→ REMOVED
```

조건:
- consumer inventory
- traffic/usage 확인
- data/archive policy
- replacement verified
- rollback/restore decision
- final removal evidence

레거시 파일이 존재한다고 current authority를 갖는 것도 아니고,
사용하지 않는다고 바로 삭제하는 것도 아니다.

---

## 15. ADR / Decision Record

전사 규격 변경에는 최소:
- decision id
- date
- context
- decision
- alternatives
- consequences
- supersedes / superseded_by
- related contract/revision

가 있어야 한다.

ADR 형식을 특정 프레임워크에 강제할 필요는 없지만,
**왜 이 규격이 생겼는지와 무엇이 대체됐는지**는 기계적으로 추적 가능해야 한다.

---

## 16. Exception Registry

공통 표준을 예외 없이 강제하면 결국 몰래 우회가 생긴다.

Exception 후보:
```json
{
  "exception_id": "...",
  "standard_rule": "...",
  "project_id": "...",
  "reason": "...",
  "risk": "...",
  "approved_by": "...",
  "created_at": "...",
  "expires_at": "...",
  "replacement_plan": "..."
}
```

원칙:
- 예외는 문서화
- scope 제한
- expiry 권장
- permanent exception은 Product Profile로 승격 여부 검토

---

## 17. Governance Promotion Lifecycle

A 세션이 이미 쓰는 구조를 공식 후보로 정리:

```text
DISCOVERED
→ CANDIDATE
→ PROJECT_VERIFIED
→ CROSS_PROJECT_VERIFIED
→ COMMON_ADOPTED
→ DEPRECATED
→ RETIRED
```

각 전이에 evidence가 필요.

금지:
- 문서 작성 = adopted
- 한 프로젝트 성공 = 전사 표준
- 최신 research = current policy

---

## 18. Change Authority

공통 표준 변경은:
- 표준 owner
- affected projects
- compatibility impact
- required reviews
- migration needs
- version bump
- rollout strategy

를 결정.

프로젝트 로컬 implementation은 프로젝트 authority가 소유한다.

AI Core는 중앙 규격을 이유로 프로젝트 고유 업무로직을 무승인 강제 변경하지 않는다.

---

## 19. Rollout Strategy

공통 변경은 후보:
1. Shadow
2. Pilot
3. Opt-in adoption
4. Multi-project verification
5. Default for new projects
6. Existing project migration
7. Old version deprecation/removal

Big-bang 강제 전환을 기본값으로 하지 않는다.

---

## 20. Rollback

release 완료조건에 rollback을 포함.

최소:
- previous known-good revision
- rollback command/path
- data compatibility
- migration reversal or forward-fix
- rollback trigger
- rollback proof

“Git revert 가능”만으로 데이터/배포 rollback이 보장된다고 보지 않는다.

---

## 21. Artifact / Supply-chain Evidence

후보:
- source revision
- dependency lock
- build provenance
- artifact digest
- SBOM
- build environment
- builder identity
- deployment id

SLSA/CycloneDX/SPDX를 참고해서 기존 표준을 재사용.

모든 작은 내부 정적 페이지에 최고 수준 attestation을 즉시 요구하는 게 아니라 risk profile에 따라 적용.

---

## 22. Project Starter Governance

새 프로젝트 최소셋 후보:
- PROJECT.md
- AGENTS.md
- project.json / capsule
- docs/SSOT.md
- docs/DECISIONS.md
- docs/HANDOFF.md
- docs/RELEASE.md
- contracts/
- tests/
- .env.example
- CI workflow
- release proof entrypoint

중요:
**템플릿 파일이 있는 것과 실제 값이 채워져 검증된 것은 다르다.**

---

## 23. Existing Project Adoption

AI Core Group Operating Model의 좋은 절차:

1. register
2. classify
3. preserve original
4. baseline verify
5. declare authority/SSOT
6. align structure
7. extract common candidates
8. isolate adapters
9. reverify
10. cut over

한꺼번에 refactor하지 않는다.

---

## 24. Documentation Freshness

문서 drift는 코드 버그만큼 위험.

후보:
- source/revision pointer
- last_verified_revision
- superseded marker
- machine check where possible
- docs referenced by runtime gate

ERP4처럼 “매뉴얼이 코드와 어긋났는가”를 CI에 걸 수 있는 항목은 걸어야 한다.

---

## 25. Build / Deploy / Governance P0

1. Build manifest
2. CI checker manifest
3. required/manual/unsupported check classification
4. negative-control requirement
5. source/build/deploy/production state separation
6. production revision proof
7. environment contract
8. capability pin/adoption record
9. SemVer/contract/revision separation
10. migration contract
11. deprecation/removal lifecycle
12. exception registry
13. ADR/decision record
14. rollout/pilot lifecycle
15. rollback contract
16. artifact provenance/SBOM profile
17. project starter requirements
18. existing-project adoption procedure

---

## 외부 근거

- Semantic Versioning 2.0.0
- SLSA 1.2
- NIST SP 800-218 SSDF 1.1 (final)
- NIST SP 800-218 Rev.1 / SSDF 1.2 (draft; tracking only)
- CycloneDX current specification
- SPDX specification family

## 한 줄 결론

> **본사 Governance 규격의 목적은 모든 프로젝트를 같은 저장소·배포방식으로 만드는 게 아니라, 어떤 변경이 어떤 버전·revision·검증·승인·배포·운영증거·롤백을 거쳤는지 누구나 같은 방식으로 판정하게 만드는 것이다.**
