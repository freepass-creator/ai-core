# Work / Codex — Read This First

AI Core 작업을 시작할 때 전체 Gmail/전체 Chat/전체 연구 branch를 재독하지 않는다.

2026-09-15 최신 작업 방향: 저장소는 분리하고 공통 AI 기능·모든 오더의 처리 상태를 AI Core에 모은다. 현재 오더 데스크는 `docs/ORDER_GUIDE.md`와 `docs/episodes/ORDER-DESK-001.json`을 읽고, `node scripts/orders.mjs list`로 실제 원장을 확인한다. 아래 기억의 이전 우선순위가 최신 사용자 지시를 덮어쓰지 않는다.

## 기본 진입점

로컬·서버 작업은 `docs/SHARED_ORDER_EXECUTION.md`의 중앙 연결을 먼저 확인한다. GitHub에서 코드를 받았다고 별도의 업무 DB를 새로 만들지 않는다. `node scripts/orders.mjs meta`의 원장 ID와 현재 오더 요구 버전을 확인한 뒤 작업한다.

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
