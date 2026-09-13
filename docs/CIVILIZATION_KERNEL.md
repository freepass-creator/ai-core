# CIVILIZATION KERNEL — AI Core 최상위 진화 구조

상태: `candidate`  
기준 지시: 2026-09-13 사용자 직접 지시

## 1. 존재 목적

AI Core는 AIOPS와 DevCenter를 단순히 조회하는 라우터가 아니다. 실제 업무와 개발 결과를 계속 관찰하고, 사용자가 미리 알지 못했거나 요청하지 못한 결손까지 찾아 두 축과 자기 자신을 함께 고도화하는 최상위 진화기관이다.

AI Core가 더 많은 업무 원문이나 개발 규격을 소유한다는 뜻은 아니다. 정본은 원래 시스템에 남긴다. Core는 현재 revision을 고정하고, 필요한 능력을 조합하고, 결과 증거를 비교하고, 개선 후보를 올바른 소유 시스템으로 돌려보낸다.

## 2. 세 기관의 관계

| 기관 | 핵심 책임 | AI Core가 고도화하는 방식 |
|---|---|---|
| AI Core | 전사·전 프로젝트 판단, 숨은 결손 탐지, 작업·검증·학습 루프, 충돌 중재 | 라우팅·컨텍스트·평가·전파 방식을 개선한다 |
| AIOPS | 업무 의미·기억·권한·승인·실행 절차·실제 성과 | 반복 낭비, 실패, 누락된 업무지식과 불편을 새 SOP·지식 후보로 환류한다 |
| DevCenter | 개발 규격·재사용 자산·검사기·시정·재검사 | 여러 프로젝트에서 반복되는 결손을 공통 capability·검사·부품 후보로 환류한다 |

DevCenter에서 만든 능력은 AIOPS가 실제 업무에 효율적으로 사용한다. AIOPS에서 발생한 실제 성과와 실패는 다시 DevCenter의 다음 개발 우선순위를 만든다. AI Core는 이 왕복을 멈추지 않게 하는 상위 루프다.

## 3. 세 개의 루프

### 작업 루프

`요청 → 의도·위험 판별 → 정본·revision 고정 → capability 조합 → 실행 경로 → 검증 가능한 Work Packet`

### 진화 루프

`결과·실패·낭비 관찰 → 결손 분류 → 개선 후보 → 재현·구현·독립검증 → Transfer Gate → 대상 기관 채택 → 관련 프로젝트 전파 → 성과 재관찰`

### 통제 루프

`원본 변경·충돌·권한 부족·검증 실패·성과 악화 감지 → HOLD 또는 롤백 → 새 revision에서 재검사`

세 루프의 결과가 어긋나면 속도보다 통제 루프가 우선한다.

## 4. 사용자가 요청하지 않아도 확인할 개발 관점

개발 Work Packet에는 최소한 다음 관점을 자동으로 포함한다.

1. 요구사항과 완료 조건의 누락
2. SSOT 위치·revision·중복 규칙
3. 데이터 의미·상태 전이·무결성
4. 보안·개인정보·권한 경계
5. 기존 기능·부품 재사용과 유지보수성
6. 빈값·로딩·실패·권한·동시성 상태
7. 성능·비용·확장성
8. UI 일관성·접근성·모바일 사용성
9. 배포·마이그레이션·롤백·호환성
10. 로그·관찰 가능성·실제 성과 측정

이 목록은 모든 항목을 자동 합격시킨다는 뜻이 아니다. 확인하지 못한 관점은 `미확인` 또는 `HOLD`로 남겨 사용자가 몰랐던 위험을 숨기지 않는 장치다.

## 5. 개선 후보의 귀속

| 발견한 결손 | 기본 귀속 |
|---|---|
| 업무 실패, 반복 수작업, 승인·인계 불편, 업무지식 누락 | AIOPS |
| 공통 기능 부족, 재사용 부품 부재, 검사기 결손, 규격 표류 | DevCenter |
| 잘못된 라우팅, 컨텍스트 누락, 기관 간 충돌, 학습·전파 실패 | AI Core |

비슷해 보인다는 이유만으로 귀속을 바꾸거나 두 정본을 합치지 않는다. 영향 범위와 원본 책임이 불명확하면 후보 상태로 유지한다.

## 6. Transfer Gate

후보는 다음 증거가 모두 고정돼야 `TRANSFER_READY`가 된다.

- 후보가 구조화된 task ID·signal ID와 목적·프로젝트·제약·완료조건·위험·외부효과의 canonical task-context digest를 가지며, gate가 현재 Task의 digest와 다시 대조함
- 대상 프로젝트 revision, source revision set, capability revision set, 검증 정책 revision을 하나의 Transfer-context digest로 고정하고 gate가 현재 trusted context와 다시 대조함
- 프로젝트가 지정된 후보는 비어 있지 않은 대상 프로젝트 revision 없이는 `TRANSFER_READY`가 될 수 없음
- 문제 재현 영수증이 후보 ID·digest·task/Transfer-context digest·candidate revision·재현 대상 revision·실행 횟수·실패/SKIP·근거 포인터에 결속됨
- 후보 본문 digest와 코드·문서 revision이 고정되고 gate에서 digest를 다시 계산함
- 후보 kind와 귀속 기관의 고정 매핑 및 대화 교훈의 routing domain 근거가 candidate digest 안에서 일치함
- 각 검사 영수증이 후보 ID·digest·task/Transfer-context digest·같은 revision에 묶이고, 실행 횟수 1 이상·실패 0·SKIP 0·버전 고정 실행/근거 포인터를 가짐
- 수정한 역할과 다른 독립 검토자가 후보 ID·digest·task/Transfer-context digest·같은 revision을 근거 포인터와 함께 승인함
- 롤백 계획이 후보 ID·digest·task/Transfer-context digest·같은 revision·근거 포인터에 결속됨
- 대상 기관이 후보 ID·digest·task/Transfer-context digest·같은 revision을 근거 포인터와 함께 수용함
- C/D등급이면 해당 승인 주체의 후보·task/Transfer-context digest·revision 결속 승인 영수증이 있음

`TRANSFER_READY`는 채택·배포·운영 실행이 아니다. 대상 저장소 반영과 실제 실행은 그 시스템의 승인 규칙을 다시 따른다.

## 7. 자동화 경계

AI Core는 낮은 위험의 조사·후보 작성·테스트·비교·시정안 생성은 자동화할 수 있다. 그러나 다음은 스스로 권한을 만들어 실행하지 않는다.

- candidate를 검증 없이 authoritative/adopted로 승격
- 운영 데이터·배포·삭제·결제·권한 변경
- C/D 승인 생략
- 실패나 접근 불가를 PASS로 변환
- 사용자의 최신 지시보다 과거 학습을 우선 적용

## 8. 대화 기반 자기 진화

대화에서 나온 지시·수정·실패도 결과 관찰로 취급하되 원문을 Core에 복사하지 않는다. 비식별 규칙 후보와 출처 포인터만 받아 `OBSERVATION → PATTERN → PRINCIPLE → SYSTEM_CANDIDATE`로 성숙도를 분류한다. 충돌은 `HOLD_CONFLICT`, 채택은 기존 Transfer Gate를 그대로 따른다.

개발 외에도 법률·사업·문서·커뮤니케이션에 서로 다른 증명 의무를 부착한다. 전체 규칙과 영수증 계약은 `docs/CONTINUOUS_LEARNING.md`를 따른다.

## 9. 현재 구현 단계

v0.6 candidate는 다음까지만 구현한다.

- 모든 개발 Work Packet에 선제 검토 관점 부착
- 개발·법률·사업·문서·커뮤니케이션별 증명 의무 부착
- 완료조건 ID·digest와 같은 revision에 묶인 검사 영수증 평가
- 작성·검증·승인·실행·성과 상태의 모순 차단
- 비식별 대화 관찰의 정규화·중복 제거·충돌 차단·성숙도 분류
- Live preflight와 외부 observation에서 개선 신호 생성
- 개선 신호를 AI Core/AIOPS/DevCenter로 분류
- 거부된 개선 신호 식별자를 digest로 비식별화하고 같은 ID의 상충 입력까지 격리해 Transfer·전체 실행을 HOLD
- 격리된 개선 입력과 무관한 가역적 로컬 준비는 최종 preparation gate에서 실행과 별도로 판정
- 후보 자동 생성
- Transfer Gate의 task-context·증거·독립검토·승인 검사
- 의도 확인/질문 답변 영수증의 task-context 결속, 범위·철회·만료 기억, 안전한 준비/결과적 행동 분리
- decision-context와 모든 중요 revision에 묶인 최소 Plan Slice, caller-managed Runtime Head와 영구 stale tombstone
- Work Return의 strict 구조·결속·범위 검사. 단 issued store와 trusted adapter가 없으므로 수락·proof·완료로 승격하지 않음
- 관련 commitment만 보는 Portfolio, 조건부 위험 최대 세 개를 보는 Foresight, 실제 binding 없이는 추적을 주장하지 않는 Follow-through

Plan Slice 발행 저장소·서명·transport identity·원자적 nonce 소비, 대상 저장소에 후보를 자동 제출하고 채택 후 여러 프로젝트에 전파하며 실제 성과를 비교해 롤백하는 executor는 후속 단계다.
