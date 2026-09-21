# AI Core 실행세트 카탈로그 후보

상태: `CANDIDATE / HOLD`
관측 기준: `freepass-creator/ai-core@fe7589def35ffa0bde4e4df7714e8f4b5abae534`

## 목적과 경계

사용자가 `UI SET-01 + 실행세트 RUN-01`처럼 말로 공통 UI와 실행 구성을 함께 고를 수 있게 한다. 이 문서는 새 실행 프레임워크를 만들지 않는다. `registry/runtime-sets.candidate.json`은 기존 Workflow Engine, Operating/Capability Engine, Engine-Adapter Contract, Order-Work Adapter와 실제 프로젝트 구현을 영구 ID로 가리키는 읽기 전용 projection이다.

선택 결과는 실행·배포·데이터 쓰기·외부 전송 권한을 만들지 않는다. UI `SET-*`의 실제 내용과 채택 여부는 UI/UX 전담 registry/PR이 소유한다. 이 카탈로그는 선택 문구의 UI ID를 보존할 뿐 중복 UI 정본을 만들지 않는다.

## 영구 ID 구분

| 접두어 | 의미 | 책임 |
| --- | --- | --- |
| `E` | 업무 엔진 | 업무 의미, workflow, capability 실행 판정 |
| `A` | 어댑터 | Port 구현, 필드·단위·오류 매핑 |
| `R` | Repository | 저장, 원자성, idempotency, 동시성 |
| `X` | Connector | GitHub/API/전송 연결과 직렬화 |
| `P` | Provider | 외부 서비스/공급자 경계 |

## 실행세트

| ID | 이름 | 현재 판단 | 실제 구현과 주요 HOLD |
| --- | --- | --- | --- |
| `RUN-01` | 표준 웹업무 | 추천 후보 / HOLD | D Workflow Engine + ERP4 Firestore adapter/repository + GitHub work/evidence connector. Core와 ERP4 구현은 존재하지만 대상 프로젝트별 schema/auth/rules/deployed revision이 미확인이므로 자동 운영 바인딩 금지. |
| `RUN-02` | 조회·모니터링 | HOLD | Sales exact-match read adapter와 AI Core read-only capability는 존재한다. 범용 Firestore reader는 없으며 프로젝트별 최소정보·credential 확인이 필요하다. |
| `RUN-03` | 문서생성 | HOLD | 파일 저장소와 GitHub handoff는 있지만 파일 어댑터는 로컬/SHADOW 전용이고 DocsHub production capability는 ACTIVE가 아니다. |
| `RUN-04` | AI 협업·GitHub 인계 | HOLD | order/work mapping, result coordinator, GitHub inspector와 privacy-checked packet은 존재한다. claim/merge/deploy/send/complete 권한은 별도다. |

세부 구성요소, 적용 가능 레포, 실제 구현 revision, 권한·배포 상태, HOLD 조건과 검증 명령은 registry에 있다.

## 확인된 프로젝트 구현

- FreePass ERP4 remote `main@257e742d73781af89c94809770f1d4208900fba9`: `lib/server/firestore-path-store.ts`, `lib/server/erp5-firestore-app.ts`. Firestore-only 구현은 있으나 이 카탈로그에서 운영 credential/deployed revision은 확인하지 않았다.
- FreePass Admin remote `main@02deb4df0fcb123a478519e3cbb408cd5e2ad7c6`: file application adapter/repository. 코드 주석과 계약대로 개발·검증 전용이며 운영 persistence가 아니다.
- FreePass Sales remote `main@18a324021a783bdfa7abf33f521542ae7c0a4338`: read-only customer search adapter. 연결 실패는 HOLD이며 최소 projection만 반환한다.
- Welrix Table remote `main@56affca1fc4e419000afe3e42f8821e5458d2071`: quote provider mapping. live provider parity는 별도 검사이며 실패 시 임의 계산으로 대체하지 않는다.

문서 존재나 GitHub 파일 존재는 배포·운영 채택 증거가 아니다. 각 source revision은 GitHub Contents API에서 대상 path/blob을 재조회했지만 실제 운영 바인딩은 별도 HOLD다.

## 검증

```powershell
npm run runtime-sets:validate
node --test test/runtime-set-catalog.test.mjs
```

전체 회귀 검사는 `npm test`, 저장소 정합성은 `npm run verify`로 확인한다. 외부 프로젝트 명령은 registry에 기록된 대상 checkout에서 별도로 실행해야 하며, 이 후보를 검증한다는 이유로 운영 credential·DB·배포를 건드리지 않는다.

## Working set

활성 자료는 현재 원격 `main`, 최신 `WORK_READ_FIRST.md`/`memory/CURRENT.md`/`memory/CANONICAL.md`, 현재 오더, 그리고 registry에 적은 revision-bound code/test evidence뿐이다. 과거 ChatGPT 대화·메일·research 문서는 candidate source이며 자동 채택하지 않는다. 이미 구현된 Engine/Adapter 계약은 `duplicate_of`에 해당하므로 새 계약을 만들지 않았고, 오래된 open PR이나 문서-only 제안은 이 실행세트의 구현 증거에서 제외했다.
