# Chat ↔ Work Handoff Protocol v0.1

AI Core에서 ChatGPT 채팅과 Work/Codex를 번갈아 사용할 때의 기본 인수인계 규격이다.

## 목적
- 같은 설명을 반복하지 않는다.
- 채팅과 Work가 같은 파일을 동시에 수정하지 않는다.
- 작업 상태를 GitHub가 기억하게 한다.
- Work가 구현/실행에 집중하고, ChatGPT는 요구·SSOT·검토에 집중한다.

## 기본 역할

### ChatGPT / AI Core
- 사용자 목표 해석
- AIOPS/DevCenter/프로젝트 SSOT 확인
- UI/UX·업무 로직·완료조건 확정
- 소규모 GitHub 수정
- Work Packet 생성
- Work 결과 diff/증거 재검토

### Work / Codex
- 지정 branch checkout
- repo 전체 탐색
- 의존성 설치
- build/typecheck/test
- runtime debug
- 허용 범위 내 구현/수정
- commit/push
- WORK_RESULT 기록

## 절대 규칙
1. 같은 작업에서 ChatGPT와 Work는 **같은 branch의 같은 파일을 동시에 수정하지 않는다**.
2. 인수인계 순간에는 `STATUS.json`의 `owner`를 바꾼다.
3. Work가 시작하면 ChatGPT는 그 branch에 구현 commit을 추가하지 않는다. 검토/요구 변경은 별도 review note 또는 새 branch로 남긴다.
4. Work가 끝나면 commit SHA와 검사 결과를 남기고 `owner=chat_review`로 돌린다.
5. 사용자는 결과를 복사해 채팅에 붙이지 않아도 된다. GitHub task ID/PR/branch만 알려주면 된다.
6. 완료 상태를 `DESIGNED / IMPLEMENTING / IMPLEMENTED / TESTED / REVIEWED / MERGE_READY / MERGED / DEPLOYED / OUTCOME_VERIFIED`로 구분한다.
7. `TESTED`는 `REVIEWED`가 아니고, `MERGED`는 `DEPLOYED`가 아니다.

## 작업 폴더

각 실제 프로젝트에서 권장:

```text
.ai-core/tasks/<TASK-ID>/
  TASK.md
  SOURCES.json
  WORK_PACKET.json
  ACCEPTANCE.md
  STATUS.json
  WORK_RESULT.json
```

## Chat → Work

ChatGPT가 넘기기 전에 최소한 다음을 고정한다.
- task id
- 대상 project/repo
- base/head revision
- 목표와 비목표
- 수정 허용/금지 범위
- SSOT/source pointers
- DevCenter capability pointers
- 완료조건
- 실행할 검사
- 배포/운영 여부

`STATUS.json`:

```json
{
  "phase": "DESIGNED",
  "owner": "work",
  "handoff_from": "chat",
  "handoff_revision": "<sha>",
  "next_action": "implement_and_test"
}
```

Work에 줄 최소 명령:

> `<TASK-ID>`의 `.ai-core/tasks/<TASK-ID>/`를 읽고 지정 branch에서만 구현한다. 범위를 넓히지 말고 build/test/debug를 수행한다. 끝나면 WORK_RESULT.json과 commit SHA를 남기고 STATUS owner를 chat_review로 변경한다.

## Work → Chat

Work는 다음을 남긴다.
- 시작 SHA / 종료 SHA
- 변경 파일
- 실행 명령
- 테스트/빌드 결과
- 실패/생략
- scope 변경 여부
- 남은 위험
- 추천 다음 행동

`STATUS.json`:

```json
{
  "phase": "TESTED",
  "owner": "chat_review",
  "handoff_from": "work",
  "handoff_revision": "<work-commit-sha>",
  "next_action": "requirements_and_ssot_review"
}
```

ChatGPT는 종료 SHA의 diff를 기준으로 요구사항·SSOT·DevCenter 규격을 재검토한다. 수정이 필요하면 새 Work Packet revision을 발행한다.

## 충돌 처리

- Work 작업 중 사용자가 요구를 바꾸면 기존 Work를 조용히 덮지 않는다.
- `SCOPE_CHANGED`로 표시하고 새 task revision을 만든다.
- Work가 이미 수정한 파일을 ChatGPT가 바꿔야 하면 Work 종료 후 새 branch/revision에서 수행한다.
- 긴급하지 않으면 rebase/merge를 작업 중간에 자동 수행하지 않는다.

## 사용량 최적화

- GPT_DIRECT: bounded design / docs / 소규모 명확한 변경
- WORK_CODEX: repo 탐색·build·test·dependency·runtime debug·대규모 회귀
- LOCAL_REQUIRED: 클라우드 재현 불가
- HUMAN_GATE: 운영/배포/권한/삭제/결제/중요 외부 실행

AI Core의 목표는 Codex를 적게 쓰는 것이 아니라 **Codex가 필요한 구간에서만 높은 밀도로 쓰이게 하는 것**이다.
