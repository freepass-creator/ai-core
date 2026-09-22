# 개발센터 문제·개선·통일 리포트

기준일: 2026-09-09. 발행 전 재확인 시각: 2026-09-09T11:59:57.8156964+09:00. 기준 커밋: e769762355b6902269a5bd146bfa200c8b8e92b7 + 별도 미커밋 이동 작업 관찰. 과거 관찰과 현재 상태가 다르면 원본 재확인 후 갱신한다. 상태: **OPEN / 전체 검수 HOLD**. 이 리포트는 확인된 문제와 작업 후보를 기록하며 정본 변경·자동 수정·설계 합격을 뜻하지 않는다. 소속/검수 정족수의 정본은 AGENTS.md 및 ssot/PART.md가 가리키는 규칙이다.

## 확인한 문제와 남은 일

| ID | 우선 | 구분·관찰 | 영향 | 주관 / 독립 검토 | 완료 증거 |
|---|---|---|---|---|---|
| DC-001 | P1 | **진입점 조치함(2026-09-09) · 독립검증 대기.** 어디를보나.md·STARTER-TEMPLATES.md·AGENTS.md 의 `_base` 포인터 6+3+2건을 `freepasserp4` 로 맞췄다. 재현 증거: `_base`=`ed4dc7bf`(2026-08-29, main보다 **533커밋 뒤**) · CLAUDE.md **108줄 ↔ 367줄**(「먼저 읽어라」 지침 11개 누락) | AI가 다른 기준을 적용 | Claude / **Cursor·Codex 재현 필요** | 지도·등록부는 원래 일치했고 **진입점만** 맞췄다. 상세·해시 = [정본 경로 점검](../operations/progress-handoff/2026-09-09-프리패스ERP-정본경로-점검.md) |
| DC-012 | P1 | **신규(2026-09-09).** 진입점을 고쳐도 또 어긋난다 — `틀.mjs` 가 주는 것은 «작업트리의 지금 가지»다. 실측: `freepasserp4` 가 `feat/spring-atom-monitor`(main보다 250뒤·388앞), 그 가지 CLAUDE.md 는 **281줄**(main 367)로 지침 4개 누락 | 브랜치만 바뀌어도 정본이 바뀐다 | Claude 관찰 / **Codex 판단** | 당장은 `틀.mjs` 가 «main 아님 + 뒤처짐»을 경고하게만 했다. **읽기를 `git show origin/main:<경로>` 로 바꾸는 것은 범위 확대라 대표님 확정 전 미반영**(AGENTS.md 금지 4) |
| DC-013 | P1 | **신규(2026-09-09, 견학 중 발견).** `dev.design.atom.product_card` 가 카드 원자 **9파일 중 1개**만 가리킨다. `components/product-card-*` = 9파일·export 46개인데 등록된 `product-card-atoms.tsx` 는 **3개(6.5%)**. `PriceHero`·`PeriodChips`·`CardTitle`·`CardRailBadges`·`CardBenefits` 가 등록 범위 밖 | 견학 2단계대로 「매물 카드 원자」를 찾아간 세션이 대부분의 부품을 못 본다 → 손롤 | Claude 발견 / **Codex·Cursor 재현** | scope 를 폴더(`components/`)나 다중 locator 로 넓힐지 «원본 소유자» 판단 필요. PM 이 임의 확정하지 않는다. 재현: `node 틀.mjs dev.design.atom.product_card` + `git -C C:\devreepasserp4 ls-tree --name-only origin/main components/ | findstr product-card` |
| DC-014 | P1 | **신규(2026-09-09).** freepasserp4 원장 이관: 「스왑점(`firebaseAdminDatabase`) 경유는 무수정 전환」이 **거짓**. 심이 문서 경로 아닌 `transaction()` 을 거부하는데 컬렉션·루트 호출이 **4파일 6자리** 실재 (inventory apply/rollback · sheet-daily-sync · sheet-live-status). Codex 가 심을 **실행해 재현** | 지금 `NEXT_PUBLIC_DATA_BACKEND=firestore` 로 플립하면 그 여섯이 터진다 | Codex 재현 / **Cursor·Gemini 미참여 → HOLD** | 플립 전 선행: 여섯을 문서 단위로 쪼개거나 다른 잠금으로. 규격·게이트는 freepasserp4 PR #214(`f20df8a7`) 반영. 상세: `operations/progress-handoff/2026-09-09-원장정본-Firestore.md`(업로드 제외). **후속(PR #216)** — 운영값 `rtdb` 확정(배포 번들에서 읽음) · `check:store` 가 여섯 자리를 센다 · 구현은 오더로 넘김(범위 4파일 · 플립은 오더에 없다) |
| DC-002 | P1 | 확인: `node 틀.mjs 디자인`이 결과 없음. 정확한 scope 검색은 동작 | 대표 사용 예제가 실제로 작동하지 않음 | Codex / Cursor | 검색 계약을 정한 뒤 한글 예제·정확 scope·미등록 검색 결과를 재현 |
| DC-003 | P1 | 확인: 로컬 ssot/PART.md는 ssot/로 이동했다고 기록. GitHub 초기 README는 이전 경로를 안내. 이동 관련 4파일 로컬 변경이 별도 진행 중 | 로컬과 원격 기준 혼용 | Claude / Codex·Cursor | 이동 담당 결과·단일 원본·진입점·최종 커밋·원격을 같은 버전으로 확인 |
| DC-004 | P1 | 확인: `git check-ignore ssot/ssot_audit.py`가 제외를 반환 | 로컬 검사기가 있어도 GitHub에서 복구할 수 없음 | Codex / Cursor | 안전하게 공개할 코드·가상 테스트만 허용하고 새 checkout에서 실행. 원시 검수/작업자료 일괄 업로드 금지 |
| DC-005 | P1 | 최근 호출 증거: Cursor/Gemini 작업폴더 신뢰 제한으로 검토 미실시 | 네 AI가 함께 움직인다고 선언할 수 없음 | Claude 조정·Codex 연결 / 각 도구 직접 응답 | 사용자 허용 범위에서 읽기 전용 실제 호출, 동일 버전 독립 응답 확보 |
| DC-006 | P1 | 미구현: UI/기능의 규격-구현 자동 대조와 공통 실행 엔진 | 등록·폴더 존재를 개발 완료로 오해 | Codex / Claude·Cursor·Gemini | 파일럿 하나에서 기준→실제 소비→수용/회귀 검사→인계까지 증거 연결 |
| DC-007 | P1 | 확인: teamjpkwork ERP 디자인 안내는 정본 선언과 사본 양쪽 갱신 지시를 함께 포함 | 기준의 소유자가 갈릴 수 있음 | Claude / Gemini·Cursor | 규격별 적용 범위·원본·사본 갱신 책임을 확인. fp4와 자동 통합 금지 |
| DC-008 | P2 | 설계 보완: operations/engine/runs 및 SSOT/conformance/testing 책임 중첩 위험 | 상태·판정·기록이 중복 생성 | Claude / Codex | 단일 실행기록, 기준 판정/구현 대조/실행 증거 책임 명세와 한 파일럿 |
| DC-009 | P2 | 확인: 1차 경로 후보에는 worktree 중복·깊이 제한이 있음 | 후보 개수를 재사용 가능한 부품 수로 오인 | Cursor / Gemini | repo+path+revision+의미/소비자 기준으로 후보 관계 정리. 독립 상품·자산 수로 단순 집계 금지 |
| DC-010 | P2 | 미완료: 공통 자산의 예제·소비자·호환/폐기·검증 상태 미정립 | 복사본 누더기·업그레이드 회귀 | Codex / Cursor·Gemini | 대표 UI/기능 자산에 계약·예제·버전·사용처·회귀·교체 경로 부착 |
| DC-011 | P2 | 운영 개선: 기존 자산 누락 요약으로 중복 개발을 제안했던 PM 기록 존재 | AI가 이미 있는 것을 다시 만듦 | Claude / 네 역할 | 작업 시작 시 등록 자산 확인 증거와 후보/HOLD 표시; 새 개발 전 재사용 검토 |

P1은 초기 운영 전에 해결할 중요 항목, P2는 단계적 정립 항목이다. 보안 사고 발생이나 이미 검증된 코드 결함이라는 뜻이 아니다. 담당 표는 작업 배분안이며 해당 도구가 실행/승인했다는 뜻이 아니다. 모든 항목은 현재 OPEN, 결과 미확보는 HOLD로 관리한다.

## 통일할 것

| 대상 | 통일 기준 | 보존할 차이 |
|---|---|---|
| 정본 참조 | 승인된 scope·원본 위치·버전·소유자 | 프로젝트별 의미/범위가 다른 규격 |
| 디자인 | 토큰·공통 부품 API·상태·접근성·예제 | 승인된 서비스별 테마·화면 패턴 |
| 기능 | 입력/출력·단위·조건·오류·호환 버전 | 서로 다른 업무 규칙과 권한 |
| AI 작업 | task ID·동일 기준 snapshot·범위·증거·상태·담당 | 도구별 실행 권한·강점·검수 역할 |
| 판정 | 실행 상태와 검사 결과 분리, 최종 gate 하나 | 검사별 PASS/HOLD/FAIL 및 원본 증거 |
| 기록 | run별 한 원장과 원본 참조 | 과거 증거의 시점/버전; 새 결과로 덮어쓰지 않음 |

## 실행 순서

1. DC-003/004: 진행 중인 이동을 담당자와 정리하고 로컬·GitHub·허용목록 경계를 맞춘다.
2. DC-001/002/005: 진입점 불일치와 검색 예제를 고치고 네 AI 읽기 전용 자문 연결을 확인한다.
3. DC-007/009/011: 현역 자산의 기준·범위·중복 후보를 정리한다.
4. DC-006/008/010: 지정 프로젝트 한 건으로 UI·기능 선택→검증→인계의 최소 흐름을 실행한다.

## 근거와 한계

현재 로컬 AGENTS.md, ssot/PART.md, registry.json, 틀.mjs, 어디를보나.md, .gitignore를 읽고 검색 예제·Git 차이·제외 규칙을 재확인했다. source-snapshot.json과 원시 출력은 로컬 reviews/2026-09-09-improvement-report에 보존한다. 과거 조사 근거는 로컬 reviews/2026-09-09-warehouse-inventory 및 group-part-review다. GitHub에는 이 비민감 요약만 올린다.

C:/dev/ssot-hub 경로는 관찰 당시 남아 있었다. 내용과 이동 완료를 대조하지 않았으므로 중복 엔진이 있다고 단정하지 않는다. 등록된 로컬 CSV의 과거 4-AI OK는 개발센터 전체나 이동 후 최종판의 OK가 아니다.
