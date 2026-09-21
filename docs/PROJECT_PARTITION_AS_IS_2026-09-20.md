# 현행 자산 기준 프로젝트·파트 구분

기준일: 2026-09-20  
목적: 새 구조를 발명하지 않고, 현재 로컬 저장소·GitHub·코드·설정에서 확인된 범위로 프로젝트와 파트를 나눈다.

## 1. 판정 원칙

1. 회사·사업 이름, 제품 화면, 데이터 정본, 공통 운영 도구를 한 프로젝트로 섞지 않는다.
2. 같은 GitHub 원격을 가리키는 로컬 폴더는 별도 프로젝트로 세지 않는다.
3. 코드가 있다는 사실과 실제 운영 중이라는 사실을 구분한다.
4. 운영 배포와 실제 사용이 확인되지 않은 항목은 `HOLD`로 둔다.
5. 신규 저장소와 신규 Firebase 프로젝트는 현행 자산으로 해결할 수 없는 경우에만 검토한다.
6. Firebase RTDB는 폐기 상태를 유지하며, Firestore 정본이 불명확하면 `HOLD`로 둔다.

## 2. 내부 프로젝트 구분

### A. AI Core — 전체 업무 총괄

| 항목 | 현행 자산 | 맡는 범위 |
|---|---|---|
| 오더·세션·인계·검증 | `freepass-creator/ai-core` | 사용자의 오더 접수, 세션 배정, GitHub 인계, 상태 보고, 공통 품질 게이트 |
| 운영 실행 도구 | `freepass-creator/aiops` | Google Sheet·Drive·데이터센터 연동, 원자·판정·운영 스크립트, 실행 통제 |
| 개발 자산 색인 | `freepass-creator/devcenter` | 저장소와 개발 자산의 위치를 가리키는 등록부. 업무 데이터 정본은 두지 않음 |
| 문서 허브 | `freepass-creator/docshub` | 내부 문서 규격·생성·보관 작업 |
| 사건 자료 | `freepass-creator/casemap-private` | 소송·과태료 등 사건 단위 증거와 진행 이력 |

**구분:** AI Core는 사업 데이터를 소유하는 ERP가 아니다. 각 사업 프로젝트를 지휘하고 인계·검증하는 공통 통제부다. AIOps는 실제 운영 연결과 판정 도구를 맡는다.

### B. Freepass — 판매·중개 사업

제품명·폴더명·서비스명과 Data Monitor 기준은 [`FREEPASS_PRODUCT_DEFINITION_2026-09-20.md`](FREEPASS_PRODUCT_DEFINITION_2026-09-20.md)를 따른다.

| 파트 | 현행 자산 | 현재 확인된 역할 | 판정 |
|---|---|---|---|
| 판매 플랫폼 | `freepass-creator/freepasserp4` | `Freepass ERP 1~4`가 화이트라벨로 진화한 현재 최종본. 영업자가 차량을 찾고 고객에게 카탈로그를 보여주는 `freepasserp.com` | **제품 최종본·Freepass 메인 얼굴** |
| 관리자 | `freepass-creator/freepass-admin` (현재 로컬 체크아웃 `C:\dev\freepasserp.com`) | 내부 관리자의 상품찾기·접수·계약·정산 화면 | 이미 분리된 내부 제품 |
| 영업 | `freepass-creator/freepass-sales` (`C:\dev\sales`) | 모바일 영업 CRM, 고객·통화·후속조치·견적/계약진행 | 독립 파트 |
| 견적기 | `freepass-creator/freepass-estimate` | 고객 조건에 맞는 차량·상품 견적 생성 | 이미 분리된 내부 제품. 로컬 최상위 체크아웃은 미확인 |
| 상품·판매 데이터 | `freepasserp4`의 Firestore/Sheet 연결, `freepass-admin`의 Canonical Product 모델 | 상품 정본 후보가 둘 이상 | **HOLD:** 별도 저장소를 만들기 전에 writer·consumer 대조 필요 |

**구분:** `freepasserp.com`은 도메인 이름이면서 현재 제품 이름이다. 코드 계보와 GitHub 정본은 `freepasserp4`다. `Freepass Admin`, `Freepass Sales`, `Freepass Estimate`는 GitHub에서도 이미 별도 저장소로 나뉘어 있다. 현재 확인된 로컬 체크아웃은 `C:\dev\freepasserp4`, `C:\dev\freepasserp.com`(원격은 `freepass-admin`), `C:\dev\sales`이며, `freepass-estimate` 원격을 가리키는 최상위 로컬 Git 체크아웃은 이번 조사에서 발견되지 않았다. 폴더 이름만으로 제품 귀속을 바꾸지 않고 원격과 실제 체크아웃을 함께 본다.

`freepass-creator/fp-settlement`의 정산 기능은 Freepass Admin에 통합됐다. 따라서 신규 정산 업무는 `freepass-admin`으로 배정하고, `fp-settlement`는 기능 이관·감사에 필요한 참조 저장소로만 보존한다.

### C. JPK — 렌터카 운영

| 파트 | 현행 자산 | 현재 확인된 역할 | 판정 |
|---|---|---|---|
| 렌터카 매니저 | `renman` 계열. `jpkerp2`·`jpkerp-v4`·`jpkerp5`의 검증 기능을 계승 | 차량·계약·배차·반납·수납·미수·재무·정비·사고·보험·과태료를 관리하는 JPK ERP 계열 최종 제품 | **제품 최종본**. 정본 저장소와 이관 범위 확인 필요 |
| 이전 ERP 세대 | `jpkerp`, `jpkerp2`, `jpkerp-v4`, `jpkerp5` | 렌터카 매니저가 계승할 기능과 데이터 모델의 구현 원천 | 신규 제품 작업 대상이 아니라 이관·검증 원천 |
| 직원 업무 | `freepass-creator/teamjpkwork` | 렌터카 매니저의 데이터를 바탕으로 직원이 오늘 할 일을 보고 처리하고 결과를 남기는 WORK 화면 | 별도 제품·직원 업무 정본 |
| 업무 판정·자료 연결 | `freepass-creator/aiops` | 시트와 데이터센터 자료를 읽고 직원 할 일을 판정·공급 | 공통 운영 엔진 |
| 관제·감사 | `freepass-creator/workcontrol` | 문제 탐지와 직원 현황 확인 | 보조 관제 파트 |
| 과태료 전용 흐름 | `teamjpkwork` 과태료 API/UI, `billincar`, `aiops` 과태료 엔진 | 기능이 여러 저장소에 분산 | **HOLD:** 실제 처리 주체와 대전 갈래를 업무별로 대조 필요 |

**구분:** `렌터카 매니저`는 JPK ERP 2·3·4·5의 최종 진화 제품이고 차량·계약·금액·상태 같은 렌터카 운영 원장을 맡는다. `JPK Work`는 렌터카 매니저를 바탕으로 직원에게 할 일을 보여주고 처리 결과를 받는 별도 제품이다. Work 안에 렌터카 ERP 전체를 다시 만들지 않는다.

### D. 착한거래 — 전자계약

| 파트 | 현행 자산 | 현재 확인된 역할 | 판정 |
|---|---|---|---|
| 전자계약 | `freepass-creator/chakhandeal`과 `freepasserp4`의 전자계약 연결 | 계약서 생성·본인확인·서명·계약 증빙 | **귀속 HOLD** |

**구분:** 착한거래는 회사나 영업 플랫폼보다는 전자계약 기능 제품에 가깝다. 당장은 Freepass 전용으로 넣거나 JPK 내부에 합치지 않는다. 공통 계약 서비스, Freepass 하위 기능, 독립 제품 중 어디에 둘지는 실제 계약 작성자·사용자·데이터 소유자·배포 도메인을 대조한 뒤 결정한다.

### E. Mewcar — 자동차 구독 사업

| 파트 | 현행 자산 | 맡는 범위 |
|---|---|---|
| 사업 준비·정책·매뉴얼 | `freepass-creator/mewcar` | 설립·상품·심사·계약·운영·반납·회수·재운행·매각·손익 피드백 |
| 판매 채널 | Freepass 판매 플랫폼 | 상품화와 영업에 기존 Freepass 자산 사용 |
| 운영 도구 | 렌터카 ERP 계열 | 차량·계약·수납·정비·사고·반납·매각 운영에 검증된 기존 기능 사용 |

**구분:** Mewcar는 독립 사업 프로젝트다. Freepass 판매 기능과 렌터카 ERP 기능을 사용하더라도 해당 저장소를 Mewcar 소유로 옮기거나 복제하지 않는다.

## 3. 지금부터 쓰는 파트 이름

```text
AI Core
├─ Control          오더·세션·인계·검증
├─ Ops              운영 연결·판정·자동화
├─ DevCenter        저장소·개발 자산 색인
├─ Docs             문서 허브
└─ Cases            사건·법무 기록

Freepass
├─ ERP.com          화이트라벨 차량찾기·고객 카탈로그
├─ Admin            내부 상품·접수·계약·정산
├─ Sales            고객·통화·후속조치
├─ Estimate         견적
├─ Data             상품·공급사·정책·접수 스냅샷
└─ Bridge           내부 파트와 ERP.com 연결

JPK
├─ Rental Manager   JPK ERP 계열 최종본·렌터카 운영 원장
├─ Work             매니저 기반 직원 할 일·처리·완료
├─ Control          누락·오류·직원 현황 관제
└─ Penalty          과태료 처리 흐름

Chakhandeal
└─ E-sign           전자계약·본인확인·서명·계약 증빙 (귀속 HOLD)

Mewcar
├─ Business         사업·상품·심사 정책
├─ Operations       계약 이후 차량 생애주기
└─ Manual           매뉴얼·체크리스트·런칭 준비
```

이 이름은 내부 업무 배정용이다. 저장소 이름을 즉시 바꾸거나 새 저장소를 만들라는 뜻이 아니다.

## 4. 보관·중복으로 분류할 현재 폴더

- `jpkerp`, `jpkerp2`, `jpkerp-v4`, `jpkerp5`: 렌터카 매니저의 이전 ERP 세대·기능 이관 원천. 신규 제품 기능은 렌터카 매니저에 배정한다.
- `renman-v2`: Git 원격 없는 렌터카 매니저 실험 사본. 원격 정본 확정 전 독자 정본으로 사용하지 않는다.
- `worknavi`, `worknavi-security`, `worknavi-answer-packets`: `teamjpkwork` 원격의 작업 사본 또는 과거 갈래. 별도 프로젝트로 세지 않음.
- `freepasserp`, `freeepasserp2`, `freepasserp3`: Freepass 과거 세대. 신규 작업 배정 금지.
- `fp-settlement`: 정산 기능이 Freepass Admin에 통합된 이전 구현. 신규 작업 배정 금지, 이관·감사 참조로만 보존.
- `freepasserp4-rtdb-current`, `freepasserp4-ui-deploy`, `_wt-test`: `freepasserp4` 작업 사본. 별도 프로젝트로 세지 않음.
- `freepass-sales`, `sales-mail-automation`: `freepass-sales` 원격의 다른 체크아웃/작업 갈래. `C:\dev\sales`와 별도 제품으로 세지 않음.
- `teamjpkwork-atom-check`: `teamjpkwork` 검증 사본. 별도 제품으로 세지 않음.
- `ai-core-audit`, `ai-core-control-tower`, `ai-core-order-investigate`, `.wt*`: `ai-core` 작업 사본. 별도 프로젝트로 세지 않음.

실제 이동·백업·삭제는 각 작업트리의 미커밋·미푸시·stash·참조 여부를 별도 검증한 뒤 진행한다.

## 5. 아직 확인해야 하는 경계

| 우선순위 | 확인할 것 | 확인 후 결정 |
|---|---|---|
| 1 | `freepasserp4`의 실제 `freepasserp.com` 배포와 화이트라벨 화면 | Freepass ERP.com 최종본의 운영 범위 |
| 2 | 이미 분리된 Freepass Admin·Sales·Estimate 저장소와 ERP.com 연결 | 내부 파트별 코드·데이터 책임 |
| 3 | `renman`·`renman-v2`·`jpkerp5`의 기능·배포·Firestore writer | 렌터카 매니저 정본 저장소와 이관 목록 |
| 4 | `teamjpkwork`가 읽는 계약·차량·업무 데이터와 writer | 렌터카 매니저와 JPK Work 사이 책임 경계 |
| 5 | 착한거래의 계약 작성자·사용자·데이터 소유자·배포 도메인 | 독립/공통/Freepass 귀속 결정 |
| 6 | 과태료 사건 생성부터 고지·대전·납부·소송까지 실제 흐름 | JPK Penalty와 Cases 책임 분리 |

## 6. 바로 적용할 운영 규칙

1. 새 업무는 위 사업·공통 프로젝트와 하위 파트 중 하나에 먼저 배정한다.
2. 업무 화면 변경은 해당 제품 저장소에서 하고, 공통 오더·인계 기록은 AI Core에 남긴다.
3. 같은 원격의 작업 폴더를 새 프로젝트로 등록하지 않는다.
4. 운영 정본 미확인 항목은 `HOLD`로 기록하고 기존 운영을 임의로 바꾸지 않는다.
5. 모든 GitHub 인계에는 대상 프로젝트·파트·정본 저장소·브랜치/커밋·다음 작업을 적는다.

## NEXT_START_HERE

1. `freepasserp4`가 현재 `freepasserp.com`에 제공하는 화이트라벨 기능을 배포 메타데이터와 코드로 확정한다.
2. Freepass Admin·Sales·Estimate를 ERP.com과 대조해 내부 파트 책임표를 확정한다.
3. `renman`·`renman-v2`·`jpkerp5`를 대조해 렌터카 매니저 정본 저장소와 계승 기능을 확정한다.
4. 렌터카 매니저와 `teamjpkwork`의 Firestore writer/reader를 대조해 ERP 원장과 직원 할 일의 경계를 확정한다.
5. 착한거래는 귀속이 결정될 때까지 독립 전자계약 제품으로 유지한다.
6. 확정 전에는 저장소 생성·이름 변경·데이터 이전을 하지 않는다.
