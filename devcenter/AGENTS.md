# AI Core DevCenter module instructions

이 디렉터리는 AI Core 내부의 개발 실행 조직이다. 모든 작업 규칙과 협업 AI 정책은 먼저 루트 `../AGENTS.md`, `../docs/AI_WORKING_STANDARD.md`, `../docs/AI_ACADEMY_CURRICULUM.md`를 따른다. 이 파일은 별도 헌법·정족수·AI 역할을 만들지 않는다.

## 작업 시작

1. 루트 `academy:start` receipt에서 목적·정본·재사용·검증을 고정한다.
2. Hub 조직은 `../registry/hubs.json`, Primary/Secondary 라우팅은 `../registry/work-map.json#hub_routes`만 사용한다.
3. UI/UX는 `../docs/UI_UX_START_HERE.md`와 `../registry/design-hub-binding.json`에서 시작한다.
4. 프로젝트 고유 업무 규칙과 데이터를 이 모듈로 복제하지 않는다.
5. 구현 후 프로젝트 검사와 필요한 Quality/Delivery 증거를 남긴다.

기본 협업 AI는 루트 정책에 따라 Codex와 Claude Code다. 과거 Cursor/Gemini/4-AI 기록은 당시 실행 증거이며 현재 정족수나 필수 호출 규칙이 아니다.

## 모듈 경계

- `design/`, `hubs/`, `scripts/`, `quality/`는 실행 방법과 검증 도구를 보유한다.
- 공통 규칙의 값은 루트 `docs/`, `design-system/`, `contracts/`, `registry/`가 소유한다.
- DevCenter 문서에 숫자·토큰·역할 규칙을 다시 정의하지 않는다. 고유 방법론은 루트 정본에 종속된 실행 노하우로 유지한다.
- 모르는 정본, 충돌, 미지원 상태는 HOLD하며 다른 프로젝트나 과거 사본으로 추정하지 않는다.
