# AI Core

AI Core는 AIOPS, DevCenter와 대상 프로젝트 사이의 판단·계획·검증 원칙을 정리하는 상위 계층이다.

## 현재 `main` 상태

`main`에는 실행 가능한 오케스트레이터가 없다. 현재 정본은 운영 원칙, 압축 기억, 연구 색인과 개발 방향 문서다.

- 시작점: `WORK_READ_FIRST.md` → `MEMORY.md` → `memory/CURRENT.md`
- 현재 우선순위: 다음 적합한 실제 비운영 개발 작업을 `DEV-EPISODE-001`로 관찰
- 실험 양식·집계 후보: PR #19 (`experiment/development-episode-pilot-v0.1`)
- 구현 후보: PR #1 (`feature/orchestrator-v0.1`, v0.4 planning candidate)
- 후속 구현·연구: 채택되지 않은 후보이며 `memory/RESEARCH_INDEX.md`에서만 찾는다.

`node src/cli.mjs`는 `main`에서 실행할 수 없다. `node --test`는 저장소 상태 정합성 검사만 실행하며 오케스트레이터 동작을 검증하지 않는다. 오케스트레이터와 관련 테스트는 아직 병합되지 않은 구현 후보 브랜치에만 있다. PR의 CI 성공은 그 브랜치가 선언한 검사만 실행됐다는 뜻이며, 실제 프로젝트 실행·독립 검증·운영 채택을 증명하지 않는다.

## 현재 원칙

- 대상 프로젝트와 기관별 정본을 복사하지 않고 위치와 revision을 고정한다.
- 연구, 구현, 테스트, 독립 검증, 승인, 실행, 현실 성과를 각각 구분한다.
- 새 문서·파일·테스트 수를 고도화의 증거로 사용하지 않는다.
- 실제 작업에서 관찰된 실패나 낭비가 다음 결정을 바꿀 때만 개선 후보로 삼는다.
- AI Core는 운영 실행 권한을 만들지 않는다.

## 저장소 관계

- `freepass-creator/aiops`: 업무 의미, 운영 실패, 권한·승인 지식
- `freepass-creator/devcenter`: 개발 규격, registry, 재사용 자산과 검사
- 대상 프로젝트: 실제 코드와 실행 결과의 정본
- `ai-core`: 위 계층을 잇는 판단·실험 기록

현재 상태와 다음 행동은 `memory/CURRENT.md`, 연구와 후보 위치는 `memory/RESEARCH_INDEX.md`를 따른다.
