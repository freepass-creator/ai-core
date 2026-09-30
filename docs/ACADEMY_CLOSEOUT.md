# Academy Closeout Gate

Status: `CURRENT / EXECUTABLE`

## 목적

AI Core 사관학교의 시작 게이트가 `academy:start`라면 종료 게이트는 `academy:closeout`이다.

작업 종료 시 다음 셋을 구분한다.

1. **업무 결과** — 무엇을 바꿨고 무엇을 검증했는가.
2. **학습 사건** — 사용자 수정, 재작업, false completion이 실제로 있었는가.
3. **채택 권한** — 교훈 후보가 생겼다는 사실과 공통 규칙 채택은 별개다.

## 실행

```powershell
npm run academy:closeout -- --work-result <WORK_RESULT.md>
npm run academy:closeout -- --work-result <WORK_RESULT.md> --episode <episode.json>
```

## WORK_RESULT 필수 계수

`WORK_RESULT.md`에는 아래 값이 숫자로 확정되어야 한다.

- `사용자 수정`
- `재작업`
- `false completion`

`UNKNOWN`을 0으로 바꾸지 않는다.

셋 중 하나라도 1 이상이면 `학습환류: EPISODE`가 필요하다.
`NONE`으로 종료하려 하면 `LEARNING_EPISODE_REQUIRED`로 HOLD한다.

## Episode가 있을 때

Episode는 기존 `academy:feedback` 경로를 그대로 사용한다.

- Feedback Packet이 HOLD면 closeout도 HOLD.
- WORK_RESULT의 대상 revision과 Episode subject revision이 다르면 HOLD.
- Lesson Candidate가 만들어져도 자동 채택하지 않는다.

항상:

- `auto_adopted=false`
- `execution_authorized=false`

## 왜 이렇게 하는가

문서 한 줄에 “다음부터 조심”이라고 적는 것은 학습이 아니다.
실전에서 수정·재작업이 있었으면 그 사건을 비식별 Episode로 남기고,
다음 comparable Episode에서 실제로 줄었는지를 봐야 한다.
