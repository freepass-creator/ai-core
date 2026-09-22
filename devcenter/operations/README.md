# operations — Development Center Control Plane

상태: 7개 Hub를 관장하는 **Control Plane**의 운영 경로. 별도 Hub가 아니다. 실행 기능 구현·검수 완료가 아니다.

- `intake-dispatch`: 요청·범위 정리와 AI 배정
- `progress-handoff`: run ID 기반 진행 조회·인계. 기록 원본은 runs

파트를 활성화할 때 책임자·입출력·원본 참조·실행 진입점·완료 기준을 명시한다. 기존 원본은 이동·복제하지 않는다.
