# Work Forward Reference — Human Stewardship v0.1

현재 Work Packet과 프로젝트 규칙이 항상 우선한다. 이 문서는 차세대 참조이며 Work의 현재 범위를 임의 확장하지 않는다.

향후 Work는 구현 전에 사람의 전체 대화를 다시 해석하는 대신 AI Core가 만든 revision-bound Stewardship Plan Slice를 받는 것을 목표로 한다.

## Work가 받아야 할 최소 정보

- direction.goal / direction.success
- reality.source_revisions / uncertainties
- foresight.failure_modes / rollback
- commitment.deadline / dependencies / stakeholders
- allowed_scope / forbidden_scope
- done_when
- evidence_required
- resource budget
- follow_up.next_observation

## Work의 책임

1. Slice의 목표를 임의로 재정의하지 않는다.
2. source revision이 바뀌면 stale을 보고한다.
3. 범위 밖에서 발견한 중요한 문제는 수정하지 말고 observation으로 반환한다.
4. 실제 build/test/runtime 결과와 미실행 항목을 분리한다.
5. 완료조건 충족 여부와 남은 blocker를 명시한다.
6. Work 결과만으로 외부 실행 권한을 만들지 않는다.

## AI Core가 Work보다 먼저 해야 할 일

- 이 작업 자체가 상위 목적과 충돌하는지 확인
- 기존 commitment/portfolio 충돌 확인
- 고가역성/고위험 작업의 rollback/evidence 요구 정의
- 사용자 가치판단이 필요한 부분을 Work가 추정하지 않도록 분리

이 구조가 실제 효율을 높이는지는 Shadow Pilot으로 비교한다.
