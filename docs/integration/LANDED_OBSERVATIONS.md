# 그룹에 올라간 일을 AI Core 가 읽는다 — 2026-09-18

대표(2026-09-18): 「통합하는거 하려고 하는건데 잘되나 모르겠다」 → 「제안대로 쓰이게 만들어보자」

## 왜

같은 날 잰 것:

| | |
|---|---|
| AI Core 원장 | **3줄** — 과태료 1건과 방향 승인 1건. 마지막 기록 2026-09-17 23:12Z |
| 2026-09-17 0시(KST) 이후 다섯 저장소 main 커밋 | ai-core 25 · aiops 7 · devcenter 0 · sales 27 · fp4 204 |
| 그중 AI Core 에 남은 것 | **0** |
| 운영 저장소 코드 중 AI Core 를 부르는 곳 | **0** |

관문은 튼튼했고(검사 427) 그 안으로 흐르는 일이 없었다.

**PR 이 아니라 커밋을 읽는 이유** — 같은 기간 병합 PR: aiops **0** · sales **0** · fp4 71 (main 커밋 204).
PR 만 읽으면 대부분을 놓친다. 올라간 것은 커밋이다.

## 쓰는 법

```
npm run work:observe     GitHub 에서 다섯 저장소 기본 갈래 커밋을 읽어 원장 옆에 둔다 (읽기만, ~10초)
npm run work:recent      최근 24시간 무엇이 올라갔나 + 원장 일감이 묶인 뒤 무엇이 들어왔나 (네트워크 없음)
npm run work:recent -- --hours 72 --project aiops --all
```

세션을 시작할 때 «다시 조사하지 말고» 이것부터 읽는다.

## 이것이 아닌 것

- **원장이 아니다.** 일의 상태를 옮기지 않는다. 「올라갔다」는 관측이지 「끝났다」가 아니다.
  원장에 RECEIVED→…→EXECUTED 를 지어 넣으면 안 한 걸음을 한 것으로 만든다.
- **권한을 주지 않는다.** 아무것도 실행하지 않는다. `gh api` GET 뿐이다.
- **정본이 아니다.** GitHub 이 정본이고 이것은 `.local/landed-observations.json` 에 둔, 언제든 다시 만드는 사본이다.

## 지키는 것

- 못 읽은 프로젝트는 **UNKNOWN** — 「올라간 것 없음」과 「못 봤다」는 다르다. 이전 기록을 지우지 않고,
  어디까지 봤는지(`until`)도 앞당기지 않는다.
- `covered_from` — 빈틈 없이 읽은 시작. 요청한 기간을 다 덮지 못하면 「이 수가 전부가 아니다」라고 찍는다.
- 원장 일감이 묶인 리비전이 그 프로젝트에 **없으면** `REVISION_NOT_IN_PROJECT` 로 드러낸다.

무력화 시험 — 다섯 개 안전장치를 하나씩 꺼 봤고 전부 해당 검사만 빨강:
until 앞당김 · 못 본 곳 기록 지움 · 빈틈을 전부로 · 없는 리비전을 그냥 실패로 · head 모양 안 봄.

## ★첫 실측에서 나온 것 — 과태료 일감이 «정본이 아닌» 리비전에 묶여 있었다

```
DIRECTION-001 (aiops, PLANNED)   ★UNKNOWN REVISION_NOT_IN_PROJECT (묶음 c72e081a)
GWATAERYO-001 (aiops, RECEIVED)  ★UNKNOWN REVISION_NOT_IN_PROJECT (묶음 9407c3e8)
```

- `9407c3e8` 은 aiops main 이 아니라 **로컬 aiops 의 push 안 된 옆 갈래** `chore/untrack-wonja-data`
  (2026-09-15) 의 커밋이다. GitHub: `No commit found for SHA` (HTTP 422).
  옛 `registry-refresh` 가 형제 폴더 HEAD 를 읽어 등록부에 찍었고, 그 값으로 묶였다 —
  GPT_REVIEW(08:30)가 경고한 위험이 **실제로 일어나 있었다**. PR #65 가 그 길을 막는다.
- `c72e081a` 는 **ai-core** 커밋인데 aiops 일감에 묶였다.
- 그래서 [첫 실제 방향 실행](FIRST_REAL_DIRECTION_RUN.md)의 `LINKED | HOLD` 는 정본이 아닌 리비전 위의 결과다.

원장은 덧붙이기만 한다. 고치려면 새 사건으로 정본 리비전(aiops main `8738e446…`)에서 다시
관측해 적어야 하고, 그것은 **사람이 정할 일**로 남긴다 — 여기서 원장에 쓰지 않았다.

## 운영 투영도 이 관측을 읽는다 (2026-09-18)

운영 투영(`/api/orders/:id/work`)은 프로젝트 head 를 **커밋된** `registry/projects.json` 에서 읽었다.
그 파일은 저장소가 움직일 때마다 낡았고, 낡은 값이 「프로젝트가 안 움직였다」로 읽혔다.

이제 원장 옆 `landed-observations.json` 이 등록부보다 **더 새로 본** 관측이면 그 head 를 쓴다
(`새head입히기`). 같은 저장소 · 같은 기본 갈래 · OBSERVED · 40자 SHA 일 때만 섞는다.
관측이 없으면 예전과 같고, 깨져 있으면 `WORK_SOURCE_UNREADABLE_LANDED` 로 선다.

★그래서 과태료 오더는 이제 정직하게 `SUBJECT_REVISION_STALE` 로 선다 — 묶인 리비전이 main 이 아니었으니
맞는 답이다. 다시 흐르려면 #67(REOBSERVED)로 정본 head 에서 재관측해야 한다.
