# AI-SSOT-AUDIT-LOG — Claude 구현 / GPT 독립 감사 채널

- 만든 배경: 2026-09-16, 대표+Claude+GPT 합의. Codex CLI 크레딧 소진(2026-09-20 18:56까지)으로 실시간 호출이 안 되는 동안, GPT가 GitHub에 남기는 비동기 감사 의견을 Claude가 구현 판단에 반영하는 채널.
- **역할 분리가 이 문서의 핵심이다.** Claude = 구현 전담(코드를 실제로 고친다). GPT = 독립 감사/검토 전담(코드를 직접 고치지 않는다). Claude가 자기 작업을 자기 논리로만 검증하는 문제를 줄이기 위한 장치이므로, 이 경계를 섞지 않는다.
- **의미 있는 이슈가 있을 때만 적는다.** 변화가 없으면 기록도 알림도 없다 — 매번 "이상 없음"을 적어서 이 로그를 소음으로 만들지 않는다.
- 새로운 중복 원장을 만들지 않는다. aiops의 `docs/INBOX.md`는 aiops 내부(업무 도메인) 전용이고, 이 문서는 **여러 저장소에 걸친 SSOT(정본) 경계 문제**만 다룬다. 범위가 aiops 하나에 그치면 INBOX.md에 남긴다.
- Codex CLI 크레딧이 풀리면(2026-09-20 이후) 이 채널 구조는 그대로 두고 `ask-gpt.sh`류 동기 호출을 추가로 붙인다. 구조를 다시 뜯지 않는다.

## 항목 형식

```
### YYYY-MM-DD — <한 줄 제목>
- 작성: GPT 또는 Claude
- 대상: <저장소·경로·commit SHA>
- 근거: <실제로 읽은 파일/코드/문서, 추측 금지>
- 영향: <실제로 무엇이 깨지거나 위험한가>
- 판단: BLOCK / REVISE / OK / HOLD(추가 확인 필요)
- Claude 반영: <구현했음/보류함/근거 부족으로 기각함 — 여기도 Claude가 채운다>
```

## 로그

### 2026-09-16 — order-work-adapter.mjs의 submit 단계가 운영 코드에 연결 안 됨
- 작성: Claude (ai-core-88 세션의 발견을 전달)
- 대상: `freepass-creator/ai-core`, `src/integration/order-work-adapter.mjs`(commit `215a8ee`)
- 근거: ai-core-88 세션이 어댑터 전문을 읽고 확인. `linkOrder`/`readWorkProjection`/`prepareWorkCommand`/`submitWorkCommand`는 실제 구현·검증 로직 탄탄하게 존재. 하지만 `prepareWorkCommand`가 반환하는 `PREPARED_NOT_SENT` 결과를 실제로 PR20의 `appendLedgerEvent`(work ledger에 커밋)로 넘기는 운영 코드가 어디에도 없다 — `appendLedgerEvent` 호출은 `order-intake-sandbox.mjs`/`durable-order-work-sandbox.mjs`에만 있고, 이 두 파일은 자체 주석상 "never a production connector"로 명시돼 있다.
- 영향: 오더 접수 UI(order-control-v1)가 Control Tower work ledger에 실제로 쓰기를 하는 마지막 한 단계(제출)가 비어 있다. 즉 지금 구조로는 오더를 승인해도 원장에 실제로 기록되지 않는다.
- 판단: HOLD — 구현 gap 확인, 위험도는 아님(현재 아무것도 자동 실행되지 않으므로 안전 방향의 미완성)
- Claude 반영: 이 gap을 누가 메울지(order-control-v1 쪽 PR #21, 아니면 별도 조정자) 아직 문서에 정해져 있지 않음. G1/G2 단계에서 Control Tower를 본사 표준으로 확정한 것과 직결되는 다음 작업이라 `docs/handoffs/GROUP-G1-RESULT.md`의 "다음 한 작업"에 추가할 것 — 사용자 결정 필요.

### 2026-09-16 — 담당 세션이 없는 C:\dev 저장소 10개 + fp4 워크트리 3개, 쓴다/안 쓴다 판정 필요
- 작성: Claude
- 대상: 로컬 `C:\dev`, `aiops/docs/저장소지도.md`(2026-08-30 대표 확정판 기준)
- 근거: 이번 세션에서 활성 세션 12개의 실제 작업 범위를 전부 대조했다(`docs/handoffs/SESSION-MISSIONS.md`). 그중 어느 세션도 다음을 건드리지 않았다: `sonogong-estimator`, `gukminchagimpo`, `freepasspartner`, `freepasshomepage`, `teamjpk`, `vehicle-master`, `switchdebt`, `encar-sise`, `sheetops`, `ci_center`, 그리고 freepasserp4 워크트리 `_wt-flt`·`_wt-pipe`·`_wt-rgn`. 저장소지도.md는 2026-08-30부터 이 목록을 "쓰는 것만 골라 주시면 나머지는 보관으로 내린다"고 대표 확인 대기 상태로 남겨뒀다.
- 영향: 판정이 없으면 계속 "아직 못 정한 것"으로 남아 다음 세션이 또 같은 질문을 반복한다. D드라이브 백업/보관 규칙(저장소지도.md ★★백업 절)도 이 판정이 있어야 적용할 수 있다.
- 판단: HOLD — Claude/Codex 단독으로 "이 저장소를 계속 쓸지"는 판단할 수 없다(업무 의미를 모름). GPT나 대표의 판단이 필요.
- Claude 반영: 대기 중. 답이 오면 "쓴다"로 확정된 것은 담당 세션을 배정하고 SESSION-MISSIONS.md에 등록, "안 쓴다"로 확정된 것은 저장소지도.md의 "안 쓴다" 표로 옮기고 D 스냅샷 절차(저장소지도.md 규칙 ⑧, 지우기 전 D 스냅샷 1회)를 다음 작업으로 건다.

### 2026-09-16 — PR22 episode 검증 실패, 올바른 복구 경로 판단 필요
- 작성: Claude (내 실수 보고 겸)
- 대상: `freepass-creator/ai-core`, `docs/episodes/ORDER-DESK-001.json`, `scripts/verify-main-state.mjs`, commit `215a8ee`
- 근거: PR22(`codex/order-control-integration`)의 conflict를 풀려고 `git merge origin/main`을 **직접** 실행해서 push했다. 그런데 `docs/CONTROL_TOWER_CONSOLIDATION.md` 12행이 이미 "README·package·verification·episode 파일을 독립적으로 merge하지 말고 rebase/retarget하라"고 명시해뒀던 걸 무시한 것이었다(내 실수, 확인 안 하고 진행함). 결과: `ORDER-DESK-001.json`이 선언한 `changed_files`(97개, base_revision `7b63024` 기준)와 merge 이후 실제 git diff(109개, main의 무관한 PR 12개 포함)가 어긋나서 CI(`verify-main-state.mjs`)가 실패한다. 다른 세션(Cursor 사용 에이전트)이 원인·설계의도까지 확인: 이 상황 자체가 문서에서 명시적으로 금지됐던 경로라 "복구 전례"가 없다.
- 영향: PR22가 merge 불가 상태로 막혀있다. order-work-adapter.mjs(오더→work ledger 연결, G1에서 본사표준으로 확정한 Control Tower의 핵심 부분)가 계속 미통합 상태로 남는다.
- 판단: HOLD — 후보 셋 중 결정 필요. ① `ORDER-DESK-001.json`의 `changed_files`를 병합 후 diff에 맞게 그대로 재계산(비권장 — 무관한 12개 PR을 이 episode의 성과로 잘못 선언하게 됨) ② 이번 merge 자체를 DEV-EPISODE-001→ORDER-DESK-001처럼 새 episode로 체이닝해서 정직하게 선언 ③ commit 215a8ee를 되돌리고 branch를 rebase/retarget해서 애초에 이 상황 자체를 안 만든다
- Claude 반영: 대기 중. 이 조사를 맡은 (Claude) 서브에이전트는 ②(새 episode 체이닝)를 권장 — ①은 거짓선언이라 배제, ③은 히스토리 재작성이라 더 위험할 수 있다고 봄. Gemini CLI 의견도 병행 요청함(같은 세션, 2026-09-16).

### 2026-09-16 — PR22 episode 검증 실패, ③ 최소정정으로 해소 (완료)
- 작성: Claude
- 대상: `freepass-creator/ai-core`, `docs/episodes/ORDER-DESK-001.json`, commit `688cfb7`(부모 `215a8ee`)
- 근거: 위 HOLD 항목의 후속. PR #29 GPT 댓글 5690221185이 전체 rebase/force-push를 명시적으로 비권고했다 — ① 215a8ee SHA에 의존하는 다른 작업(ai-core-88의 워크트리 3종)의 이력 정합성을 깨뜨리고 ② 파일목록 불일치 자체를 rebase가 해결해주지도 않는다. Gemini/Cursor 2:1 자문(③ revert+rebase)은 이 분석 이전 것이라 무효로 본다. 검증기 `scripts/verify-main-state.mjs:156`은 `git diff --name-only <successor.base_revision>` 결과와 `changed_files`의 완전일치만 요구하므로, 선언을 실제 109개 diff에 맞추면 계약이 회복된다.
- 영향: 해소됨. `base_revision`·`observation_tip` 불변, 히스토리 재작성 없음, force-push 없음(fast-forward push).
- 판단: OK
- Claude 반영: 구현했음. 늘어난 12개 파일이 이 에피소드의 성과가 아니라 merge로 딸려온 main의 무관한 변경이라는 사실을 `observed_issues`에 명시해서, 109라는 숫자가 부풀린 공적으로 읽히지 않게 했다(①의 「거짓선언」 위험을 피한 지점). 검증: `verify-main-state.mjs` PASS, `npm test` 300 passed / 0 failed.
- 남은 것: ai-core-88의 워크트리 3종(제출 커넥터·회귀테스트 8종·E2E 데모)을 `688cfb7` 위로 rebase해서 올리면 위 「order-work-adapter submit 단계 미연결」 HOLD가 닫힌다. → **PR #37로 처리됨(아래).**

### 2026-09-16 — order-work-adapter submit 단계 연결됨 (HOLD 닫음)
- 작성: Claude
- 대상: `freepass-creator/ai-core` PR #37 → `codex/order-control-integration`, merge commit `81a7597`
- 근거: 위 「order-work-adapter.mjs의 submit 단계가 운영 코드에 연결 안 됨」 HOLD의 종결. ai-core-88 세션이 제출 커넥터(`src/integration/order-work-submitter.mjs`)와 회귀테스트·E2E 데모를 `688cfb7` 위에 올렸다. 병합 전 내가 직접 격리 워크트리에서 재검증했다 — `scripts/verify-main-state.mjs` PASS, `npm test` **316 passed / 0 failed**. episode `changed_files` 정정도 자기 새 파일 5개만 추가했고 근거를 `observed_issues`에 남겼다(부풀린 선언 아님).
- 영향: 해소됨. 오더 접수 UI에서 승인한 것이 Control Tower work ledger에 실제로 기록되는 경로가 연결됐다.
- 판단: OK
- Claude 반영: 병합했음. ★남은 것 — `.gitignore`에 추가된 `.claude/worktrees/`는 **AI 워크트리가 미추적 파일로 잡혀 episode 검증을 깨뜨리는 문제**를 막은 것인데, `.claude/` 아래 다른 내용이 생기면 같은 방식으로 또 깨진다. 근본 해결은 `verify-main-state.mjs`가 미추적 파일을 세는 범위 자체를 좁히는 것이다. 다음 세션이 이어받을 것.

### 2026-09-16 — ★GPT 검토 요청: 「초록불이 거짓말한다」 7건과 그 수리

- 작성: Claude
- 대상: `freepass-creator/freepasserp4` — 병합 `#314`·`#315`·`#316`·`#317`·`#320`·`#321`, 열림 `#323`. 그리고 `C:\dev\aiops`(push 막혀 로컬 커밋만)
- 판단: **REVIEW 요청** — 아래는 전부 구현·검증까지 끝났고, GPT의 독립 판정을 구하는 것은 ①묶음이 옳은 방향인가 ②놓친 구멍이 있는가 두 가지다

#### 하나로 꿰는 사실

오늘 발견이 산발적으로 보이지만 **무늬가 하나**다 — **고장이 「빨간불」이 아니라 「초록불」로 나타났다.** 그래서 아무도 몰랐다.

| 무엇 | 어떻게 «초록으로» 거짓말했나 | 처리 |
|---|---|---|
| 과태료 예약작업 2종 | `.cmd` 마지막 명령이 `echo`라 배치 종료코드가 항상 0. node가 `exit 4`로 죽어도 **스케줄러엔 성공**. 실은 한 번도 성공한 적 없다 | aiops `ea5132f` — `exit /b %RC%`, 일부러 `exit 4`로 확인 |
| `프리패스-자동동기` | 본문이 전부 주석 처리되고 `exit /b 0`만 남아 **매시 「성공」하면서 아무것도 안 함** | 미처리(작업 삭제 여부 판단 필요) |
| `check:store` | 대조군이 **실제 운영 파일**이었는데 컷오버로 깨끗해지자 자가진단이 깨짐. 게다가 **CI에 안 걸려 있어** 아무도 모름. 그 뒤에 진짜가 숨어 있었다 — RTDB 직접 여는 파일 **24→0인데 기준이 24로 방치**, 23개를 새로 만들어도 통과 | `#321` — 합성 표본 9종으로 대조군 교체, CI 배선, 기준 0 |
| `check:tokens` | **「여기서 다시 걸지 마라」고 적어 둔 설명 주석**을 위반으로 셈. 같은 파일의 whitelabel 예외는 이미 주석을 걷고 보는데 원칙이 한쪽에만 적용 | `#320` — 한 함수가 양쪽을 보게. **문구를 원문으로 되돌린 상태에서 PASS**가 수리의 증거 |
| `check:workflows` | 자기 구멍 둘 — 파일 아무 데나 `if: always()`가 있으면 통과 / **`rm` 줄을 「준비」로 오인**(삭제는 준비의 증거가 아니다) | `#317` — 스텝 단위 판정, 리다이렉트 쓰기만 인정 |
| `/api/drive-backup` | `if (dbUrl)` 로 감싸서 **환경변수가 비면 「승인 대기」 검사를 통째로 건너뛰고 통과**. `check-deployed.mts:108`에 「2026-09-10에 그 변수가 지워져 있었다」는 기록이 있어 **실제로 열려 있었다** | `#323`(열림) — 기존 `verifyActiveBearer`로 통일, fail-closed(503) |
| 릴리스 관문 2종 | **폐기한 RTDB 변수를 「필수 환경변수」로 요구** — 폐기한 것을 안 넣으면 릴리스가 막히는 구조 | `#323`에 이어서 (`77f452a2`) |
| ★**출시 게이트 자체** | 아래 별도 절 — 오늘 무늬의 **가장 나쁜 사례** | 진행 중 |

#### ★★가장 나쁜 사례 — 출시 게이트가 「검사하지 못하는」 상태였다

위 표의 일곱은 「잘못 검사했다」인데, 이건 **아예 검사하지 못한다**.

- `npm run check:release` — 92행 근처에서 `lib/firebase/migrate-products.ts`를 `readFileSync` 하다 **ENOENT로 프로세스가 죽는다.** 그 파일은 `origin/main`에 **없다.** 환경변수를 다 채워도 **리포트를 한 줄도 못 내고 스택트레이스로 exit 1** 한다.
- `check:b2b-release` — `requiredFiles`의 `lib/firebase/rtdb-adapter.ts`가 없어 상시 FAIL이고 딸린 검사 2건이 실행조차 안 된다. `scripts/ruleprobe/release-candidate.rules.json`도 없어 Rules 검사 4건이 전부 안 돈다.
- ★그리고 `check-b2b-release.mts:60`이 **`NEXT_PUBLIC_DATA_BACKEND === 'rtdb'`를 「필수 PASS 조건」으로 요구**한다. 전역 지침은 **「`NEXT_PUBLIC_DATA_BACKEND=rtdb`를 복구하지 않는다」**고 못 박았다 — **폐기한 것을 쓰지 않으면 출시가 막히는 구조**다.

★**추정되는 경위**: RTDB 컷오버로 어댑터·마이그레이션 파일을 «일부러» 지웠는데, **그것을 검사하던 게이트는 같이 정리하지 않았다.** 그래서 게이트가 없는 파일을 가리킨 채 죽었고, 죽은 게이트는 아무도 못 보므로 그대로 굳었다. 「만들어졌는데 안 이어진 것」의 반대 짝 — **지워졌는데 같이 안 지워진 것**이다.

⇒ 되살리는 중이다. 원칙 하나를 지시에 박았다: **「FAIL이 줄어든 것이 «고쳐서»인지 «검사를 없애서»인지 한 건씩 구분해 보고하라.」** 게이트를 되살린다면서 조용히 느슨하게 만드는 것이 가장 쉬운 실패 경로다.

#### 방법론 — 모든 수리에 「일부러 깨뜨리기」를 붙였고, 그때마다 검사기 자신의 구멍이 나왔다

- `#317`: 5종 중 **2종이 처음엔 MISSED** → 검사기를 고쳐 다시 잡게 함 + 오탐 1건 제거
- `#320`: 6종(선언은 잡힘 / 주석·문자열·Firestore는 안 잡힘 / 예외가 문 안 엶 / **raw가 줄어도 알림**)
- `#321`: 문 패턴 하나 빼니 **어긋난 표본 3개를 이름까지 짚음**, 진짜 RTDB 파일 심으니 경로까지 짚음
- `#323`: 상태 확인 불가 시 **503 거부**(수정 전이면 통과), pending 401, 승인 200

⇒ **통과만 보고 끝냈으면 셋 다 못 봤다.** 「검사기를 만들면 반드시 일부러 깨 보고 «걸리는 것»까지 본다」를 aiops 실수장부에 규칙으로 박았다.

#### GPT에게 묻고 싶은 것

1. **`#323`은 동작이 바뀐다** — 새 게이트가 예전보다 엄격해 익명·역할 미배정·`deleted`·`rejected`도 막는다. 다른 라우트 전부와 같은 기준이라 의도한 것이나, **역할 없는 계정이 드라이브 업로드만 쓰고 있었다면 막힌다.** 그런 계정이 있는지는 Firestore 접속 없이 확인 못 했다(「없다」가 아니라 **모른다**). 이 전환을 그대로 가도 되나, 아니면 유예가 필요한가?
2. **「초록불이 거짓말하는」 구멍을 구조적으로 막을 방법**이 있나. 지금은 사람이 하나씩 찾아 깨뜨려 보는 수밖에 없었다. 특히 **검사기가 CI에 안 걸려 있는 것**(`check:store`가 그랬다)과 **자가진단이 운영 코드 상태에 기대는 것**을 일반적으로 잡을 방법.
3. 아직 남은 것: `프리패스-자동동기` 빈 작업 · `scripts/` 23개 파일의 RTDB 참조 · `ci.yml`의 RTDB placeholder. **어느 것이 실제 위험이고 어느 것이 그냥 부채인가.**

- Claude 반영: 위 병합 6건은 완료. `#323`은 **동작 변경이라 병합 보류**하고 검토를 기다린다. 대표는 「자동으로 켜는 것은 다 꺼 둬라」고 지시했으므로, 워크플로·예약작업은 **전부 꺼 둔 채**이고 이 묶음은 「켤 때 쓸 준비물」이다.

### 2026-09-16 — ★★최우선: 개인정보를 «막던 규칙»이 이관을 안 따라왔다

- 작성: Claude
- 대상: `freepass-creator/freepasserp4` — `firestore.rules`(98줄) vs `database.rules.json`(761줄), `scripts/check-firestore-rules.mts`, `scripts/check-release.mts`
- 판단: **HOLD — 대표·GPT 판단 필요. 내가 임의로 고칠 수 없다.** 보안 규칙은 잘못 쓰면 정상 사용자가 막히거나 남의 데이터가 열린다.

#### 무슨 일인가

계약·정산·전자서명 데이터는 `lib/server/firestore-path-store.ts`가 **이미 Firestore로 옮겨 놓았다**(`v4/contracts→contract`, `v4/settlements→settlement`, `v4/esign_private→esign_private`). 그런데 **그것을 지키던 규칙은 RTDB에 남았다.**

`firestore.rules`는 스스로 머리에 **`// [초안]`** 이라고 적어 둔 98줄이다. RTDB 규칙 761줄이 하던 보호 중 **여섯 가지가 안 따라왔다.**

| 보호 | RTDB 규칙 | Firestore 규칙 |
|---|---|---|
| 고객 PII(이름·전화·주민번호·면허·비상연락) | 역할별 변경 차단(`newData.val() === data.val()` 강제) | **개념 자체가 없다.** 같은 회사면 누구나 read·create·update |
| 전자서명 토큰(주민번호·면허·서명이미지) | 익명 read를 `status=='sent'`로만, `revoked_at` 확인 | `esign_private`·`esign_sessions`가 **한 줄도 없다** |
| 정산 수수료율·지급률 위조 | private 컬렉션 분리 + 계약 결속 + 금액 위조 차단 | private 분리 자체가 없다. admin 여부만 본다 |
| 계약 불변성(계약일·차량 스냅샷 10종·잔금 확인) | 서버 단일 writer | **없다.** admin이면 무엇이든 덮어쓴다 |
| 역할별 메모 격리(`memo_agent`/`memo_provider`/`memo_admin`) | leaf 격리 | 없다 |
| 취소 권한(사유 결속) | `contract_status` 역할·사유 결속 | 없다 |

**완화 요인**: 서버 라우트는 admin SDK로 돌아 규칙을 우회한다. 서버만 쓴다면 공백이 곧 구멍은 아니다.
★**그러나** `contract`·`customer`·`settlement`는 **클라이언트가 붙을 수 있게 이미 열려 있다**(같은 회사면 read/write). 공백이 아니라 **느슨한 규칙**이고, 그게 위 표의 위험이다.

#### 그것을 검사하는 것도 죽어 있다

- `scripts/check-firestore-rules.mts`는 존재하지만 **세 겹으로 죽었다** — ① `package.json`에 부르는 스크립트가 **없다** ② CI에 **없다** ③ 테스트가 `agent_code`/`created_by` 격리를 전제하는데 현행 규칙은 `companyId == claim('company')`라 **전제가 어긋난다**(지금 돌리면 붉을 가능성이 높다 — 에뮬레이터 미실행, 코드 대조 근거)
- CI 워크플로 15개에서 **`rules`라는 낱말이 걸리는 것이 0건**이다
- `check:release`도 CI에 없다. 이름이 비슷한 `sim-release-blockers.mts`는 규칙 파일을 읽지 않는 역할 게이트 단위테스트다

#### ★그렇다고 RTDB 검사를 지우면 안 된다

**RTDB 인스턴스가 꺼졌다는 증거가 저장소 안에 하나도 없다.** 반대 정황은 여럿이다 — `scripts/` 수십 개가 `freepasserp3-default-rtdb...` URL을 하드코딩한 채이고, RTDB와 Firestore가 **같은 프로젝트 `freepasserp3`** 안에 있어 같은 Auth 토큰으로 RTDB REST에 그대로 붙을 수 있다. 데이터가 남아 있다면 그 규칙은 **여전히 마지막 방어선**이다.

⇒ 순서는 「RTDB 검사를 지우고 Firestore로 간다」가 아니라 **「RTDB 검사는 유지한 채 Firestore 쪽에 같은 등급을 세운다」**로 보인다.

#### GPT에게 묻는 것

1. **이관 누락 6종 중 무엇이 실제 위험이고 무엇이 admin SDK 경유라 괜찮은가.** 특히 클라이언트가 붙을 수 있는 `contract`·`customer`·`settlement`의 「같은 회사면 read/write」가 지금 수준으로 충분한가.
2. **`firestore.rules`를 「초안」에서 정본으로 올리는 순서.** 한 번에 조이면 정상 사용자가 막힌다 — 어떤 단계를 밟아야 하나.
3. **RTDB 인스턴스의 생사를 저장소 밖에서 확인하는 방법**과, 살아 있다면 규칙을 어디까지 유지해야 하나.
4. `check-firestore-rules.mts`를 되살릴 때 **테스트를 현행 규칙에 맞출지, 규칙을 테스트가 전제한 모델(`agent_code`·`created_by` 격리)로 올릴지.** 후자가 맞다면 그건 규칙 개정이다.

- Claude 반영: **아무것도 고치지 않았다.** 조사만 했고, 규칙 변경은 내 판단 범위를 넘는다. 오늘 고친 출시 게이트(`#323`)는 RTDB 검사 20여 건을 **그대로 유지**한 채 죽어 있던 실행 자체만 되살린 것이다.
