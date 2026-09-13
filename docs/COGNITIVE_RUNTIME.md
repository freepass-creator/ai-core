# Cognitive Runtime — revision-bound handoff

상태: `candidate implementation`  
계약 revision: `2026-09-13.4`

## 목적

AI Core는 긴 대화 전체를 다음 실행자에게 넘기지 않는다. 현재 결정을 바꾸는 최소 정보의 후보만 `Plan Slice`로 투영하고, 그 투영을 Task·대상·정본·capability·의사결정 컨텍스트·행동 그래프·게이트 revision에 결속한다. Shadow 실증 전에는 이를 decision-complete라고 부르지 않는다.

Plan Slice는 정본도 명령도 권한도 아니다. 현재 v0.6은 발행 저장소, 서명, 전송 주체 인증이 없는 비운영 후보이므로 실행자 검토용 구조화 계약만 만든다.

## 기존 구조와의 관계

연구 PR의 Invariant Kernel, Goal Graph, World State, Task Graph, Decision Ledger, Evidence Index, Outcome Stream, Learning Queue를 별도 시스템으로 복제하지 않는다.

- 목적과 완료조건: 기존 Task와 `requirement_set`
- 정본 상태: 기존 source/capability revision set
- 행동 그래프: 기존 `proposed_actions` DAG
- 결정 근거: 확인된 intent·해결된 question·적용/철회 memory·선택된 failure/decision의 digest
- 증거: 기존 Domain Proof Contract
- 학습: 기존 Conversation Learning과 Evolution Kernel

v0.6에서 추가한 최소 단위는 `Plan Slice`, caller-managed `Runtime Head`, basis 비교에 의한 invalidation, `Work Return` 구조 검사다.

## Plan Slice

`work_packet.plan_slice`는 다음을 포함한다.

- 불투명 `slice_id`, 별도 `attempt_id`, 발행·만료 시각
- task/project/ref/base subject revision, authoritative project source에서 유도한 exact `owner/repo` identity와 secret-pattern 검사된 목적
- 명시적 allowed/forbidden scope와 일반 constraint의 분리
- text digest에 결속된 requirement fingerprint와 source/capability revision set
- 확인된 의도·질문·기억·실패·결정의 ID/fingerprint만 담은 decision-context digest
- target·operation·effect·가역성·dependency·write scope·revision·audience에 묶인 action-context digest
- preparation/execution gate와 미해결 gap
- Portfolio/Foresight/Follow-through의 최소 digest·상태 projection
- disclosure scan 상태와 redacted field path
- 구조적 Work Return 계약과 고정된 필수 binding field 집합
- `authorization=NOT_GRANTED`

전체 대화, 원문 memory summary, 전체 Human Agency Contract는 Slice에 복사하지 않는다.

사람이 쓴 목적·완료조건·행동 설명에서 알려진 secret 패턴이 발견되면 원문을 `[REDACTED:<digest-prefix>]`로 바꾸고 `DISCLOSURE_REVIEW_REQUIRED`로 handoff를 막는다. 이 검사는 제한된 패턴 검사이지 개인정보 분류나 완전한 DLP가 아니다.

`plan_projection_digest`는 basis 자체를 제외하고 실행자에게 보이는 Plan projection 전체를 묶는다. 목적·의사결정 ID·gate·stewardship·disclosure·action·lifecycle 표현을 바꾼 뒤 바깥 해시만 다시 만든 Slice는 원래 current snapshot과 일치할 수 없다. `slice_digest`는 `slice_digest`와 signature 필드를 제외한 canonical JSON payload의 SHA-256이다. 두 해시 모두 내용 일관성 검사일 뿐 발행자 인증이나 서명이 아니다.

## 범위 규칙

`constraints`와 `allowed_scope`는 다른 개념이다. `배포 금지` 같은 constraint를 허용 범위로 뒤집지 않는다.

- 행동이 있으면 `allowed_scope`를 명시해야 한다.
- 각 행동은 정확한 `target`과 `operation`을 가져야 한다.
- 외부 handoff action은 authoritative project source에서 유도한 repository identity를 가져야 한다. 프로젝트 없는 local workspace의 산출물 identity·revision 계약은 아직 없으므로 그런 action은 `TARGET_REPOSITORY_IDENTITY_UNRESOLVED`로 사전 차단한다.
- v0.6이 자동 준비로 인정하는 operation은 canonical concrete scope를 가진 `read:path:<file>`, `write:path:<file>`, `patch:path:<file>`뿐이다. wildcard, traversal, 절대경로, 금지·허용범위 밖 path는 계획 생성 전에 차단한다.
- test/build/deploy/send/delete 같은 다른 operation은 trusted capability-to-operation mapping이 아직 없으므로 로컬이라고 자칭해도 자동 준비로 인정하지 않는다.
- operation의 verb와 exact target 의미가 선언된 effect/reversibility보다 위험하면 더 높은 위험 경계가 우선한다. 파일명의 `deploy`, `send`, `payment` 같은 단어는 operation verb로 오인하지 않는다.
- `forbidden_scope`가 항상 allowed scope보다 우선한다.
- Return의 변경 scope는 wildcard가 아닌 canonical concrete path여야 하며 `..`, percent encoding, 역슬래시, 절대경로, 중복 구분자를 거부한다.
- 누락되면 `SCOPE_UNRESOLVED` 또는 `ACTION_TARGET_OR_OPERATION_UNRESOLVED`로 실행을 HOLD한다. 독립적인 내부 가역 준비는 별도 preparation gate에서 허용될 수 있지만 불완전한 Slice를 외부에 넘기지는 않는다.

## Invalidation

다음 basis 중 하나라도 달라지면 이전 Slice는 `STALE`이며 handoff는 `BLOCKED`다.

- task contract와 requirement set
- base subject revision
- source/capability revision set
- proof policy revision
- 확인된 의도·질문·적용 또는 철회 기억·선택된 failure/decision
- action graph
- preparation/execution gate
- blocker set
- stewardship contract
- Plan contract revision
- 만료 시각

`Runtime Head`는 stale Slice ID tombstone, task/project/exact repository identity, active basis digest, 최신 Slice 발행시각 high-water mark, 전환 reason code와 선택적인 one-way reason digest를 보존한다. raw 사용자 사유는 Head에 복사하지 않는다. 다른 task/project/repository의 Slice와 high-water mark보다 오래된 Slice는 같은 chain을 교체할 수 없다. 최초 생성과 교체 모두 `issued_at <= now < expires_at`을 만족해야 한다. active Slice 자체가 만료되고 새 snapshot이 아직 없으면 그 정확한 Slice만 `REPLAN_REQUIRED`로 무효화할 수 있으며, 만료된 다른 snapshot이나 replacement는 받지 않는다. 의미가 같은 새 발행도 `plan_projection_digest`가 달라지며 명시적 supersede reason이 있어야 하고, Head에는 그 one-way digest만 남긴다. `ACTIVE_CANDIDATE → REPLAN_REQUIRED → ACTIVE_CANDIDATE` 전이는 generation과 이전 state ID, stale tombstone을 보존한다. 입력이 과거 값으로 되돌아와도 예전 Slice를 부활시키지 않고 새 ID와 generation으로 다시 컴파일한다. 다만 v0.6 Runtime Head는 caller가 보관하는 비신뢰 구조일 뿐 서버 정본이 아니다.

## Work Return

`evaluateWorkReturn`은 외부 도구를 호출하지 않는 순수 구조 검사기다.

검사 가능한 것:

- strict shape, unknown/raw field, payload 크기, duplicate JSON key
- return과 Slice의 task/slice/attempt/audience/target/basis exact binding
- 계획 밖 action, dependency/effect/action digest 변조
- canonical allowed/forbidden scope 이탈과 traversal/wildcard 결과
- 산출물의 exact `owner/repo` target·각 action operation의 exact concrete path·결과 revision 불일치
- read action이 changed scope, changed artifact, 새 end revision을 주장하는 모순
- action 전체 coverage, dependency와 단일 결과 revision
- 시작 revision과 base revision 불일치
- 검사 0회, failure, skip, 증거 누락, requirement fingerprint 불일치
- 발행 전·미래 시각, 만료, caller가 제공한 최신 snapshot과 stale basis

검사할 수 없는 것:

- 이 Slice가 실제 Core가 발행한 최신 generation인지
- nonce가 이미 사용되거나 취소됐는지
- worker·audience·verifier의 실제 신원
- branch ancestry와 현재 head
- source/capability/approval/evidence의 실제 존재와 최신성
- 현실 결과와 외부효과

현재 snapshot을 제공하지 않으면 Return은 `CURRENT_SNAPSHOT_MISSING`으로 거부한다. 같은 Return의 원자적 단일 소비는 아직 없으므로 `replay_checked=false`다. 따라서 v0.6은 Return 재사용을 완전히 차단한다고 주장하지 않는다.

각 action result의 `start_subject_revision`과 `end_subject_revision`은 action 하나가 만든 revision이 아니라 같은 Work Return batch의 시작·최종 revision이다. 그래서 read→write DAG의 read 결과도 최종 revision에 증거를 결속할 수 있지만 changed scope와 changed artifact는 비어 있어야 한다. batch에 구체적인 write/patch 변경 증거가 하나도 없는데 최종 revision만 달라졌다고 주장하면 거부한다.

따라서 정상 구조의 Return도 다음 상태를 넘지 않는다.

- `validation_scope=STRUCTURAL_ONLY`
- `trust=UNAUTHENTICATED`
- `acceptance=HOLD_TRUSTED_ADAPTER_REQUIRED`
- `proof_accepted=false`
- `task_completed=false`
- `outcome_observed=false`
- `execution_authorized=false`

## 운영 전 필요한 다음 계층

운영 수락은 다음이 모두 구현된 뒤에만 가능하다.

1. 서버가 보관하는 issued Slice와 현재 generation
2. attempt nonce의 만료·취소·단일 소비를 원자적으로 관리하는 저장소
3. 서명 또는 동등한 발행자 인증
4. worker/audience transport identity
5. dispatch 직전과 return 직전 trusted adapter의 head/source/capability/policy 재조회
6. 허용된 revision transition/patch ancestry 검증
7. 결과 revision에 묶인 proof 재검증
8. action별 실제 grant와 approval receipt

이 계층이 없으면 `READY_FOR_EXECUTOR_REVIEW`와 `REVIEW_READY`도 실행 가능 상태가 아니라 검토 가능한 계획 후보라는 뜻이다. 행동이 없는 직접 답변의 handoff는 `NOT_REQUIRED`다.
