# Auth / Security / Audit Cross-Repo Findings — A 세션 — 2026-09-19

상태: **INPUT_TO_SECURITY_STANDARD / NOT_CANONICAL**

## 외부 기준

- NIST SP 800-63-4 (2025 final) — identity / authentication / federation
- RFC 9700 — OAuth 2.0 Security Best Current Practice
- OWASP ASVS / Cheat Sheet guidance
- OWASP Logging / Secrets Management guidance

## 1. Authentication과 Actor를 분리

Admin의 좋은 패턴:

```text
Auth Adapter
  ↓
ActorProvider.requireActor()
  ↓
ActorRef { id, type }
  ↓
Domain / Service
```

Domain은:
- cookie
- Firebase token
- OAuth token
- session format

을 모른다.

Core 후보:
- AuthN provider
- Actor/Principal
- AuthZ context

분리.

## 2. Authorization = role 하나가 아니다

ERP4가 가장 잘 잡은 식:

```text
role × organization × data scope × action
```

예:
- role: agent
- org: agent_channel_code
- record scope: agent_uid
- action: contract.progress.update

Core AuthZ 후보:

```json
{
  "principal_id": "...",
  "role_ids": [],
  "org_id": "...",
  "scopes": [],
  "action": "...",
  "resource": {
    "type": "...",
    "id": "...",
    "owner_org_id": "..."
  }
}
```

UI에서 버튼 숨김은 편의.
최종 enforcement는 server/rules/repository boundary.

## 3. 인증 식별자와 표시코드 분리

ERP4 교훈:
- `auth.uid` = 인증 식별
- `user_code` = 표시/검색용

Core:
- authentication_subject_id
- business_user_code
- display_name

을 분리.

email/이름/사번을 인증 PK처럼 사용하지 않는다.

## 4. 조직 귀속은 생성 후 보호

계약/채팅 등:
- 담당자 UID
- 조직 code
- provider company

를 생성 후 일반 수정으로 바꾸지 않음.

인계/transfer는 별도 privileged action + audit.

Core 후보:
- ownership fields immutable by default
- reassignment transition
- before/after owner
- approver/reason

## 5. Action Risk Classification

AIOps의 행위등급이 전사적으로 매우 좋은 후보.

예:
- local
- reversible external add
- protected / irreversible

Core는 이름을 일반화할 수 있다.

후보:
- READ_ONLY
- LOCAL_MUTATION
- REVERSIBLE_EXTERNAL_MUTATION
- PRIVILEGED_MUTATION
- IRREVERSIBLE_EXTERNAL_ACTION

각 등급에:
- approval count
- human approval
- independent review
- TTL
- emergency override
- rollback

을 명시.

## 6. Approval은 exact subject에 bind

AIOps의 강점:

승인은:
- 계획 hash
- artifact/template hash
- target set hash
- command hash
- count
- expiry

에 묶임.

즉 “어제 승인했으니 오늘도 됨” 금지.

Core approval envelope 후보:

```json
{
  "approval_id": "...",
  "action_class": "...",
  "subject_revision": "...",
  "plan_digest": "...",
  "target_digest": "...",
  "artifact_digest": "...",
  "command_digest": "...",
  "approved_by": "...",
  "approved_at": "...",
  "expires_at": "..."
}
```

## 7. Self-review 금지 / Separation of Duties

AIOps:
- executor 자기검토 금지

Core 후보:
- requester
- reviewer
- approver
- executor

독립성 requirement를 risk profile에 포함.

모든 업무에 무조건 4명이 필요하다는 뜻은 아님.

## 8. Emergency Override

좋은 점:
- 긴급우회 가능 범위를 등급별로 제한
- protected는 emergency로도 못 열 수 있음
- 짧은 TTL
- exact command/target binding

Core 후보:
- emergency override 허용 여부는 policy
- always audited
- reason mandatory
- short expiry
- non-overridable actions 지원

## 9. Audit Log에 PII 복제 금지

ERP4의 PII scrub가 중요한 사례다.

감사로그 목적:
- 누가
- 언제
- 무엇을
- 어떻게 바꿨는가

이지 민감 원문 복제가 아니다.

Core:
- sensitive field registry
- before/after masking
- secret/token/password never log
- document/signature raw data never audit-copy
- value 대신 “changed”만 남길 수 있음

## 10. Domain Event / Security Audit / Telemetry 분리

세 목적을 한 로그에 섞지 않는다.

### Domain Event
업무 사실

### Security/Audit
행위자·권한·변경 추적

### Telemetry
성능·장애·운영 관측

각각 retention/access/redaction 정책이 다르다.

## 11. Audit Immutability

AIOps:
- append-only
- hash chain
- 별도 ledger cross-check

이건 high-risk audit profile 후보.

모든 로그에 blockchain 같은 구조를 강제할 필요는 없지만:
- append-only
- tamper evidence
- immutable sink
- external retention

중 risk에 맞는 수준을 선택.

## 12. Audit Criticality

세 등급 후보:

### TELEMETRY_BEST_EFFORT
로그 실패가 업무를 막지 않음

### REQUIRED_AUDIT
업무 성공과 audit persistence를 transaction/outbox로 결속

### EVIDENTIARY
법적/금전/권한 변경
- stronger immutability
- retention
- integrity proof
- restricted read

JPK의 fire-and-forget audit는 첫 등급에는 가능하지만 protected mutation에는 부족.

## 13. Secret Management

Core 후보:
- source code plaintext secret 금지
- secret store / environment injection
- secret name만 config에
- rotation path
- revoke path
- least privilege
- scoped service account
- prod/stg/dev 분리
- secret value log 금지
- repository history exposure는 별도 incident

AIOps의 gitignored local secret은 hardcode보다 낫지만,
전사 표준으로는 managed secret store를 우선.

## 14. OAuth / Federation

OAuth 사용하는 제품은 RFC 9700 BCP를 기준으로 삼고
프로젝트마다 과거 insecure flow를 재발명하지 않는다.

Core가 OAuth를 자체 구현하지 않는다.

권장:
- vetted provider/library
- PKCE where applicable
- redirect URI strict match
- token leakage 방지
- bearer token log 금지
- refresh/revocation lifecycle

세부 적용은 Auth Adapter profile.

## 15. Identity Assurance

NIST 800-63-4를 회사 로그인 전체에 기계적으로 강제하지 않는다.

대신:
- 고객 일반 로그인
- 직원 내부 시스템
- 관리자
- 결제/법적서명/고위험행위

별 risk profile에서 authentication assurance를 정의.

즉 “모든 로그인 MFA” 같은 단일값보다 risk-based profile.

## 16. Firebase / DB Rules

ERP4/Sales에서 강하게 검증된 교훈:
- client UI 권한 != DB 권한
- emulator negative test
- 공개 create/read 범위 최소화
- deprecated collection write를 실제 rules에서 닫음
- create/update/delete를 분리해 허용

Core QA profile:
- allow case
- deny case
- cross-org case
- inactive user
- legacy role
- overwrite/delete negative control

## 17. Data Projection Security

ERP4 bridge 사례:
- public response에서 원가/VIN/계좌/private fee 제거
- role별 server projection

Core 후보:
- full entity를 받아 UI에서 숨기지 않음
- server-side projection
- least-data response

## 18. Account Lifecycle

최소:
- ACTIVE
- DISABLED
- SUSPENDED/LOCKED 필요 여부
- invitation/pending
- role/org reassignment

퇴사/이동은 과거 record ownership을 조용히 rewrite하지 않는다.

## 19. Security Release Gate

ERP4의 좋은 점:
- code done != production security proof
- candidate rules와 production rules 구분
- emulator + preview smoke + role account smoke
- dependency/security findings
- fail-closed release

Core 후보:
- security gate profile
- rules/config diff
- secrets scan
- dependency scan
- authz negative tests
- preview proof
- production readback

## 20. Security Contract P0

1. Principal / Actor schema
2. AuthN Adapter
3. AuthZ = role×org×scope×action
4. resource ownership
5. action risk class
6. approval envelope / TTL / exact-subject binding
7. separation of duties
8. PII/secret audit-redaction
9. audit criticality
10. secret lifecycle
11. account lifecycle
12. DB/Storage rules negative test
13. public/private projection
14. security release gate

## 한 줄 결론

> **본사 보안 규격은 “누가 로그인했나”보다 “누가 어떤 조직·범위에서 어떤 행위를 어떤 승인과 증거로 할 수 있고, 그 흔적을 얼마나 민감정보 없이 남기는가”를 통일해야 한다.**
