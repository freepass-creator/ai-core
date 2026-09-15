# AI Core

AI Core는 AIOPS, DevCenter와 대상 프로젝트 사이의 판단·계획·검증 원칙을 정리하는 상위 계층이다.

## 현재 작업: 공통 AI 오더 데스크

2026-09-15 사용자 요청으로 `work/codex/order-control-v1`에 로컬 오더 접수·담당 배정·공통 AI 인계·처리 이력·결과 확인 기능을 구현했다. 저장소는 분리하고 모든 업무 상태와 공통 처리 기능을 AI Core에 모으는 방향이다. 이름은 임시 **이음**이며 사용자와 상의 중이다.

Node.js 24.19 이상에서 `npm run orders:serve`를 실행하고 `http://127.0.0.1:4318`을 연다. CLI는 `npm run orders -- help`, 검증은 `npm run test:orders`를 사용한다. 사용자가 어떻게 요청하고 다른 AI가 어떻게 이어받는지는 [오더 사용 안내](docs/ORDER_GUIDE.md)에 설명했다.

첫 버전은 이 PC의 영속 원장을 공유하는 **수동 인계 도구**다. AI 자동 호출·외부 실행·여러 PC 동기화·인증된 검토자 증명은 제공하지 않는다. 아래 `main` 설명과 `DEV-EPISODE-001`은 상속한 이전 개발선의 상태이며, 이번 오더 데스크 작업과 별도다.

## 현재 `main` 상태

`main`에는 실행 가능한 오케스트레이터가 없다. 대신 개발 요구를 구조화하고, 검증된 변경만 커밋하며, 저장소 상태와 자기진화 후보를 보수적으로 판정하는 로컬 도구가 있다. 이 도구들은 대상 프로젝트를 대신 실행하거나 배포 권한을 만들지 않는다.

- 시작점: `WORK_READ_FIRST.md` → `MEMORY.md` → `memory/CURRENT.md`
- 개발 양식: `docs/STANDARD_DEVELOPMENT_FORM.md`와 `examples/development-form.json`
- 화면 규격: `docs/SCREEN_DESIGN_STANDARD.md`와 `docs/UI_UX_INVENTORY.md`
- 실행 샘플: `examples/ui-components.html`과 `examples/ui-patterns.html`
- 로컬 도구: 개발 양식 검증, 안전한 체크포인트, 저장소 정합성 검사, 자기진화 후보 평가
- 현재 우선순위: 다음 적합한 실제 비운영 개발 작업을 `DEV-EPISODE-001`로 관찰
- 실험 양식·집계 후보: PR #19 (`experiment/development-episode-pilot-v0.1`)
- 구현 후보: PR #1 (`feature/orchestrator-v0.1`, v0.4 planning candidate)
- 후속 구현·연구: 채택되지 않은 후보이며 `memory/RESEARCH_INDEX.md`에서만 찾는다.

`node src/cli.mjs`는 `main`에서 실행할 수 없다. 다음 명령은 현재 트리에 있는 제한된 개발 도구를 실행한다.

```powershell
npm test
npm run verify
npm run form:validate -- examples/development-form.json
npm run evolve:evaluate -- candidate.json baseline.json trial.json
```

안전한 자동 커밋·push는 대상 프로젝트에 검증 명령을 선언한 뒤 `node scripts/checkpoint-work.mjs`로 수행한다. 사용법과 동시 작업 규칙은 `docs/CONCURRENT_WORK.md`를 따른다. 테스트 성공은 해당 revision에서 선언된 검사만 통과했다는 뜻이며, 실제 프로젝트 실행·독립 검증·배포·운영 성과를 증명하지 않는다.

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
