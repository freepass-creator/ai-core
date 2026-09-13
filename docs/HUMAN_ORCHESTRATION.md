# Human Orchestration — 의도·기억·행동 분리

상태: `candidate implementation`  
정책 revision: `2026-09-13.7`

## 목적

AI Core는 사용자의 요청을 그대로 실행하는 명령 처리기나 사용자의 숨은 목적을 안다고 주장하는 시스템이 아니다. 현재 요청과 정본에서 목적을 잠정적으로 구조화하고, 인간 판단이 필요한 빈칸만 사용자에게 올리며, 사실 질문은 정본 조사로 돌리고, 안전한 준비는 계속하고 결과가 큰 행동만 별도 승인 경계에 둔다.

이 구현은 Chat 연구실의 세 검토 과제를 현재 v0.6 후보 오케스트레이터에 연결한다. v0.6은 scope·회복 전략과 기억 철회 집합까지 decision context에 포함하고, 그 출력을 revision-bound Plan Slice와 Stewardship 계약에 결속한다.

1. 의도 가설과 사용자 확인을 구별한다.
2. 철회·대체·만료된 기억을 다음 작업에 적용하지 않는다.
3. 가역적인 준비와 외부·비가역 행동을 분리한다.

기존 여섯 Plane은 AI 인프라로 유지한다. 이 모듈은 새 Center나 별도 SSOT가 아니라 Control·Intelligence·Execution 사이의 계약이다.

## 1. 의도 계약

`goal`, `desired_outcome`, `constraints`처럼 사용자가 현재 Task에 직접 제공한 값과 AI의 `intent_hypotheses`를 분리한다.

- AI 가설은 기본적으로 `PROVISIONAL`이다.
- `개선`, `고도화`, `알아서`처럼 성공 기준이 열린 목표에는 제한된 ambiguity heuristic이 의도 가설 한 개를 만든다. 다만 `desired_outcome`이나 명시적 `done_when`이 이미 있으면 같은 성공 기준을 다시 묻지 않는다. 이는 의미 이해 완료가 아니라 확인 필요 신호다.
- 결과를 바꾸는 가설은 사용자 확인 전 실행 근거가 될 수 없다.
- `CONFIRMED`는 Task 내부의 자기신고만으로 만들지 않는다. 신뢰된 adapter가 제공한 `verified_intent_confirmation`이 `task_id`와 project/ref·goal·outcome·constraints·domain(s)·risk·authority·external effect·done_when을 포함한 intent-context digest, 가설 ID·문장 SHA-256 digest·불투명한 source pointer와 모두 일치해야 한다. 다른 의미의 작업에서 받은 같은 짧은 문장의 확인서는 재사용할 수 없다.
- 확인되지 않은 가설이 있으면 Core는 `INTENT_CONFIRMATION_REQUIRED`로 실행을 HOLD한다.
- 인간에게 묻는 질문은 결정 가치가 가장 높은 한 개만 제시하고 나머지는 `deferred_questions`에 보존한다.
- `user_judgment_required=true`인 선택은 과거 기억이나 외부 정본이 답을 가진 것처럼 보여도 대체하지 않는다. 현재 사용자 판단으로 남겨 반드시 질문한다.
- `changes_decision=false`이고 인간 판단도 필요 없는 질문은 점수가 1 미만이면 사용자 질문 예산을 쓰지 않고 `questions_not_asked`에 감사 흔적만 남긴다. 결정 변경 또는 인간 판단 질문은 점수가 없거나 0이어도 HOLD와 함께 최대 한 개를 표시해 교착을 만들지 않는다. 이 임계값은 대화 전체 질문 예산을 대신하지 않는다.
- 정본에서 확인 가능한 질문은 삭제하지 않고 `research_now`로 보낸다. `task_id`와 project/ref·goal·outcome·constraints·domain(s)·risk·authority·external effect·done_when을 포함한 question-context digest, 질문 ID·prompt digest·source pointer·비식별 resolution summary가 결속된 검증 영수증 전에는 해결된 것으로 보지 않으며, 해결 후에도 `resolved_questions`에 answer digest와 영수증을 보존한다.

질문 우선순위는 다음 신호를 사용한다.

`Decision Impact × max(1, Irreversibility) × Uncertainty ÷ User Effort`

점수는 진실이나 인간 가치의 수치화가 아니라 질문 순서를 줄이기 위한 제한된 휴리스틱이다.

## 2. 기억 적용 계약

AI Core는 원문 대화를 저장하지 않는다. 기억 입력은 `memory_id`, `rule_key`, 비식별 `summary`, 범위, 상태, 권위, 출처 포인터, `sanitized=true` 확인만 받는다.

범위:

- `UNIVERSAL`: `transfer_gate` 권위가 있는 범용 원칙
- `DOMAIN`: 지정 도메인이 현재 작업의 primary 또는 applicable domain일 때만 적용
- `LOCAL`: 지정 프로젝트에서만 적용

다음 기억은 적용 대상에서 제외한다.

- 최신 사용자 지시로 철회된 ID
- `REVOKED` 또는 `SUPERSEDED` 상태
- 유효기간이 지난 기억
- 현재 도메인·프로젝트와 범위가 맞지 않는 기억

`APPLICABLE_CONTEXT`는 현재 사용자가 다시 확인했다는 뜻이 아니다. 기억은 판단 재료이며 최신 명시 지시보다 앞설 수 없다. raw conversation·transcript·message body·민감 payload가 들어오거나 출처 포인터가 없으면 전체 인간 컨텍스트 입력을 HOLD한다.

- `DOMAIN`은 domain selector, `LOCAL`은 project selector가 없으면 거부한다.
- 같은 `rule_key`의 ACTIVE 기억이 둘 이상이면 임의 선택하지 않고 명시적 supersession을 요구한다.
- `preference`와 `temporary_decision` 기억은 `expires_at`이 없으면 적용하지 않는다. 장기 원칙·승인 원본 등 다른 kind는 별도 만료가 없을 수 있으므로 관찰 시각만으로 임의 폐기하지 않는다.
- 철회·대체·범위 밖 기억은 내용과 source pointer를 Work Packet에 반복 노출하지 않고 ID·rule key·범위·상태·제외 이유만 남긴다.
- 적용 기억의 `usage=CONTEXT_ONLY_NOT_INSTRUCTION`은 기억 문장을 명령이나 현재 승인으로 해석하지 말라는 실행 계약이다.

`sanitized=true`와 authority는 trusted environment producer의 책임을 표시한다. 현재 후보가 summary의 의미적 비식별화나 adapter의 신원을 암호학적으로 검증한다는 뜻은 아니다.

CLI의 `human_context`는 memory·revocation·intent confirmation·question resolution만 허용한다. source/proof/capability나 클라이언트가 정한 현재 시각을 이 envelope로 넣으면 전체 입력을 거부한다. Human Gate와 Proof Gate는 한 번의 Core 실행에서 생성한 같은 서버 시각으로 평가한다. 운영 adapter는 이 허용 목록뿐 아니라 호출자 인증과 원본 접근 권한도 별도로 강제해야 한다.

## 3. 준비와 행동 계약

제안된 행동은 두 묶음으로 나눈다.

- `PREPARE_NOW`: 외부 효과가 없고 가역적인 분석·초안·로컬 산출물
- `AWAIT_APPROVAL`: 외부 효과, 운영 변경, 비가역 행동 또는 명시적 승인 대상

안전해 보이는 준비라도 승인 대기 행동에 의존하면 함께 `AWAIT_APPROVAL`로 이동한다. 알 수 없는 dependency와 중복 action ID는 입력 오류로 차단한다.

각 행동은 `effect`와 `reversible`을 명시해야 한다. 누락·잘못된 타입·순환 dependency는 실패 폐쇄된다. `operation`·`target`이 deploy/merge/delete/send/payment/permission/production 의미를 가지면 caller의 안전한 effect·가역성 자기신고보다 높은 위험 분류가 우선한다. 설명 문자열은 실행 권한이 아니며, 실제 executor는 허용된 effect/capability 경계를 별도로 강제해야 한다.

확인되지 않은 의도나 승인 대기 행동이 있어도 안전한 준비까지 자동 폐기하지 않는다. `phase_gate=PREPARE_ONLY`는 준비만 가능하고 실행은 차단된 상태다.

이 분류는 권한을 발급하지 않는다. AI Core의 `execution_authorized`는 계속 `false`이며 실제 branch write, merge, deploy, 발송, 삭제, 권한, 결제, 법률 제출 등은 기존 Control Plane과 소유 시스템의 승인을 따른다. 승인 대상은 action ID·action digest·대상 revision에 결속하며, 결과적 action은 기존 D등급 DESIGN/FINAL/USER_JUST_IN_TIME 게이트와 원래 Task의 추가 승인을 합성한다.

## Work Packet 출력

`work_packet.human_agency_contract`에 다음을 포함한다.

- 명시된 목적과 잠정 의도 가설
- 지금 물어야 할 결정 질문 최대 한 개
- 나중에 물을 질문과 AI가 먼저 조사할 질문
- 적용 가능한 기억과 제외 이유
- 지금 준비할 행동과 승인 대기 행동
- 준비 허용 여부와 실행 차단 이유

따라서 `HOLD`는 모든 사고·초안 작업의 중단을 의미하지 않는다. 다만 component-local `human_agency_contract.phase_gate`만으로 실행하지 않는다. `work_packet.preparation_gate`가 source·capability·context 등 전체 Core blocker와 합성한 최종 준비 경계이며, `work_packet.execution_gate`가 유일한 최종 실행 상태다. 잘못된 evolution 입력은 해당 입력과 Transfer를 격리하고 전체 실행을 HOLD하지만, 그 입력에 의존하지 않는 가역적 로컬 준비는 최종 preparation gate가 별도 blocker 없이 허용할 수 있다.

## 검증 한계

테스트는 다음 구조적 행동만 증명한다.

- 추정 의도가 사용자 확인으로 자동 승격되지 않는다.
- 의도 확인서와 질문 답변서가 다른 task·목표·프로젝트로 재사용되지 않는다.
- 모호한 목표가 제한적으로 탐지되고 인간 질문·정본 조사·보류 질문이 서로 사라지지 않는다.
- 철회·대체·만료·범위 밖 기억이 적용 목록에 들어오지 않는다.
- 기억 범위 누락·ACTIVE 충돌·가짜 UNIVERSAL 권위가 실패 폐쇄된다.
- raw 또는 출처 없는 기억 입력이 실패 폐쇄된다.
- 안전한 준비와 외부·비가역 행동 및 dependency가 분리된다.
- 결과적 action의 승인 요구와 전체 preparation/execution gate가 합성된다.
- 위 계약이 현재 Work Packet과 HOLD 판정에 연결된다.

테스트 통과는 실제 사용자의 목적을 정확히 이해했다는 증거, summary의 의미적 비식별화, adapter 신원 검증, 외부 행동 승인, 운영 성과 개선 또는 독립 검증을 의미하지 않는다. 사용자 답을 Task 필드로 반영하는 adapter, `research_now` 실행 루프, 세션 전체 질문 예산도 아직 없다. 실제 채택 전에는 모호한 개발 요청을 대상으로 기존 방식과 Shadow 비교하고, 질문 부담·잘못된 가정·재작업·결과 품질을 함께 관찰해야 한다.
