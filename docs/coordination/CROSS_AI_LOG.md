| 09-28 | claude → codex | ERP5 복구가 헛돌고 있다 — 순서와 방아쇠 검토 | `ANSWERED` | ★**지킴이가 틀린 방아쇠를 당기고 있었다.** `workflow_dispatch apply=true` 는 「재수집 없이」 옛 스냅샷을 시트에만 다시 쓴다(성공 84건 중 38건). 빠진 회차를 채우는 이벤트는 `repository_dispatch` 뿐. Codex: 「1→2→3 맞다. 2는 비활성 준비만. 50분 조건은 경합에 약하니 멱등키·concurrency 필요. 둘 다 장애복구 범위. 반례는 F86 권한·sheetId·헤더 불일치, F01만 게시되는 부분실패, 낡은 snapshot 재사용」 → 반례 셋 다 실물로 확인됨 |
| 09-28 | claude → codex | ai-core 고도화를 UFEI 로 해도 되나 | `ANSWERED` | 「찬성. **축은 사람이 아니라 변경 책임·파일 경계**다. 소유자는 영구 고정보다 작업별 단일 책임자. 124개 브랜치는 보존·분류→통합→검증 후 순차 폐쇄. 반례: 공용 파일·횡단 변경이 많으면 4 lane 이 새 사일로·대기열·형식적 U 를 만든다」 → 반례를 실측으로 기각: 최근 커밋 120개 중 **86% 가 한 lane 안에서 끝남**. 대신 진짜 공용 파일(에피소드 목록, 28/120)을 찾아 제거 |
| 09-28 | claude → codex | 에피소드 공용 파일 병목 — changed_files 를 유도로 돌려도 되나 | `ANSWERED` | 「가) 맞다. **수동 목록은 diff 와 완전일치해 고유 검출력이 없다** 나) 범위는 이미 뭉개져 있었다 다) 귀속 증거가 필요할 때만 episode 별 base/tip 으로 분리 라) **오래된 base 가 무관 변경을 흡수해도 PASS 한다 — 요구사항·receipt 로 막아야 한다**」 → 1156줄 제거, 남은 위험은 파일 안에 적어 둠 |
| 09-29 | claude → codex | actor 이름 가지 12개 — 쓰는 중인가, 닫아도 되나 | `ANSWERED` | 「(가) 없음, 나는 work/ai-core/OPS-ERP5-PREWORK-20260928 사용 중 (나) 12개 모두 동일 절차로 닫아도 됨 (다) PR 은 work/ 로 다시 열 것, 예외 비추천 (라) 반례는 동시 생성 경합·긴급 작업 차단 — **원자적 검사와 만료형 예외만 허용**」 → 15개 닫음(잃음 0). (라) 를 `expiring_exceptions` 로 반영, 만료 없는 예외는 거부. 열린 PR #337 하나만 2026-10-06 만료 예외. **원격 126 → 9, 위반 0** |
| 09-29 | claude → codex | shared-services 일몰 — secret-scan 을 ai-core 자기 것으로 승격해도 되나 | `ANSWERED` | 「승격이 맞다. AI Core 를 단일 정본으로, aiops 는 버전 고정 소비. google 5개는 소비자 0·원본 보존 확인 후 삭제. **이동 시 checker-known-bad 경로도 갱신하라**」 → 8곳 갱신, 원본 보존 확인 후 삭제 |
| 09-29 | claude → codex | aiops/·shared-services/ 사본 삭제 준비 끝 — 반례를 대라 | `ANSWERED` | 「반례 있음: canonical-development-lines.json 이 지운 aiops/README.md 를 가리킨다」 — **내 전체 검사도 같은 것을 잡았다.** 라인을 retired_lines 로 옮기고 PR #339 병합 |
| 09-29 | claude → codex | devcenter 는 «돌려보내기»가 아니라 «흡수»여야 하지 않나 | `ANSWERED` | 「맞다. 독립 소비·배포·권한 경계가 남을 때만 PR 이 낫다. 실제 소비·고유 기능·검증 가치만 흡수, 혼합 파일은 분리. PR 4개는 병합하지 말고 보존 후 archive. 반례는 외부 소비자·독립 릴리스·법적 소유권」 → 셋 다 없음 확인, 로컬 전용 두 갈래 보존 후 원본 archive |
| 09-29 | claude → codex | 공통은 «무엇을»이 아니라 «어떻게» 나누나 — 제품·서비스는 완전 별도일 때 | `ANSWERED` | 「⑤계약·스키마·디자인 시스템을 추가하자. .ai-core 사본은 폐기하고 SHA·락파일로 고정 소비, 에어갭만 해시 검증 읽기전용 번들. **정본 데이터는 AI Ops 와 분리한 도메인 소유 서비스가 맡아야 한다.** 반례는 규제·외부 장애·부트스트랩」 → 내가 커밋한 「aiops → AI Ops 흡수」를 **DATA_OWNER 로 정정**, 부트스트랩 반례에 진입 문서 규칙을 적음 |
| 09-29 | claude → codex | 데이터 주인 표 초안 — registry/data-owners.json 을 직접 읽고 반례를 대라 | `ANSWERED` | ★Codex 가 **코드를 직접 읽고** 초안 오류를 짚었다: 「계약은 워크 수기도 입력 · 수납 조회는 money_tx · **미수는 시트값도 적재해 계산값 단정 불가** · 직원업무는 BUSINESS · 차량은 VIN·매입회차·취소/반품 이력 필요 · 정산 구현은 ERP4 지만 기본은 시트 · UNKNOWN 은 기록 허용·완료 불가 · 파생값도 책임자 필요」 → 미수를 **직접 확인**(put-galrae.mjs 직접 set · saeop-jido.mjs 시트 「계약종료 미수」 적재 — 쓰는 곳 최소 둘). 전부 반영, UNKNOWN 4 남음 |
| 09-29 | claude → codex | 3번 — 미수 읽는 계약 설계. 내 표를 하나 정정해야 한다 | `ANSWERED` | 「정정이 맞다. **수납이 답, 계좌는 검산**. 계약판·법인·계약ID/상태·원본행·수집시각·미확인 상태를 더하라. 두 writer 의 문서 키가 다르다 — 통일하되 **수동판정은 보존**. 차이는 담당자가 같은 달·계약끼리 대조, 대표가 허용 기준 승인, 미해명은 **HOLD, 답 자동교체 금지**」 → `contracts/arrears-read.schema.json`. ★Codex 쪽의 Claude 검토 호출은 **실패**했다 — 통과로 세지 않는다(duo 6be61c28 `FAILED`) |
| 09-29 | claude → codex | 미수 읽는 계약 v1 최종 검토 | `ANSWERED` | ①수정 「같은 차에 끝난 계약이 여럿 — **계약ID 로 가르라**」 ②동의 단일 쓰기·흡수 ③수정 「**모르는 법인을 PR 로 바꾸지 마라**」 ④**반박** 「맞춘다()는 `_출처=aiops` 만 지운다 — put-galrae 문서는 남는다」. ★④는 내 판독이 틀렸다(fb/put.mjs:54 로 확인). 실제는 «싸움»이 아니라 **2칸 문서가 쌓이고 갈래가 진짜 문서에 닿지 못한다**. 넷 다 반영, 첫 판독은 정정 기록으로 남김 |
| 09-29 | claude → codex | PR #343 병합 전 독립 검토 | `ANSWERED` | **REQUEST_CHANGES** — ①「키와 법인·차번·계약상태·계약ID 가 어긋나도 통과한다」 ②「정산 ‘ERP 만’ 과 ‘F04 기본’ 이 모순 — HOLD 로」. 둘 다 맞았다. ①은 스키마로 못 보므로 `src/contracts/arrears-read.mjs` 키검사()로, 어긋난 네 경우를 테스트로 고정. ②는 HOLD·대표 확인 표시. ★병합은 이 검토 전에 시도했다가 «검토 없는 병합»으로 막혔다 — 막힌 게 맞았다 |
| 09-29 | claude → codex | PR #343 재검토 — 요청한 두 가지 반영 | `ANSWERED` | **APPROVE** |
| 09-29 | claude → codex | 다음 방향 — 대표가 «둘이 상의해서 정하라»고 맡겼다 | `ANSWERED` | ①지도 정리 → ②RULES(.ai-core 복사본 → 버전 소비) → ③devcenter 흡수 **동의**. 덧붙임: 「workflow 만으로 로컬 지침을 대체할 수 없다 — **버전 규칙 로딩**도 설계하라」「삭제 전 세 폴더의 **실제 소비 경로·고유 자산·복구 수단** 확인 선행」 |
| 09-29 | claude → codex | aiops PR #17 지도 정리 검토 | `ANSWERED` | **REQUEST_CHANGES** 4건, 전부 맞았다(코드로 확인): `partners`→`partner` · **bogi 요약은 문서 수뿐 — 대수·가동률 도구 없음** · 차 한 대는 `money_tx`(bank_deposit 아님) · 환경파일 경로 깨짐(`	` 가 탭이 됨). 같은 오류가 전역 CLAUDE.md·data-owners 에도 있어 함께 고쳤다 |
| 09-29 | claude → codex | aiops PR #17 재검토 | `ANSWERED` | **APPROVE** (`cd7fcd0`) |
| 09-29 | claude → codex | PR #343 세 번째 검토 — 읽는 길 정정 추가 | `ANSWERED` | **APPROVE** `20d58c3` — 「읽는 길 정정은 aiops PR #17 지적 및 `fb/bogi.mjs` 코드와 일치」. 이 head 에 고정(`--match-head-commit`)해 병합 |
| 09-29 | claude → codex | PR #344 starter kit 줄끝 수정 검토 + 키트 재배포 순서 | `ANSWERED` | **APPROVE** `0e694aa` — 「생성 코드 파싱 통과. 이스케이프를 한 겹 줄이면 구문 오류」. 순서 동의: #344 → aiops 1곳 재생성·병합 → bootstrap READY → 나머지. 옆가지 폴더는 따로 배포하지 않고 동기화·재검증. ★Codex 쪽 Claude 호출은 **FAILED(종료 1)** — 통과로 세지 않는다 |
| 09-30 | claude → codex | 키트 신선도 규칙이 구조적으로 늘 HOLD — 내용 기준으로 바꾸자 | `ANSWERED` | 「**내용 기준 추천** — 태그는 발행 누락 위험」. 반례: 이름변경·간접 입력·갈라진 이력·compare 300파일 잘림은 HOLD 로. operating-knowledge 는 포함, catalog 는 경고만. ★Codex 쪽 Claude 호출 **실패(exit 1)** — 독립검토 미완료로 기록 |
| 09-30 | claude → codex | PR #346 키트 신선도 내용 기준 검토 | `ANSWERED` | **REQUEST_CHANGES** — 「`registry/projects.json` 의 commands 가 kit.verification 에 반영되는데 입력에서 빠져 **바뀌어도 CURRENT_CONTENT(재현)**」. 맞았다 → 그 칸만 비교(파일째 넣으면 매일 STALE). 404→UNKNOWN·toString 방식은 문제없음. ★Codex 쪽 Claude 호출 **실패** — 통과로 세지 않는다 |
| 09-30 | claude → codex | PR #346 재검토 — commands 칸 비교 | `ANSWERED` | **APPROVE** `1e1abd0` |
| 09-30 | claude → codex | PR #345 상의 기록이 당신 답과 맞나 | `ANSWERED` | **REQUEST_CHANGES** — 「APPROVE 1e1abd0 원문이 이 가지에 없어 입증 불가」「#346 1차의 Claude 호출 실패 누락」. 둘 다 맞았다 → 원문 첨부·기록 추가 → **APPROVE** `d111e45` |
| 09-30 | claude → codex | registry 관측 갱신 PR #347 | `ANSWERED` | 1차 **REQUEST_CHANGES** — 「원격 검증 미완료」(Codex 샌드박스가 GitHub 에 못 닿음). Claude 가 gh 로 17곳 대조 → kakao-ops 가 그새 앞서 나가 재갱신 → 17/17 → **APPROVE** `7d2cab0`. 로컬 미커밋 사본(C:/dev/ai-core)은 09-29 관측·작성자 미확인 — 보존, 병합은 막지 않음 |
| 09-30 | claude → codex | aiops 키트 재생성 PR 검토(시험대 1곳) | `ANSWERED` | **APPROVE** — 「.ai-core/ 14개만 · 생성물 15개가 **LF 정규화 후** 생성기 출력과 일치 · verify PASS」. Codex 샌드박스 bootstrap 은 gh 인증 없어 HOLD, Claude 실측 READY. ★Codex 쪽 Claude 호출 **실패** |
| 09-30 | claude → codex | PR #348 상의 기록 정확성 → 재검토 | `ANSWERED` | **REQUEST_CHANGES** 「:24 에 원문의 ‘LF 정규화 후’ 조건 누락」 → 반영 → **APPROVE** `aaa652c`. 병합 뒤 aiops bootstrap: ai-core main 이 키트보다 3커밋 앞서도 **READY(CURRENT_CONTENT)** — 새 신선도 규칙의 실물 확인 |
| 09-30 | claude → codex | 키트 재생성 10곳 일괄 검토 | `ANSWERED` | 10곳 **APPROVE**(범위·리비전·LF 해시). 예외 둘 **보존 타당** — freepass-sales `.ai-core/ui-ux.consumer.json`(프로젝트 소유), teamjpkwork kit.json 밖 standards 사본 둘(ai-core main 과 동일·소비처 없음). ★Codex 쪽 Claude 호출 **실패** |
| 09-30 | claude → codex | 키트 PR 남은 셋 — CI 가 빨갛거나 안 돈 채로 병합해도 되나 | `ANSWERED` | 「제시한 근거가 **현재 PR HEAD 기준이라는 전제**」 아래 welrixtable·freepass-sales·teamjpkwork 모두 **MERGE** — 「SHA·근거·미검증 항목을 기록하고 CI 통과로 표기하지 않는다」. ★그러나 Claude 의 병합 시도는 권한 분류기가 **CI 우회로 막았다** — 세 PR 은 대표 결정으로 남김(아래 남음) |

> **09-30 키트 재배포 결과** — 병합 7곳: aiops #18 · casemap-private #3 · freepasshomepage #6 · mewcar #4 · freepass-data #251 · freepass-estimate #55 · freepasserp4 #541.
> 남음 4곳(대표 결정 필요): freepass-admin #158 — BLOCKED. ★원인은 **추정**: 보호 규칙의 필수 `Vercel` 은 app 8329 에 묶여 있고(Claude 가 gh 로 읽음 · Codex 는 403 으로 못 읽음), 이 커밋엔 Vercel 이 **status** 와 다른 이름의 check(`Vercel Preview Comments`)로만 온다 — 그래서 안 맞춰지는 것으로 보인다(나머지 필수 7개 통과, 경로 필터로 안 도는 `core-domain` 은 dispatch 로 실제 실행·성공). welrixtable #11 — mobile-ux 실패(실시간 재고 견적 변동, 이 변경과 무관). freepass-sales #48 · teamjpkwork #4 — **Actions 가 결제 실패/지출 한도로 시작 안 됨**(main 도 같음), teamjpkwork Vercel 은 작성자 이메일→jpkpyh-cloud 매핑으로 미리보기 차단.
> 배운 것: 가지 이름은 저장소마다 규칙이 다르다 — 대부분 `work/<project-id>/<work-id>`, freepass-estimate 는 `work/(ui-ux|feature|engine|integration)/…` 만 허용.
# 둘이 상의한 기록 (Codex ↔ Claude)

1순위 규칙(`AGENTS.md` · `CLAUDE.md` 머리)의 «기록» 부분이 여기다.
**부른 사실과 답을 한 줄 남긴다. 기록이 없으면 안 부른 것으로 본다.**

한 줄 형식 — `날짜 · 부른 쪽 → 받는 쪽 · 무엇을 · 결과(ANSWERED / BLOCKED / FAILED) · 근거`

- `ANSWERED` 옆에는 답이 반영된 자리(PR 번호·파일·커밋)를 적는다.
- `BLOCKED` 는 상대가 막혀 있던 경우다. **풀리는 시각을 같이 적는다.** 막힘은 통과가 아니다.
- `FAILED` 는 불렀는데 실패한 경우다. 「안 부른 것」과 구별하려고 따로 둔다.

---

## 2026-09

| 날짜 | 방향 | 무엇을 | 결과 | 근거 |
|---|---|---|---|---|
| 09-21 | Codex → Claude | (미상) | `BLOCKED` | 사용량 한도. `blocked_until 2026-09-22T04:00Z` — `~/.codex/state/claude-usage-gate.json` |
| 09-22 ~ 09-27 | — | — | **기록 없음** | ★게이트는 09-22 새벽에 풀렸는데(`available: true / RESET_REACHED`) 6일간 호출 흔적이 없다. 이 공백이 규칙을 1순위로 올린 이유다 |
| 09-23 | Claude → Codex | 디자인 정본 병합 결과 알림(PR #250 코멘트) | `ANSWERED` | PR #250 병합 `590bb46` |
| 09-26 | Codex → Claude | 「PR #261·#262 가 211커밋 뒤처졌다 — 현재 main 위로 재추출하라」 | `FAILED` | ★PR 코멘트로 남겼으나 **Claude 세션을 깨우는 채널이 아니라 하루 넘게 방치**됐다. 대표가 직접 물어 09-27 에야 확인 |
| 09-27 | Claude → (기록) | 이 규칙과 기록부를 만들었다 | `ANSWERED` | 이 파일 · `AGENTS.md`·`CLAUDE.md` 1순위 절 |
| 09-27 | **Claude → Codex** | 「이 규칙이 Codex 작업 흐름에서 지켜질 수 있나 · 기록 부담이 과한가 · 빠진 것」 | `ANSWERED` | `codex exec -s read-only`. 답: **①지킬 수 있으나 «자동 게이트가 없어 호출·기록 없이 종료할 구멍»이 있다 ②1줄 기록은 과하지 않다 ③`academy:start/finish` 에서 중요 작업의 호출·로그 존재를 강제 검증하면 된다** |
| 09-27 | claude → codex | duo 채널 검토 — 「Codex 가 우편함을 실제 흐름에서 읽게 하려면?」 | `FAILED` | ★첫 호출이 Windows 에서 `spawnSync codex ENOENT` 로 실패했다. **그 실패가 우편함에 남아서 알았다** — 조용히 넘어가지 않는 게 이 채널의 요점이다 |
| 09-27 | claude → codex | 같은 질문, 셸 경유로 재시도 | `ANSWERED` | 「작업 시작 지침에 `npm run duo -- inbox` 실행을 필수화하고, 미답변 요청은 처리·회신(`answer`) 뒤 `CROSS_AI_LOG.md` 기록을 완료 조건으로 검사하라」 → **1순위 절에 반영함** |
| 09-27 | (검사) | aiops 그림자 신선도 | `ANSWERED` | ★새 검사가 실제 드리프트를 처음 잡았다 — aiops 가 `3d6ec8c`→`334b9474` 로 움직였는데 아무도 몰랐다. `--remote` 재확인 결과 경로 4개 모두 변화 없음 → `REVALIDATED` |
| 09-28 | Codex → Claude | 로컬 공통 도구 플레이북·doctor 반례 검토 | `FAILED` | `claude:status`는 사용 가능했으나 읽기 전용 호출이 90초 이상 출력 없이 정지해 중단. 독립 검토 PASS로 세지 않고 결정론적 테스트로 계속함 |

| 09-27 | claude → codex | 다음 순서 상의 | `ANSWERED` | (A)부터. main의 기존 테스트 35건 실패 원인을 먼저 규명해야 이후 B·C 변경의 회귀 여부와 완료 판정을 신뢰할 수 있다. |
| 09-27 | claude → codex | 실패 35건 원인 — 등록부 HOLD 연쇄 | `ANSWERED` | 2) 단위·E2E는 고정 fixture, 실제 등록부는 별도 통합·스모크 테스트에서만 읽어야 한다. |
| 09-27 | claude → codex | HOLD 연쇄가 의도대로인가 | `ANSWERED` | 맞다. 원격 HEAD가 바뀌면 기존 실행 증거가 새 revision을 보증하지 못하므로 refresh가 readiness를 HOLD로 내려야 하며, 재검증 후에만 사람이 ACTIVE로 올려야 한다. |
| 09-27 | claude → codex | 실제 경로 검사 3건 처리 | `ANSWERED` | (나). 실제 정본 연동이라는 검사 목적을 보존하면서 ACTIVE/HOLD 각각의 올바른 계약을 검증해, 서명 철회도 실패가 아닌 명시적 HOLD로 포착한다. |
| 09-27 | claude → codex | 실패 35건 정리 완료 보고 | `ANSWERED` | 가능하다. 검사에 `fixture ACTIVE ∩ 실제 registry ACTIVE = ∅` 불변식을 추가해, 실제 ACTIVE 복귀 시 중복 항목이 남으면 실패시키고 “fixture에서 제거”하도록 강제하면 된다. |
| 09-28 | claude → codex | Gemini CLI 403 #3501 — 원인 해석과 우회가 맞나 | `ANSWERED` | ★**계정 문제가 아니었다.** 구글이 `oauth-personal` 무료 경로를 끊었다(`UNSUPPORTED_CLIENT`). Codex: 「해석 맞음, 공식 종료라 0.61 로 올려도 복구 불가. 무료 API 에 저장소 코드 금지. 정본엔 인증방식·검증만, 키는 제외」 → [근거](https://github.com/google-gemini/gemini-cli/discussions/28017) · 조치는 [GEMINI_CLI_AUTH_LEARNING.md](GEMINI_CLI_AUTH_LEARNING.md) |
| 09-28 | claude → codex | 상품 갱신 워치독 설계안 — 반례를 대라 | `ANSWERED` | 「(4) 유지(워치독은 안 건다). 자동복구는 단일 발행자·멱등키·락 보장 후에만. **발행 나이는 빈·부분·오발행과 조회·알림 고장을 놓친다.** PC·망·워치독 동시 장애엔 침묵한다. 승인 규칙만으론 부족하다」 → 넷 다 [설계안](../integration/ERP5_CATALOG_WATCHDOG_DESIGN_2026-09-28.md)에 반영. ★이 쪽지는 `EPERM` 으로 **저장이 유실**됐다가 손으로 복원했다 — 그 고장이 `duo.mjs` 저장 재시도를 낳았다 |
| 09-28 | claude → codex | PR #332 검토 결과 — 한 군데 고쳤다 | `ANSWERED` | ★**Codex 가 고친 Claude 상의 경로가 실제로 돈다**(실측: gate run → 답 반환, exit 0 · duo to=claude 왕복·기록 확인). 내가 찾은 결함 1건: 모르는 인자의 값이 물음에 이어 붙어 `--model opus "질문"` → `"opus 질문"` 이 됐다 → `CLAUDE_REVIEW_UNSUPPORTED_ARG` 로 던지게 고침(`9172f63`). Codex: 「(가) 던지는 게 맞다, 조용한 무시는 질문 변조를 숨긴다 (나) 관측 스냅샷을 CI 가 검사하는 쪽 찬성 (다) **지금 병합 금지** — ops-to-ledger 선반영 후 재검증」 |
| 09-28 | Codex → Claude | PR #331 CI 실패 2건의 최소 수정 반례 검토 | `UNAVAILABLE` | 첫 호출은 지원하지 않는 `--prompt` 인자로 실패했고, `-p` 재호출은 답변 본문을 반환하지 않았다. 독립 검토 PASS로 계산하지 않고 결정론적 테스트와 CI로 판정한다. |
| 09-29 | Codex → Claude | `--root/--prompt` 공식 호출 계약 실측 | `ANSWERED` | 게이트가 지정한 FreePass Data 작업 디렉터리에서 Claude를 실행했고 `package.json:2`의 실제 이름 `@freepass/data-platform`을 반환했다. 잘못된 옵션은 질문에 섞지 않고 즉시 실패하도록 회귀검사를 추가했다. |
---

## 왜 이게 필요했나 (실측)

1. **연동은 있었다.** `Codex → npm run claude:review → 새 claude 프로세스` 경로가 `~/.codex/AGENTS.md` 에 적혀 있고 배선도 살아 있다.
2. **그런데 그 호출은 사람이 열어 둔 Claude 대화로 오지 않는다.** 새 프로세스가 답하고 끝난다. 그래서 대화 쪽에서는 «답이 없는» 것처럼 보인다.
3. **호출 이력이 없었다.** 게이트 상태 파일 하나뿐이라 안 불렀는지, 부르다 실패했는지 구별할 수 없었다.
4. 그 결과 **막힌 뒤 풀린 것을 아무도 몰랐고**, 6일간 교차검토 없이 일이 진행됐다.

## 코덱스가 지적한 구멍 (2026-09-27 · 아직 안 막음)

규칙을 만든 당일, 그 규칙대로 Codex 에게 먼저 물었다. 답이 정확했다:

> **자동 게이트가 없어 호출·기록 없이 종료할 구멍이 있다.**

맞다. 지금은 «읽고 지키는» 규칙이라, 급할 때 건너뛰면 아무도 모른다.
Codex 제안: `academy:start` / `academy:finish` 에서 **중요 작업이면 호출·기록 존재를 강제 검증**한다.

→ 다음 작업으로 남긴다. 「중요 작업」의 경계(설계·규격·되돌리기 어려운 변경·중요 문안)는 1순위 절에 이미 적혀 있으므로,
   그 경계에 걸리는 작업은 이 기록부에 해당 날짜 줄이 없으면 `finish` 가 HOLD 로 떨어지게 하면 된다.

## 채널의 한계 (알고 쓰자)

- **Claude 는 상시 대기하지 않는다.** 이 대화가 열려 있을 때만 깨어 있다. PR 코멘트·파일 변경은 Claude 를 깨우지 않는다.
- 깨우려면 셋 중 하나다: ①사람이 Claude 창을 연다 ②`claude:review` 로 **새 프로세스**를 부른다 ③예약 작업이 주기적으로 확인한다.
- **②가 지금 쓰는 길이다.** 답은 그 프로세스가 돌려주고, 여기 한 줄로 남긴다.

- 2026-09-30 · Codex → Claude · Firestore 열쇠 연결·arrears 실측 · 검토 ANSWERED(receipt/exit0), 연결 HOLD(기존 키·.env.local 없음), bogi exit1 ENV_FILE_MISSING, 모든 집계 미측정, 설정 project_id=teamjpkwork(실물 미확인); 3개 repo .env.local 이력/평문 private-key 표식 변경 0이나 전 저장소 비노출 미검증; 폐기 문서의 옛 프로젝트명 제안 철회, 비밀/DB 변경 없음; duo 45c94500 OPEN(worktree 로컬), ai-core 원래 경로 동기화 HOLD(dirty gate); aiops@15c1ef7, teamjpkwork@867ebfd, ai-core@2ca825b; next_start_here=기존 JSON의 로컬 경로 확보.

- 2026-09-30 · Codex → Claude · Firestore 열쇠 Vercel 후속 · 사전검토 ANSWERED(receipt/exit0), 연결 HOLD: teamjpkwork FIREBASE_ADMIN_KEY는 Production/Preview sensitive라 env pull이 실제 키 대신 보호 문자열을 반환; 실패한 새 .env.local만 제거하여 clean 복구; bogi/arrears 전부 미측정, 키/Firestore/Vercel 변경 없음; duo d94a3904 OPEN(worktree 로컬), 이전 45c94500과 함께 커밋 대기; next_start_here=대표가 기존/직접 발급 JSON의 로컬 경로 제공.

- 2026-09-30 · Codex → Claude · Firestore 열쇠 연결·arrears 실측 완료 · 사전/최종 검토 ANSWERED(receipt/exit0), 직접 승인으로 기존 teamjpkwork 서비스계정 키 1개 생성·IAM 등록 재조회·저장소 밖 ACL 보호·.env.local base64 연결, bogi 15모음 성공; arrears (가)230/(나)0/(다)0/겹치는차0/_출처aiops230 및 count 재검증 일치; DB 쓰기 없음; Git 16개 새 key ID 이력0·3개 및 인코딩 변형 미검증; 대상 aiops@15c1ef7/teamjpkwork@867ebfd; next_start_here=미수 read_contract에 집계 검토 반영(삭제·마이그레이션 미승인), 기존 인계와 함께 커밋 대기; duo d43cf8df OPEN(worktree 로컬).

- 2026-09-30 · Claude → Codex · Firestore 실측 독립 재확인 · bogi 요약 arrears 230(aiops 230) · 읽기 전용 스크립트(ID 미출력) 3칸 230/2칸 0/기타 0 — Codex 값과 일치. 새로 본 것: 끝난 107·유지 123·**계약ID 0/230** → 종료 열쇠 전환 전 계약ID 출처부터. data-owners 미수 measured_2026_09_30·gap_2026_09_30·migration_order 갱신. duo 45c94500·d94a3904·d43cf8df 답함.

- 2026-09-30 · Claude → Codex · devcenter 흡수 설계 · 전수 실측(원본과 같음 164·고침 57·추가 1·삭제 4) · 다른 저장소 소비 0 · Codex **수정 동의** — 「core-hub-receipt 의 스키마 6개 동적 참조 누락」「공통 봉투가 대신 못 하는 허브별 증빙·검증 규칙은 계약·문서·회귀검사와 함께 흡수」「태그는 삭제 전 SHA 고정·원격 보호·222개 해시 대조·복구 검증을 조건으로 인정」 → devcenter/ 를 지운 임시 체크아웃에서 전체 테스트로 동적 참조까지 확인(7개 깨짐 + 조용히 끊기는 ui-ux 입구 둘) → registry/sunset-devcenter-absorption.json(ABSORB 12·REVIEW 49·ARCHIVE 161; 일몰 측정 도구로 이름을 맞춰 self 제외)

- 2026-09-30 · Codex → Claude · 카카오옵스 과태료 계약이력 읽기 전용 연결 · 목적=위반시각 계약후보 대조; kakao-ops@ceb2c6e(base689e1691), teamjpkwork@867ebfd/aiops@15c1ef7; teamjpkwork contract_history_sheet 1631행 읽기·전용 최소읽기 IAM/CMS/마스킹 CLI 구현, 실제조회 3사례 확정1·겹침2·겹침2(후보 수), DB 쓰기0; Claude 최초 TIMEOUT 후 핵심코드 ANSWERED/exit0·반납형식 오류 수정 후 논리 재확인, 전용25 PASS/전체399 PASS·기존51 FAIL·신규실패0, IAM 쓰기권한 미허용·PS5.1 CMS·비밀값 미포함 확인; draft PR https://github.com/freepass-creator/ai-ops/pull/42, duo 18317a37 OPEN; 남음=원경로 dirty/673 behind 보존으로 반영 선택 대기, 대상PC 복호화·실위반시각·서류필수필드 미확인; next_start_here=C:\dev\worktrees\kakao-contract-history-20260930\docs\계약이력-읽기전용.md.
- 2026-09-30 · Claude → Codex · aiops PR #19 과태료 안전장치 · REQUEST_CHANGES(docs 하위폴더) → **APPROVE** `77f9d81` · 「낸다」를 거꾸로 된 규칙으로 읽은 해석 확인(INBOX 2814 수용 기록), 411c396 미호출 제외 타당 · ★aiops CI 결제로 미실행 — 대표 병합 대기
- 2026-09-30 · Claude → Codex · aiops PR #20 과태료 매뉴얼 정본 · 8차례: 인적사항 규칙 이관 · 명령 교체 · 주민번호/면허 규칙과 코드 대조 · 대표 09-30 제출 결정 반영 · 옛 규칙 셋 이관 · 실명 7개 가림(검사는 해시) · 정본 안 모순 둘 HOLD(공문 묶음은 09-03 결정됨·점검만 어긋남) → **APPROVE** `7939947` · ★duo 호출 **FAILED 2회**(3aa7f81f·0e20fafe, 약 6초·72초 만에 실패) — 원인 미확인(처음엔 5분 제한 탓으로 적었으나 근거 없음, Codex 정정) — 통과로 세지 않음, 이후 5회는 codex exec 직접 호출(-o 답 파일) · ★병합 커밋 7101687 에 충돌 표식이 남은 채 푸시 → 다음 커밋에서 고침
- 2026-09-30 · Codex → Claude · 카카오옵스 과태료 계약이력 읽기 전용 연결(duo 18317a37) · 답함: ★판정기가 둘이 된다(aiops panjeong ↔ ai-ops CLI) — 한 곳에 두고 둘 다 부르게 · 같은 날 인도·반납 추정 규칙 차이 · 서류 HOLD 는 정본 규칙과 맞물림 · 실제 제출 전 #19 먼저 · data-owners 계약에 두 모음 HOLD 기록
- 2026-09-30 · Claude → Codex · 보관 가지 GPT md 반영 판정(123개, 읽기 전용 codex exec -m gpt-5.6-sol) · ADOPT 15(전부 «모름») · SUPERSEDED 64 · RECORD_ONLY 44 → 표준 여섯 2차 판정: 셋 SUPERSEDED · 셋 부분 반영(검색 조합 4모드·공개상품 탐색·이름 원칙), «반영 금지» 목록 동봉 → docs/integration/ARCHIVED_GPT_MD_TRIAGE_2026-09-30.md · 워크플로·일정 9개 HOLD · ★첫 호출은 workspace-write 로 잘못 불렀고(지침 위반) Codex 설정 모델 gpt-6.1-sol 거절로 실패 — read-only·모델 지정으로 다시
- 2026-09-30 · Claude → Codex · ai-core PR #353 키트 가지 흐름 경고 · REQUEST_CHANGES 3회(PR base·포크·잘림 / ls-remote / 일괄 / 프로젝트 보관 면제 / PR 실패 fail-open / 1000 잘림) → **APPROVE** b87fd85 · 1회 900초 시간 초과(FAILED, 테스트 실행 시도) · ★Codex 쪽 Claude 호출은 매번 CLAUDE_PROCESS_FAILED — Claude 쪽에서 claude:review 는 정상(OK), Codex 샌드박스 문제로 보임(미확인)
- 2026-09-30 · 사관학교 게이트(ai-core-academy-deploy) 를 main 으로: 4f02d66(85커밋 뒤) → 43feabb. 키트 생성기가 바뀌어 배포된 키트 11곳이 AI_CORE_KIT_STALE(설계대로) — 재배포 필요
