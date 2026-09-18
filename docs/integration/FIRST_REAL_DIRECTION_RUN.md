# 방향이 «진짜 자료» 위에서 처음 흘렀다 — 2026-09-18

> ★정정(2026-09-18 오후): 아래 `LINKED | HOLD` 는 **정본이 아닌 리비전** 위에서 나왔다.
> 과태료 일감이 묶인 `9407c3e8` 은 aiops main 이 아니라 push 안 된 로컬 옆 갈래 커밋이었다.
> 근거와 실측: [LANDED_OBSERVATIONS.md](LANDED_OBSERVATIONS.md). 본문은 고치지 않고 둔다.

대표(2026-09-17): 「선언하기 전에는 멈춘다가 아니고 네가 자동으로 흘러가야지.
그 흘러가는 방향을 내가 설정하는 거고」

지금까지 방향은 **검사 안에서만** 흘렀다. 스냅샷도 매핑도 고정물(fixture)이었다.
2026-09-18 에 처음으로 **저장소의 진짜 등록부·진짜 원장·진짜 오더 DB** 위에서 흘렸다.

## 무엇을 돌렸나

```
npm run registry:refresh                         등록부의 리비전을 지금 체크아웃에서 다시 읽는다
npm run work:record -- --work GWATAERYO-001 …     아이옵스의 과태료 일을 원장에 올린다
npm run control:snapshot                         원장+등록부에서 스냅샷 뼈대를 뽑는다
npm run orders:sources                           네 원천이 다 읽히는지 본다
npm run orders:bind -- --order ORD-6201c18b… …    오더를 그 업무에 묶는다
GET /api/orders/:id/work                         투영을 읽는다
```

## 나온 것 (MEASURED)

```
status: LINKED | control: HOLD
execute.enabled: false
막는 이유: ["WORK_STATE_RECEIVED"]
execution_authorized: false
```

★사람이 «항목마다» 선언해야 했던 넷 — `CONTROLLING_INTENT_UNCONFIRMED` ·
`COMMITMENT_NOT_ACTIVE` · `COMMITMENT_CONTROL_INCOMPLETE` · `AUTHORIZATION_REQUIRED`
· `MATERIAL_OBSERVATION_EXPIRED` — 가 **전부 사라졌다**. 대표가 갈래마다 한 번 세운
방향이 그 값을 공급했기 때문이다.

★남은 하나 `WORK_STATE_RECEIVED` 는 **결함이 아니라 경계**다. 「이 일이 어디까지
갔나」는 원장이 말하는 사실이고, 방향이 그것까지 열면 «일을 안 했는데 다 한 것으로»
만들 수 있다. 방향은 여기서 멈춘다.

## 가는 길에 드러난 것

- **등록부 다섯 프로젝트의 `head_revision` 이 전부 낡아 있었다.** 그래서 첫 묶기가
  `SUBJECT_REVISION_STALE` 로 막혔다. 손으로 고치면 또 낡으므로
  `scripts/registry-refresh.mjs` 를 만들었다 (`--check` 로 CI 에서 낡음만 볼 수 있다).
- **스냅샷을 규약 자리에 두는 한 줄이 없었다.** `derive-control-snapshot.mjs` 는
  stdout 으로만 뱉어서 매번 손으로 리다이렉트해야 했다 — 그건 아무도 안 쓴다는 뜻이다.
  `scripts/control-snapshot-refresh.mjs` 가 원장 자리·등록부·as-of 를 규약으로 못 박는다.

## 아직 아닌 것

- 원장·스냅샷·오더 DB 는 `.local/` 에 있어 커밋되지 않는다. 다른 장치에서는 승인근거가
  없어 HOLD 다 — **닫힌 쪽으로 실패하는 것이 맞는 기본값이다**.
- 이 투영은 아이옵스 엔진을 **부르지 않는다**. 「지금 무엇이 허가됐나」를 읽을 뿐이다.
  실제 실행을 이 판정에 물리는 것은 다음 걸음이고, 벽(관청발송·문서24업로드)은 그대로다.

## 정정 — `registry-refresh` 가 «정본» 을 읽지 않았다 (2026-09-18)

위 「가는 길에 드러난 것」 첫 줄을 정정한다. GPT_REVIEW(2026-09-18 08:30, PR #29) 지적이 맞았다.

- 처음 판은 `../<project_id>` **형제 폴더의 HEAD** 를 읽었다. 다른 갈래·낡은 체크아웃이면
  그 SHA 가 정본처럼 찍혔고, ai-core 는 registry 의 `local_path` 와 다른 폴더를 읽었다.
  이제 registry 의 `repository + default_branch` 로 **원격 ref 를 직접**(`git ls-remote`) 본다.
- `--check` 는 못 본 프로젝트를 성공으로 넘기지 않는다 — exit `0` 새것 · `1` 낡음 · `2` UNKNOWN.
- 「CI 에서 낡음만 볼 수 있다」는 **틀린 말이었다.** CI 에 걸려 있지 않았고, 걸지도 않는다 —
  다른 저장소가 앞서 나갈 때마다 ai-core 가 빨개지고, hosted runner 는 비공개 저장소를 못 봐
  늘 UNKNOWN 이다. 묶기 직전에 사람이·AI 가 돌린다.

★실측(같은 날): 원격 기준으로 다섯 프로젝트가 **다시 전부 낡았다**. 갱신한 등록부 사본으로
과태료 오더를 읽으면 `LINKED|HOLD` 가 `SUBJECT_REVISION_STALE` 로 바뀐다 — aiops 가 묶은 뒤
앞서 나갔기 때문이다. 그래서 이 정정은 **등록부 값을 올리지 않는다.** 올리는 순간 그 업무는
새 리비전에서 다시 관측·묶어야 한다(설계대로다 — 결정은 리비전에 묶인다).
