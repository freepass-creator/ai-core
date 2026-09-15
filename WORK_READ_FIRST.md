# Work / Codex — Read This First

AI Core 작업을 시작할 때 전체 Gmail/전체 Chat/전체 연구 branch를 재독하지 않는다.

2026-09-15 최신 작업 방향: 저장소는 분리하고 공통 AI 기능·오더 창구를 AI Core에 모은다. 현재 범위는 [통합 상태](docs/integration/INTEGRATION_STATUS.md)와 `docs/episodes/ORDER-DESK-001.json`을 먼저 읽는다. OrderStore는 접수 기록이며 업무 상태 정본은 work 원장이다. 영속 매핑/outbox 미완은 HOLD다. 아래 기억의 이전 우선순위가 최신 사용자 지시를 덮어쓰지 않는다.

## 기본 진입점

공통 AI 작업은 [공통 시작·패킷 경계](docs/coordination/CROSS_AI_ENTRYPOINT.md)를 먼저 읽는다. 총괄은 기존 중앙 작업/담당을 조회하고 현재 패킷·실행 위치·소유 파일을 제공한다. 조회 결과는 claim/실행 승인이 아니다. 중앙 연결과 실제 claim이 없으면 HOLD로 보고한다.

로컬·서버 작업은 `docs/SHARED_ORDER_EXECUTION.md`의 중앙 연결을 먼저 확인한다. GitHub에서 코드를 받았다고 별도의 업무 DB를 새로 만들지 않는다. `node scripts/orders.mjs meta`의 원장 ID와 현재 오더 요구 버전을 확인한 뒤 작업한다.

1. `MEMORY.md`
2. `memory/CURRENT.md`
3. 현재 Work Packet / 프로젝트 지침
4. 필요한 경우 `memory/CANONICAL.md`
5. 차세대 연구가 직접 관련될 때만 `memory/RESEARCH_INDEX.md`

## 메일 작업 진입

메일 요청이면 계정 탐색·설치·로그인 전에 [기존 도구 연결](memory/TOOL_CONNECTIONS.md)의 Mail connection reuse를 읽고 그곳의 기존 프로필과 도구를 재사용한다. 정상 경로·메타데이터가 확인되면 설치/로그인을 반복하지 않는다. 미확인/모호 계정을 기본 발신자로 선택하지 않는다. 검사기와 연결 정보는 발송 승인이 아니며 실제 메일 본문 조회도 요청 범위 안에서만 한다.

## 상태 경계

- `CURRENT/CANONICAL` = 현재 상속해야 할 압축 기억. 단, 대상 프로젝트 정본/최신 사용자 지시가 우선.
- `RESEARCH_INDEX` = 후보 연구 색인. 자동 채택 아님.
- Gmail = archive/provenance. 기본 작업 시작 시 전체 재독 금지.
- Chat notebook = 연구/판단 기록. 사람에 관한 확정 사실이나 운영 승인으로 해석 금지.

## 반환

Work는 구현 뒤 commit SHA, 실행 명령, 테스트/검증, 실패·생략, 남은 불확실성을 GitHub에 남긴다.
