# Work / Codex — Read This First

## 비상 진입점 — 해당 작업을 계속하기 전에

데이터 훼손·배포/보안 사고·AI 동시 수정·정본 불명확이 의심되면 [비상매뉴얼](docs/EMERGENCY_RUNBOOK.md)을 먼저 읽는다. 해당 작업의 추가 쓰기는 보류하고, 정상 서비스와 다른 작업은 보존한다.

[사고 기록 양식](docs/INCIDENT_TEMPLATE.md)에 확인 사실·미확인·승인·실행·검증을 구분한다. 문서 열람은 실제 작업 중지나 복구 실행을 뜻하지 않으며, 대상 프로젝트의 기존 권한·승인 기준을 대체하지 않는다.

AI Core 작업을 시작할 때 전체 Gmail/전체 Chat/전체 연구 branch를 재독하지 않는다.

## 중요 구조/통합 작업의 AI 협업 규칙

[AI 협업 프로토콜](docs/AI_COLLABORATION_PROTOCOL.md)을 따른다. GPT/Chat의 기획·검토 문서는 절대명령이 아니라 **검토 의견**이며, Codex가 실제 코드·재사용·impact·검증 관점에서 반박/보완하고, Claude가 사용자 결정·현재 정본·Codex 기술 검토를 함께 읽고 실제 구현안을 확정한다.

중요 작업은 원칙적으로 `GPT Review → Codex Technical Review → Claude Implementation → Proof/Review` 흐름으로 남긴다. AI 이름보다 최신 사용자 결정, 현재 프로젝트 정본, revision-bound evidence가 우선한다.

첫 협업 확인은 `COLLAB-P0`: Codex가 현재 AI Core 기획안과 실제 코드 자산을 대조해 `이미 구현 / 재사용 가능 / 미구현 / 충돌`로 나누고 기술 검토를 GitHub에 남기는 것이다. 그 결과를 Claude가 읽고 실제 구현 범위를 정한다.

## 비상 기능 구현을 이어받는 경우

클로드 등 구현 담당은 [비상 기능 구현 인계서](docs/CLAUDE_EMERGENCY_HANDOFF.md)를 읽고 첫 작업 `EMG-P0`부터 진행한다. [검증 시나리오](docs/EMERGENCY_ACCEPTANCE_TESTS.md)는 통과해야 할 요구사항이지 이미 통과한 결과가 아니다. 운영 쓰기·자동 복구·전역 차단은 이번 문서 인계만으로 허용되지 않는다.

## 본사·자회사 통합을 이어받는 경우

통합 작업 담당은 [그룹 운영 모델](docs/GROUP_OPERATING_MODEL.md) → [AI Core 그룹 통합 마스터 기획안](docs/AI_CORE_GROUP_MASTER_PLAN.md) → [클로드 통합 인계서](docs/CLAUDE_GROUP_INTEGRATION_HANDOFF.md) 순서로 읽는다.

마스터 기획안은 “어떻게 만들 것인가”에 대한 GPT의 구현 기획/검토안이다. 사용자 확정 구조 원칙은 `GROUP_OPERATING_MODEL.md`이고, 실제 구현 전 Codex 기술 검토와 대상 프로젝트의 현재 정본을 대조한다.

첫 실행은 `GROUP-G0`: 실제 GitHub/로컬 현황과 기존 공통 자산을 inventory하고 `docs/handoffs/GROUP-G0-RESULT.md`를 남기는 것이다. 아직 전체 저장소 이동이나 새 프레임워크 구축부터 시작하지 않는다.

공통 기능은 본사로 정리하되 고유 제품·Git·데이터 SSOT·브랜드·배포는 독립 유지한다. 비상 기능 `EMG-P0`와는 별도 작업이며, 운영 전환·삭제·권한 변경은 이 인계만으로 허용되지 않는다.

## 실제 회사 업무를 AI Core로 처리하는 경우

[AI Core 실제 업무 운영 플레이북](docs/AI_CORE_OPERATING_PLAYBOOK.md)을 읽는다. 사용자의 자연어 오더를 `업무 의미 → 프로젝트/정본 → capability → 실행자 → 승인 경계 → 검증 → 결과/후속`으로 연결한다.

첫 구현은 `OPS-P0`: 실제 주요 업무 20~30개와 자연어 오더 fixture를 읽기 전용으로 inventory하고, 각 업무가 올바른 정본·실행 경로·완료조건으로 route 되는지 확인한다. 저장소/시트/AI 이름을 사용자가 매번 지정하게 만드는 것을 기본 UX로 삼지 않는다.

문서·코드가 만들어진 것과 실제 업무가 끝난 것을 구분하고, Work Result가 AI Core로 돌아와 다음 세션이 이어받을 수 있어야 한다.

## 계속 고도화되는 Chat/CIVILIZATION/DEVKIT 연구를 연결하는 경우

[AI Core Evolution Bridge](docs/AI_CORE_EVOLUTION_BRIDGE.md)와 `memory/RESEARCH_INDEX.md`를 읽는다. 연구 버전이나 테스트 수가 늘었다는 이유만으로 운영 규칙으로 승격하지 않는다.

고도화 결과는 `Research/Chat → Candidate → revision 고정 → 작은 실험 → 실제 업무/프로젝트 evidence → ADOPT/HOLD/REJECT → feedback` 순으로 이동한다. 실제 프로젝트의 상세/원본은 해당 프로젝트에 남기고 AI Core에는 공통 후보·증거 포인터·채택 상태만 남긴다.

첫 연결은 `EVO-BRIDGE-P0`: 최신 연구 포인터와 기존 AI Core 연구 후보를 inventory하고 실제 비운영 Episode에서 왕복 검증 가능한 후보 1~3개만 선택한다.

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
