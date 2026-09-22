# 본사 저장소 합병 분류안 — STEP 0 (2026-09-22)

- 상태: `PROPOSAL v0.2` — Claude 초안(C-0005) → Codex 검토 **MODIFY**(X-0002) → 반영. 대표 확정 전에는 아무것도 옮기지 않는다.
- 따르는 계획: [통합 실행 지침](../AI_CORE_INTEGRATION_EXECUTION_DIRECTIVE.md) 2절(분류 5종)·3절(물리 통합 원칙)·5절 STEP 0/4.
  기존 분류 [저장소 생애 감사 2026-09-20](../REPOSITORY_LIFECYCLE_AUDIT_2026-09-20.md) 은 생애(ACTIVE/RETIRE)만 정했고 합병 분류는 비어 있다.
- 대표(2026-09-22): 「결국 하나로 합쳐야 한다니까」 · 「디자인부터 aiops」 · 「개발센터 문서허브 다 하나로 합쳐야돼」 · 「work컨트롤 등등 다 합쳐야돼」 · 「그냥 다 갖고와서 ai코어 비대하게 늘리고」 · 본체 = **ai-core** · 「우리 이거 통합하는계획있는데 그거대로 해야지 혼자 결정할건 아니고」

## 왜 지금 (실측한 어긋남)

- 디자인 규격이 두 곳이다. ai-core `design-system/`+UI/UX 헌법이 실제로 쓰인다(freepass-admin 3 · freepass-sales 4 파일 참조, 개발센터 `sk-` 스킨킷 사용 0곳).
  그런데 개발센터 Design Hub `core-binding` 은 ai-core `ac8c502` 에 묶여 있어 최신 `cca1423` 과 규격 파일 6개가 다르다(2026-09-22 freepass-admin 세션 보고). 칩·토글·눌림 상태는 등록부 항목이 없다.
- 로컬 `C:\dev\devcenter` 는 `.git` 이 깨져 갱신이 안 되고, 원격에서 사라진 스킨킷이 남아 다른 세션이 규격으로 읽었다.
- 개발센터 `registry.json` 과 ai-core `registry/projects.json` 이 이중이다([MERGE-P0 결과](../handoffs/AI-CORE-MERGE-P0-RESULT.md)).

## 실측 근거 (명령·revision)

| 저장소 | 기준 커밋 | 추적 파일 | 명령 · 시각(UTC) |
|---|---|---|---|
| devcenter | `7d750606026589fcec4299609e53dc94e907e47a` | 4,535 | `gh api repos/freepass-creator/devcenter/git/trees/<sha>?recursive=1` · 2026-09-22T08:05:47Z |
| docshub | `4059d82779b7e1796afa2bbdf644e1d3bbdba3e7` | 19 (이 중 14 = `.ai-core/` 시작 키트) | 같은 꼴 · 08:05:48Z |
| aiops | `3d6ec8c6a0e826ae0472e3fb3e8bbaa8399b68c9` | 1,407 | 같은 꼴 · 08:05:49Z |

- 배포·워크플로 · 자료 의심은 위 트리에서 경로 패턴(`vercel.json|firebase.json|.github/workflows/` · `lib/wonja/|.env|계좌|입금|미수|credential|secret|.xlsx|.csv`)으로 본 것이다 — 이름으로 본 것이지 내용 검사가 아니다.
- aiops 를 부르는 이 PC 예약작업: `Get-ScheduledTask` 에서 Actions 에 `aiops` 가 든 것 6개(Ready 1). 전역 `~/.claude/CLAUDE.md` 가 `C:\dev\aiops` 스크립트를 직접 부른다.
- ai-core 안에서 `freepass-creator/devcenter` 를 실제 대상으로 지목하는 파일(`git grep origin/main`): `registry/projects.json` · `registry/work-map.json` · `registry/ui-ux-entrypoint.json` · `examples/repository-lifecycle-2026-09-20.json` · `docs/inventory/C-DEV-2026-09-15.json` · `docs/research/a-session-*.v1.json` 4개.
- ★로컬 `C:\dev\docshub` 는 **git 저장소가 아니다**(파일 581개, `.git` 없음). 실제 문서허브(`양식/` 생성기·`data/` 등록부·PDF 도구)는 **로컬에만** 있고 원격 `docshub` 저장소는 작은 정적 앱(`app.js`·`index.html`·`styles.css`)+키트뿐이다. 로컬 폴더에는 **소송 사건 서류**(`사건/`, `_레거시/고소장`)가 섞여 있다.

## 분류안 (Codex X-0002 반영)

| 저장소 | 제안 | 까닭 | 반례 · 조건 |
|---|---|---|---|
| **devcenter** | **MERGE_PHYSICAL** → `ai-core/devcenter/` | 「원래 같은 정본」이어서가 아니다 — ai-core 가 규격 정본이고, devcenter 는 등록·감사·Design/Quality Hub 실행 기능을 가진 **별도 소비자**인데 대표 최신 직접 지시로 본체에 흡수한다(X-0002 정정). 두 곳에 두는 동안 이미 어긋났다(binding `ac8c502` ↔ 최신 `cca1423`, 규격 파일 6개 차이) | **먼저 실험**: 복사본을 갈래에 들여 참조 전환(위 9개 파일)과 기능 대조(원 저장소 검사를 새 위치에서 같은 결과)를 한 뒤에 전환 |
| **docshub** | **HOLD** — 범위 확정 뒤 MERGE_PHYSICAL | 옮길 실제 내용이 git 밖 로컬 폴더에 있고 사건 서류가 섞여 있다. Gmail 템플릿·`docshub.com` 운영 경계도 확인 전(X-0002) | 옮긴다면 `양식/`·`data/`(생성기·등록부)만. **사건 서류는 옮기지 않는다** — 민감 자료이고 사건은 `casemap` 계열 몫이다 |
| **workcontrol** | **RETIRE 유지** (합치지 않음) | 09-20 이미 RETIRE — 직원 관제 코드는 aiops·teamjpkwork 로 옮겨짐 | 옛 배포·도메인 확인 전 archive·삭제 금지(감사 58·82줄) |
| **aiops** | **2단계** — ① `EXTRACT_SHARED` ② 조건 충족 뒤 물리 합병 | 경로·예약·운영 자료에 기대는 것이 많아 한 번에 옮기면 미수·과태료·지킴이 같은 운영이 멈춘다 | ① 은 `lib/*` 파일 이동이 **아니다**(X-0002): ai-core 가 **공통 계약·adapter 를 revision 에 묶어 제공**하고 aiops 가 운영 실행을 소유한다. aiops 기존 호출자와 **같은 결과**를 내는지 검증한다. Codex 가 이미 이 방향(starter kit · request identity · 보험·재무 read adapter · 보안 승인 경계)으로 고쳐 왔다 |
| teamjpkwork · freepass-admin · freepass-sales · freepasserp4 · freepass-data · 견적기 · 홈페이지 | **KEEP_SEPARATE** (이번 범위 밖) | 각자 배포·도메인·Firebase·OIDC 가 저장소 이름에 묶여 있다(예: fp4 `erp5-ssot-refresh.yml` OIDC provider `freepasserp4`). 지침 3절 | 본사 통합과 Git 합병을 구분한다 — 합치려면 배포 전환 계획이 따로 필요 |

aiops ② 물리 합병의 조건(전부 충족 시):
- 이력 전체의 개인정보·계좌 자료 검사 통과(없으면 이력 없이 현재 트리만)
- `C:\dev\aiops` 를 부르는 곳 목록(전역 지침·예약작업·스크립트) 전환 완료
- 켜진 예약작업의 새 경로 1회 관측

## 옮기는 법 — «복사해서 가져온다» (MERGE_PHYSICAL 공통)

대표(2026-09-22): 「옮기는 계획은 복사하는 방식으로 갖고오는 방식으로 하자 그게 맞을거 같다」

지침 3절 순서 `원형 보존 → 새 위치 구성 → 동일 revision/기능 검증 → 경로 의존성 확인 → 전환 → 일정 기간 관측 → 기존 위치 read-only/retire 판단` 을 복사로 채운다.

1. **원형 보존** — 원 저장소·로컬 폴더는 **건드리지 않는다.** 문제가 생기면 원본으로 바로 돌아간다.
2. **복사** — 원 저장소 기본 갈래의 **한 커밋**을 골라, 추적된 파일(`git archive <sha>`)만 `ai-core/<이름>/` 에 복사한다.
   - **이력은 들이지 않는다** — 과거에 커밋됐던 개인정보·계좌 자료(aiops 원자 이력 등)가 따라오지 않는다. 이력은 원 저장소에 그대로 있다.
   - 미추적·무시 파일(`.env`·`node_modules`·`.local`·빌드 산출물)은 복사하지 않는다.
   - 복사 전에 열쇠·개인정보 검사를 돌린다.
3. **출처 기록** — `ai-core/<이름>/PROVENANCE.json` 에 원 저장소 · 커밋 SHA · 복사 시각 · 제외 규칙 · 파일 수·해시 목록을 남긴다. 「어디서 언제 가져왔나」에 늘 답이 있다.
4. **검증** — 원 저장소의 검사를 새 위치에서 그대로 돌려 같은 결과. ai-core 루트 검사는 그대로 초록.
5. **경로 전환** — 원본을 부르는 곳(문서·스크립트·예약작업·세션 지침)을 새 경로로. 그 전까지 원본이 계속 운영을 맡는다.
6. **이중 쓰기 금지** — 복사한 뒤로는 **새 위치만 고친다.** 원 저장소 README 첫 줄에 「<날짜> 에 ai-core/<이름> 으로 복사됨 · 여기는 더 고치지 않는다」 를 적는다.
   원본 쪽에서 복사 뒤에 생긴 커밋이 있으면 전환 전에 한 번 더 복사해 맞춘다(PROVENANCE 의 SHA 로 차이를 본다).
7. **관측 뒤 정리** — 일정 기간 새 위치로 문제없이 돌면 원 저장소 archive 여부를 대표가 정한다. 로컬 폴더는 지우지 않고 `<이름>.moved-YYYYMMDD` 로 이름만 바꾼다.

## 같이 바꿔야 하는 ai-core 쪽 — Codex 가 맡는다 (X-0002)

- `verify-main-state` — 들인 경로를 통째로 **빼지 않는다**(증거를 숨긴다 — 초안의 내 안은 REJECT). 에피소드별 scope/manifest 로 검사기를 일반화한다.
- 루트 CI — 들인 저장소의 검사를 붙인다. 먼저 각 저장소의 install/test 명령·Node 버전·비밀 없이 도는 실행을 고정한다.
- Design Hub `core-binding` — 「같은 커밋」은 늘 참이라 검증이 아니다(초안의 내 안은 MODIFY). design-system 원본 묶음의 digest · schema version · 소비자가 채택한 revision 을 검사한다.

**반례(Codex)** — 복사해 들인 뒤 검사기에서 그 경로를 빼고 binding 을 「같은 커밋」 으로만 보면, Design Hub 가 옛 토큰을 계속 써도 전체가 PASS 한다. 물리 합병은 됐지만 「정본 하나」 문제는 그대로다. → 위 세 가지가 끝나기 전에는 devcenter 전환을 끝났다고 하지 않는다.

## 순서와 나눔

① **devcenter**(디자인부터) — 복사 실험·참조 전환·기능 대조: **Claude** / 검사기·CI·binding: **Codex** / 병합: **Codex**
② **docshub** — 대표가 범위(양식·data 만, 사건 서류 제외) 확정 뒤
③ **aiops ①** 계약·adapter 추출 — Codex 가 하던 방향 그대로, Claude 는 반례 검토
④ **aiops ②** — 조건 충족 뒤

한 번에 하나. 각 단계는 초안 PR 로 잡는다(책상 규칙 4절).
