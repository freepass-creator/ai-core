# Work / Codex — Read This First

## 비상 진입점 — 해당 작업을 계속하기 전에

데이터 훼손·배포/보안 사고·AI 동시 수정·정본 불명확이 의심되면 [비상매뉴얼](docs/EMERGENCY_RUNBOOK.md)을 먼저 읽는다. 해당 작업의 추가 쓰기는 보류하고, 정상 서비스와 다른 작업은 보존한다.

[사고 기록 양식](docs/INCIDENT_TEMPLATE.md)에 확인 사실·미확인·승인·실행·검증을 구분한다. 문서 열람은 실제 작업 중지나 복구 실행을 뜻하지 않으며, 대상 프로젝트의 기존 권한·승인 기준을 대체하지 않는다.

AI Core 작업을 시작할 때 전체 Gmail/전체 Chat/전체 연구 branch를 재독하지 않는다.

## 비상 기능 구현을 이어받는 경우

클로드 등 구현 담당은 [비상 기능 구현 인계서](docs/CLAUDE_EMERGENCY_HANDOFF.md)를 읽고 첫 작업 `EMG-P0`부터 진행한다. [검증 시나리오](docs/EMERGENCY_ACCEPTANCE_TESTS.md)는 통과해야 할 요구사항이지 이미 통과한 결과가 아니다. 운영 쓰기·자동 복구·전역 차단은 이번 문서 인계만으로 허용되지 않는다.

## 본사·자회사 통합을 이어받는 경우

통합 작업 담당은 [그룹 운영 모델](docs/GROUP_OPERATING_MODEL.md)의 확정 방향과 [클로드 통합 인계서](docs/CLAUDE_GROUP_INTEGRATION_HANDOFF.md)를 읽는다. 첫 작업은 `GROUP-P0`: 현황 조사·기존 registry 정리·원형 보존형 비운영 자회사 하나 파일럿이다. 공통 기능은 본사로 정리하되 고유 제품·Git·데이터 SSOT·브랜드·배포는 독립 유지한다. 비상 기능 `EMG-P0`와는 별도 작업이며, 운영 전환·삭제·권한 변경은 이 인계만으로 허용되지 않는다.

## 기본 진입점

1. `MEMORY.md`
2. `memory/CURRENT.md`
3. 현재 Work Packet / 프로젝트 지침
4. 필요한 경우 `memory/CANONICAL.md`
5. 차세대 연구가 직접 관련될 때만 `memory/RESEARCH_INDEX.md`

## 상태 경계

- `CURRENT/CANONICAL` = 현재 상속해야 할 압축 기억. 단, 대상 프로젝트 정본/최신 사용자 지시가 우선.
- `RESEARCH_INDEX` = 후보 연구 색인. 자동 채택 아님.
- Gmail = archive/provenance. 기본 작업 시작 시 전체 재독 금지.
- Chat notebook = 연구/판단 기록. 사람에 관한 확정 사실이나 운영 승인으로 해석 금지.

## 반환

Work는 구현 뒤 commit SHA, 실행 명령, 테스트/검증, 실패·생략, 남은 불확실성을 GitHub에 남긴다.
