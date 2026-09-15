# 프로젝트 분류 근거 색인 — 2026-09-15

비민감 파생 색인. 원본 문서·기존 registry의 사본이 아니다. 분류 제안은 [검토안](PROJECT_LIFECYCLE_REVIEW_20260915.md)을 본다.

## 조사 범위와 방법

- 앱 `list_projects`: 로컬 13개, ChatGPT 5개. 앱 `list_threads(limit=50)`: 최근 50개와 sidebar 상태. 표시되지 않은 작업의 부재·종료를 추정하지 않는다.
- 등록된 로컬 경로에서 `git rev-parse`, `branch`, `log -1 --format=%cI`, `status --porcelain=v1 --untracked-files=all`, origin URL 설정, worktree 수만 조회했다. dirty 파일 내용은 읽지 않았다. 원격 URL의 인증정보를 출력하거나 보존하지 않았다.
- 문서는 아래 지정된 README/인계의 제한된 앞부분과 메타데이터만 읽었다. 개인 업무·고객 원문·메일·사건 세부 내용·토큰·환경 파일은 수집하지 않았다.
- 수치는 상태 행 수이며 용량·코드 변경량·업무 위험도 순위가 아니다. ignored 파일은 제외된다. tracked dirty와 untracked를 분리해 재집계했다.
- 개별 읽기 시점의 관측이며 원자적 전체 스냅샷이 아니다. 2026-09-15 오전 조사; 수정 중인 프로젝트는 후속 실행 직전 재조회해야 한다.

## 로컬 코드/자료 위치와 관측 버전

`T/U`는 tracked dirty / untracked 상태 행 수. `없음`은 확인한 범위에서 없음, `미확인`은 조회 안 함이다. 아래 GitHub 표기는 origin 설정에서 읽은 `freepass-creator/` 하위 리포명이다. 원격 최신·백업 완전성을 뜻하지 않는다.

| ID | 앱 등록 경로 | origin 리포 | branch | HEAD | T/U | worktree |
| --- | --- | --- | --- | --- | --- | --- |
| L01 | `C:/dev/ai-core` | `ai-core` | `work/codex/order-control-v1` | `e8e66621cf4e3a277ef634ca6040dede093d375f` | 0/0 | 7 |
| L02 | `C:/Users/admin/Documents/ChatGPT/뮤카 JB우리캐피탈 제안서` | `mewcar-jbwoori-proposal` | `cursor/jbwoori-proposal-redesign-b176` | `5d18a17722cb569f0387b5de0272336f765c3396` | 2/499 | 1 |
| L03 | `C:/dev/sales` | `freepass-sales` | `main` | `f89c448836ee0f49f2a8a297225eea4c439cc1c4` | 23/47 | 5 |
| L04 | `C:/Users/admin/Documents/ChatGPT/ssot-hub` | 없음 | `main` | **커밋 없음** | 0/2 | 1 |
| L05 | `C:/dev/freepasserp4` | `freepasserp4` | `feat/spring-atom-monitor` | `4d962b2db293a8cc193a106008b0270265dcd30d` | 17/62 | 52 |
| L06 | `C:/dev/docshub` | `docshub` | `main` | `7fa99a9389fb2161f5fa726451ba0f273429060c` | 1419/13459 | 1 |
| L07 | `C:/dev/devcenter` | `devcenter` | `main` | `4ee253fb1b55e285e90073d26ed48706e1d837c9` | 88/17 | 1 |
| L08 | `C:/dev/webtoon-studio` | `webtoon-studio` | `main` | `09e0c456cf76dd5097e7fcfd06a472b5329a8785` | 17/3648* | 1 |
| L09 | `C:/Users/admin/Documents/ChatGPT/New project 4` | 없음 | `main` | **커밋 없음** | 0/30 | 1 |
| L10 | `C:/dev/sonogong-estimator` | `sonogong-estimator` | `main` | `c79b8cdc453ef52793081c1d9a51b605b77755dd` | 27/23 | 1 |
| L11 | `C:/dev/aiops` | `aiops` | `main` | `875219b20825650b0390cf4505062ba77b695769` | 119/243 | 7 |
| L12 | `C:/dev/casemap` | `casemap-private` | `main` | `21ebdeca4f15f090b8f3e32a4b411390d62ea4fc` | 3/574 | 1 |
| L13 | `C:/dev/chakhandeal` | `chakhandeal` | `cursor/freepass-esign-issue-20260808` | `ce56c92f84dd3813a2a04ec4ee4ba215fc78f333` | 0/0 | 1 |

*L08 git status에서 일부 pytest 임시 디렉터리 접근이 거부돼 미추적 수의 완전성을 입증하지 못했다. 권한 변경이나 해당 파일 내용 조사는 하지 않았다.

마지막 커밋 시각은 메타데이터로 얻었지만 현역/폐기 판정에 사용하지 않았다. L06의 오래된 HEAD와 최근 문서 작업, L09의 미커밋 소스는 Git 이력만으로 현재 업무를 나타낼 수 없는 사례다.

## 현재 실행점 보정 — 공유 폴더와 분리

- L01 개발 통합 담당: `01a0a2c1-7397-7733-92f1-1dde9b98075c`, 작업 이름은 총괄이 전달한 **AI Core · 개발 통합 실행**.
- 통합 worktree: `C:/Users/admin/.codex/worktrees/1e61/ai-core`, branch `codex/order-control-integration`.
- 읽은 HEAD: `80d28069aae0d736f70a71a76e2874c649ed6da6`, commit 시각 `2026-09-15T11:03:22+09:00`. 당시 tracked 변경 14개. **메타데이터만 확인했으며 파일 내용·검사 결과는 읽지 않았다.** 구현 없음 또는 통합 완료 어느 쪽으로도 판정하지 않는다.
- 어댑터 기존 담당 증거: 최종 `c1cb32c0916c518680c872c52d4c90e123069474`, 실제 계약 포함 53/53, 고정 PR20 원본 검사 134/134. 이는 이 작업에서 앞서 직접 실행한 검사이며 **통합 브랜치 전체 PASS가 아니다**. 이번 포트폴리오 작업은 어댑터 3파일을 수정하지 않는다.
- L03 담당 작업: `01a09e68-f917-7420-bfea-fdd0435f257a`, 제목 **프리패스세일즈 GitHub 리포 찾기**. 총괄의 최신 배정은 GitHub 기준·repo-name에 맞는 로컬 경로 확인과 원본 보존/차이 분류다.
- **L03 후속 직접 확인:** 새 `C:/dev/freepass-sales`는 `main`, HEAD와 로컬 `origin/main`이 모두 `50a018021bb233fe292eab0ff9b8959073d32936`, git status clean이다. 앱 등록 경로는 초기 조회의 `C:/dev/sales`와 구분한다. 원격 private/default main 확인과 typecheck/check:web 통과는 sales 담당 보고이며 본 조사에서 재실행하지 않았다.
- 기존 `C:/dev/sales`는 원본 보존·차이 대조 대기다. `--untracked-files=normal` 재조회는 42개(23 tracked/19 untracked 묶음), 위 표의 `all` 조회는 70개(23/47 개별 파일)다. 집계 옵션 차이를 파일이 삭제됐거나 변경이 증가한 것으로 해석하지 않는다.
- **L03 담당 차이 대조 보고:** 실질 채택 후보는 `웹/rent.html`, `웹/assets/brands/hyundai.png`, `웹/assets/brands/kia.svg`, `웹/assets/brands/genesis.svg`, `웹/assets/brands/sources.json`, `docs/promotion-vehicle-prices.json`의 6파일이다. 나머지는 줄바꿈/옛 HEAD 영향으로 대부분 내용상 동일하다는 보고이며 본 조사에서 각 diff를 독립 재검증하지 않았다. 해당 프로모션 묶음은 사용자 확인 중으로 미이관이다. preview 8793은 `C:/dev/sales-mail-automation/웹`을 유지한다는 담당 보고다. 기존 경로 삭제·운영 배포·별도 백업은 완료된 것으로 표시하지 않는다.

## 각 항목의 문서 근거와 완료/미완 경계

| ID | 실제 읽은 근거 | 확인한 것 / 확인하지 않은 것 |
| --- | --- | --- |
| L01 | `C:/dev/ai-core/README.md` + 위 통합 worktree metadata | 공유 브랜치 문서는 수동 오더·인계와 원격 대기를 설명. 이후 진행된 통합 상태를 이 README만으로 부정하지 않음. |
| L02 | 등록 경로 `README.md`; `docs/CODEX_HANDOFF_LATEST.md`, 루트 동명 파일 존재 검사 | 로컬 README는 v2 제작 구조와 내부 검토 상태. 확인한 두 인계 경로는 없음. 다른 브랜치/원격의 최신 인계 존재는 미확인. 내부 문안·회의 원문은 읽지 않음. |
| L03 | `C:/dev/sales/README.md` | 운영 `웹/`, 고도화 `app/`, Hosting/Auth/Firestore 관계는 문서 확인. 배포·Galaxy·서버 저장 ack는 재실행하지 않음. |
| L04 | 등록 경로 `AGENTS.md`, `C:/dev/devcenter/ssot/AGENTS.md`; 엔진 git top/HEAD | 앱 폴더는 진입점. 엔진은 L07 리포 내부 `ssot`로 현재 같은 HEAD. 별도 ssot 엔진이 중복 존재한다고 분류하지 않음. 해당 엔진의 합격 검수는 이번 범위 아님. |
| L05 | `C:/dev/freepasserp4/HANDOFF.md` 제한된 앞부분 | 전자계약/상품/규격·검토 게이트와 과거 검증 기록. 오래된 배포·RTDB 관련 문구는 현재 사실/허가로 채택하지 않음. |
| L06 | 루트 진입 README/인계 없음 확인, package metadata 없음 확인, 앱 목록의 최근 검토 작업 존재 | 자료 허브라는 지도 설명과 작업 흔적. 파일 내용/사건 세부/보존기간/원격 동기화 미확인. |
| L07 | `README.md`, `WAREHOUSE-INDEX.md` | 후보 자산/검사기 존재에 대한 문서, 의미 자동대조 미구현·최종 검수 HOLD 기록. 실행 run은 열지 않음. |
| L08 | `README.md` | 창작·로컬 생성기·브라우저 작업 사본·Drive 보관 흐름. 생성 이미지, 개인 설정, 브라우저 데이터, 실제 백업은 열지 않음. |
| L09 | `README_KO.md` | 로컬 이미지 작업실 목적·독립 기능·제약. 설치/모델/실제 GPU 실행/산출물은 확인하지 않음. |
| L10 | `package.json`의 name/description, `PLAN.md` 앞부분 | 견적기 역할, ERP가 데이터 소유/견적기는 표시 역할, 미완 항목의 과거 기록. 현재 코드 반영·가격 정책·운영은 미확인. |
| L11 | `README.md`, `docs/저장소지도.md` 제한된 범위 | 운영 도구함·중앙 승인/재읽기와 기존 현역/보관 기록. 실제 Sheet/Drive/원문/금액은 조회하지 않음. |
| L12 | `README.md` | 사건지도 구조와 watch-sync 설계 설명. 자동 작업 실제 가동/성공·원격 원본 보존은 미확인. |
| L13 | `README.md`, `HANDOVER.md` 앞부분 | 인계는 DEMO·ERP 전자계약·남은 외부연동을 기록. 서명/봉인·배포 실동작은 미확인. |

## ChatGPT 등록 프로젝트 — 코드 리포로 세지 않음

| ID | 앱 이름 | 앱 프로젝트 ID | 연결 해석과 한계 |
| --- | --- | --- | --- |
| C01 | freepass-sales v1 개발 | `g-p-6aa670ffa1a08191a8991394f60e1fd7` | L03 관련 대화로 보이나 독립 코드 checkout/HEAD는 제공되지 않음 |
| C02 | ai-core v1 개발 | `g-p-6aa67287c02081919ac26289a954c12a` | L01 관련 대화. 대화 전체·지시 이력은 별도 담당 범위 |
| C03 | erp4 유지관리 | `g-p-6aa671f1ada08191b47e4cc15b64e7a7` | L05 유지관리 맥락. 현재 운영 완료를 뜻하지 않음 |
| C04 | freepasserp.com v1 개발 | `g-p-6aa670b56e948191b936cab1f833a930` | ERP 재구축 맥락. 실제 신규 코드 저장소는 이번 조회로 미확인 |
| C05 | 뮤카 JB우리캐피탈 제안 | `g-p-6aa73c38d5c48191bc6c3839d7c6a37a` | L02 관련 대화. 원고/결정의 정본 일치 여부는 별도 대조 필요 |

## 기존 지도와 현재 관측의 차이 — 수정 제안만

1. 저장소지도 2026-09-09는 devcenter를 Git 아님으로 기록하지만 현재 L07 Git/remote/HEAD가 존재한다. 해당 지도와 등록부 소유자가 근거를 확인해 갱신할 항목이며 본 조사에서 수정하지 않았다.
2. 등록 ssot-hub의 AGENTS는 엔진을 `C:/dev/devcenter/ssot`로 지정한다. 예전 `C:/dev/ssot-hub`를 현재 정본이라고 자동 추정하지 않는다.
3. 지도 속 과거 docshub·sales·webtoon 상태와 숫자는 현재 관측과 다르다. 최근 작업은 확인했으나 '현역 승격' 사용자 결정으로 자동 바꾸지 않는다.
4. local 뮤카 README와 최신 정본은 별도 확인이 필요하다. 현재 redesign 브랜치를 main 또는 최신 확정본으로 표시하지 않는다.
5. AI Core 공유 worktree와 별도 통합 worktree, sales 현재 폴더와 예정 이관 경로를 각각 구분한다.

## 검토·검증 상태

파일 내용이 바뀌는 테스트·서버·클라우드 확인은 실행하지 않았다. 이 산출물의 검증은 등록 18개 누락 여부, ID/경로/커밋·분류 근거 연결, 금지 범위 변경 여부, Markdown diff·민감정보 점검이다. Claude 독립 검토 호출은 사용 한도로 실패했으며 독립 합격으로 계산하지 않는다. 실제 보관본·해시·복원 테스트는 아직 없고, 그것이 필요한 삭제 판단은 유보한다.
