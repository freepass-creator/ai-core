# GROUP-G0 — 현황 고정

## 기준

- base revision: `freepass-creator/ai-core@655939e` (origin/main, 2026-09-16 확인)
- branch: `group/g0-result` (신규, `work/codex/control-tower`에서 분기)
- target repos: `C:\dev` 전체 (33개 고유 저장소, 69개 로컬 체크아웃)
- 실행자: Claude (로컬), 사용자 직접 지시로 GPT(ChatGPT)의 `CLAUDE_GROUP_INTEGRATION_HANDOFF.md`·`AI_CORE_GROUP_MASTER_PLAN.md` 인계를 받아 수행

## 실제 수행

1. **기존 자산 재확인** — 이동 전에 이미 있는 것부터 찾았다.
   - `docs/inventory/C-DEV-2026-09-15.json`(commit `b438fca`, 현재 HEAD에 이미 포함): 33개 고유 저장소, 69개 체크아웃, 중복 체크아웃 그룹(freepasserp4 계열 30개, ai-core 계열 3개, sales 계열 2개, teamjpkwork 계열 2개)을 이미 기계적으로 잡아냄. **이 파일이 raw inventory의 정본이다.**
   - `aiops/docs/저장소지도.md`: 사람이 판정한 ACTIVE/REFERENCE/HOLD/RETIRE 분류가 이미 존재(2026-09-09~11, 대표+Codex+Gemini+Cursor 합의). jpkerp5 RETIRE, freepasserp/2/3 보관, jpkerp/jpkerp2/jpkerp-v4 보관 등.
   - `devcenter/registry.json`: dataset-scope 등록부(project→authoritative doc 매핑), Project Capsule과 다른 성격.
   - Control Tower(`work/codex/control-tower`)에 `contracts/`, `scripts/inventory-repositories.mjs`, `scripts/work-ledger.mjs`, `scripts/run-control-tower.mjs`, `scripts/evaluate-control-tower.mjs`가 이미 구현·테스트됨(이번 세션 초반 독립 검토로 확인, PR22 인계 대상).
   - `ai-core/docs/orders.mjs` 계열(work/codex/order-control-v1): 별도 오더 접수·claim/lease UI 프로토타입. **아직 Control Tower work ledger와 어댑터로 연결 안 됨**(`docs/ORDER_CONTROL_INTEGRATION.md`에 이미 기록된 미해결 상태).
   - **실수**: 위 자산들을 다 찾고도 세션 중 두 차례 `AI-CORE-GROUP/headquarters/ai-core/registry/projects.json`이라는 중복 registry를 새로 만들었다가 사용자 지적으로 수정했다. 현재는 raw 사실은 C-DEV 인벤토리를 가리키고, 그 위의 판정(ACTIVE/REFERENCE/HOLD/RETIRE) 레이어만 유지하도록 고쳤다.

2. **`AI-CORE-GROUP` 폴더 존재 확인** — 없었다. `C:\dev\AI-CORE-GROUP\headquarters\ai-core\registry\`와 `subsidiaries\`를 골격만 만들었다(빈 폴더 + 위 registry 파일 1개). 기존 폴더를 덮어쓴 적 없음.

3. **실제 운영 문제 3건을 부수적으로 발견·해결**(GROUP-G0 범위는 아니지만 같은 세션에서 나옴, 별도 커밋):
   - `aiops`: `.gitignore`의 `*.png` 주석 처리로 개인정보성 과태료 고지서 스크린샷이 커밋 위험에 노출 — 수정.
   - `aiops`: 5일간 죽어있던 `aiops-daily` 스케줄 작업의 근본 원인(Firestore lease 미인식, 429 할당량)이 이미 코드로 고쳐진 채 미커밋 상태였음 — 복구 커밋.
   - `aiops`: 과태료 발송전 사전점검 스크립트가 `공문꼴()` 필터 누락으로 안내 메모 파일을 "짝 없는 공문"으로 오판 — 수정.
   - 총 7개 aiops 커밋, 전부 로컬 테스트 통과 확인 후 커밋(원격 push는 미실행 — aiops는 여전히 대형 파일 이력 문제로 push 자체가 막혀 있음, 별도 과제로 보류).

4. **미이동**: 어떤 저장소도 옮기거나 삭제하지 않았다. 모든 원본 위치·Git 이력·미커밋 변경은 그대로 있다.

## 검증

- PASS: `docs/inventory/C-DEV-2026-09-15.json`이 이미 HEAD에 존재함을 `git merge-base --is-ancestor` 로 확인.
- PASS: aiops 7개 커밋 전부 관련 테스트 실행 후 통과 확인(245/246 → 픽스 → 721/725, 나머지 4실패는 무관한 기존 이슈로 확인).
- SKIP: `AI-CORE-GROUP` 골격 폴더 자체의 baseline build/test — 아직 코드가 없어 해당 없음(NOT_APPLICABLE).
- UNKNOWN: freepasserp4 worktree 30개 각각의 정확한 병합 상태 — 별도 에이전트 조사로 "살릴 가치 있는 미병합 브랜치" 후보 목록은 얻었으나(`fix/sonokong-rent-plate-classification`, `codex/rtdb-cutover-current` 등), 3-way diff 대조는 미실행.

## 보존 확인

- dirty state: `aiops`(161→일부 커밋 후 잔여), `devcenter`(100, 미착수), `docshub`(1525, 미착수) — 전부 원본 그대로, 임의 정리 안 함.
- SSOT: 어떤 프로젝트의 SSOT 선언도 변경하지 않음.
- deployment: 배포 대상·환경변수·도메인 변경 없음.
- data: 실제 업무 데이터(계약·미수·과태료 원자)는 오직 aiops 자체 스케줄 파이프라인이 생성한 결과만 커밋했고, 그 외 어떤 값도 수정하지 않음.

## 미확인 / 위험

1. **AI Core 본사가 세 번째 중복 조정 시스템이 될 위험.** aiops는 이미 자체 승인등급(`lib/seungin.mjs`, local/drive-add/protected)과 4-AI 협업판(`scripts/협업.mjs`)이 실사용 중이다. Control Tower(work ledger)와 order-control-v1(오더 UI)도 서로 아직 안 이어져 있다. G1에서 AI Core 라우팅을 새로 만들기 전에 **이 세 체계(aiops 협업판 / Control Tower work ledger / order-control UI) 중 무엇을 본사 표준으로 삼을지부터 결정해야** 한다. 이 결정은 마스터플랜에 없다 — 사용자 확인 필요.
2. **freepasserp4 worktree 30개의 실제 처분**은 GROUP-G0 범위 밖이지만 G2(첫 자회사 파일럿)를 freepasserp4로 잡으면 반드시 선행돼야 한다.
3. **aiops push 불가 상태**가 지속되면 GitHub 기준 registry 관측치가 로컬보다 계속 낙후된다. G0/G1 산출물이 aiops의 최신 상태를 반영 못 할 수 있음을 감안해야 한다.

## 추천 파일럿 (G2용, 아직 미실행)

마스터플랜 10.2절 기준("현역·운영배포 불변·build/test 가능·비밀 의존 낮음·최근 실제 요청 있음")으로 재평가:

- **`freepass-sales`**: ACTIVE, clean, 최근 커밋(2026-09-15), 오늘 세션에서도 `sales`라는 중복 체크아웃 문제가 이미 확인됨(정리 자체가 파일럿 산출물이 될 수 있음). freepasserp4/aiops보다 훨씬 작고 격리돼 있음.
- 차선: `fp-settlement`(ACTIVE, clean, 커밋 2026-09-12).
- 기각: 이전에 내가 제안했던 `vehicle-master`/`rentsafe`/`ci_center` 등은 REFERENCE 상태로 "최근 실제 요청"이 없어 마스터플랜 기준 미달.

## 다음 한 작업

사용자 확인 필요: 위 "미확인/위험 1"(세 조정 체계 중 본사 표준 선택)과 "추천 파일럿"(freepass-sales) 승인. 승인되면 G1(본사 최소 골격: registry validation + capsule schema 확정)로 진행.
