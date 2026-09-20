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

| 파트 | 현행 자산 | 현재 확인된 역할 | 판정 |
|---|---|---|---|
| 관리자 | `freepass-creator/freepass-admin` (`C:\dev\freepasserp.com`) | 내부 관리자의 상품찾기·접수·계약·정산 화면 | 독립 파트 |
| 영업 | `freepass-creator/freepass-sales` (`C:\dev\sales`) | 모바일 영업 CRM, 고객·통화·후속조치·견적/계약진행 | 독립 파트 |
| 기존 ERP·통합 기능 | `freepass-creator/freepasserp4` | 상품·파트너·공급사·접수·전자계약·정산·시트 동기화 등 기존 구현 | 현행 기능 원천. 관리자/영업과 중복 범위 정리 필요 |
| 견적기 | `freepasserp4`의 catalog/quote·inventory 계열, `sonogong-estimator` 임베드 | 견적 관련 기능이 여러 곳에 존재 | **HOLD:** 무엇을 Freepass 견적기 정본으로 쓸지 실제 화면·도메인 확인 필요 |
| 상품·판매 데이터 | `freepasserp4`의 Firestore/Sheet 연결, `freepass-admin`의 Canonical Product 모델 | 상품 정본 후보가 둘 이상 | **HOLD:** 별도 저장소를 만들기 전에 writer·consumer 대조 필요 |

**구분:** Freepass는 `관리자`, `영업`, `견적`, `데이터` 네 파트로 관리한다. 당장은 새 저장소를 만들지 않고 위 현행 자산을 파트에 배정한다. `freepasserp4`는 폐기 대상으로 보지 않고, 기존 기능과 데이터 흐름의 원천으로 둔다.

### C. JPK — 렌터카 운영

| 파트 | 현행 자산 | 현재 확인된 역할 | 판정 |
|---|---|---|---|
| 렌터카 ERP | `freepass-creator/jpkerp5` | 차량·계약·배차·반납·수납·미수·재무·정비·사고·보험·과태료·사용자 관리 구현 | 기능 기준 ERP 후보 |
| 직원 업무 | `freepass-creator/teamjpkwork` | 직원이 오늘 할 일을 보고 처리하고, 처리 결과를 남기는 WORK 화면 | 직원 업무 정본 |
| 업무 판정·자료 연결 | `freepass-creator/aiops` | 시트와 데이터센터 자료를 읽고 직원 할 일을 판정·공급 | 공통 운영 엔진 |
| 관제·감사 | `freepass-creator/workcontrol` | 문제 탐지와 직원 현황 확인 | 보조 관제 파트 |
| 과태료 전용 흐름 | `teamjpkwork` 과태료 API/UI, `billincar`, `aiops` 과태료 엔진 | 기능이 여러 저장소에 분산 | **HOLD:** 실제 처리 주체와 대전 갈래를 업무별로 대조 필요 |
| 차세대 참고 구현 | `renman` | OCR 기반 멀티테넌트 렌터카 ERP의 초기 구현 | 운영 정본 아님. 읽기 전용 참고 |

**구분:** 렌터카 ERP는 차량·계약·금액·상태 같은 업무 원장을 맡고, JPK Work는 그 원장에서 직원에게 배정된 일을 처리하는 화면을 맡는다. 같은 기능을 양쪽에 다시 만들지 않는다. `jpkerp5`의 실제 배포·사용 여부가 확인되기 전에는 운영 정본이라고 확정하지 않는다.

### D. Mewcar — 자동차 구독 사업

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
├─ Admin            상품찾기·접수·계약·정산
├─ Sales            고객·통화·후속조치
├─ Quote            견적
├─ Data             상품·공급사·정책·접수 스냅샷
└─ Legacy/Bridge    기존 ERP 기능과 전환 연결

JPK
├─ Rental ERP       차량·계약·수납·정비·사고·과태료 원장
├─ Work             직원 할 일·처리·완료
├─ Control          누락·오류·직원 현황 관제
└─ Penalty          과태료 처리 흐름

Mewcar
├─ Business         사업·상품·심사 정책
├─ Operations       계약 이후 차량 생애주기
└─ Manual           매뉴얼·체크리스트·런칭 준비
```

이 이름은 내부 업무 배정용이다. 저장소 이름을 즉시 바꾸거나 새 저장소를 만들라는 뜻이 아니다.

## 4. 보관·중복으로 분류할 현재 폴더

- `jpkerp`, `jpkerp2`, `jpkerp-v4`: 과거 세대. 신규 작업 배정 금지.
- `renman-v2`: Git 원격 없는 실험 사본. 정본으로 사용 금지.
- `worknavi`, `worknavi-security`, `worknavi-answer-packets`: `teamjpkwork` 원격의 작업 사본 또는 과거 갈래. 별도 프로젝트로 세지 않음.
- `freepasserp`, `freeepasserp2`, `freepasserp3`: Freepass 과거 세대. 신규 작업 배정 금지.
- `freepasserp4-rtdb-current`, `freepasserp4-ui-deploy`, `_wt-test`: `freepasserp4` 작업 사본. 별도 프로젝트로 세지 않음.
- `freepass-sales`, `sales-mail-automation`: `freepass-sales` 원격의 다른 체크아웃/작업 갈래. `C:\dev\sales`와 별도 제품으로 세지 않음.
- `teamjpkwork-atom-check`: `teamjpkwork` 검증 사본. 별도 제품으로 세지 않음.
- `ai-core-audit`, `ai-core-control-tower`, `ai-core-order-investigate`, `.wt*`: `ai-core` 작업 사본. 별도 프로젝트로 세지 않음.

실제 이동·백업·삭제는 각 작업트리의 미커밋·미푸시·stash·참조 여부를 별도 검증한 뒤 진행한다.

## 5. 아직 확인해야 하는 경계

| 우선순위 | 확인할 것 | 확인 후 결정 |
|---|---|---|
| 1 | `jpkerp5` 실제 배포 URL·사용자·Firebase/Firestore 정본 | JPK Rental ERP 운영 정본 확정 여부 |
| 2 | `teamjpkwork`가 읽는 계약·차량·업무 데이터와 writer | ERP와 Work 사이 책임 경계 |
| 3 | `freepasserp4`, `freepass-admin`, `freepass-sales`의 상품·접수·계약 writer | Freepass Data 정본과 중복 제거 순서 |
| 4 | 실제 사용 중인 견적 화면과 도메인 | Freepass Quote 정본 |
| 5 | 과태료 사건 생성부터 고지·대전·납부·소송까지 실제 흐름 | JPK Penalty와 Cases 책임 분리 |

## 6. 바로 적용할 운영 규칙

1. 새 업무는 위 네 프로젝트와 하위 파트 중 하나에 먼저 배정한다.
2. 업무 화면 변경은 해당 제품 저장소에서 하고, 공통 오더·인계 기록은 AI Core에 남긴다.
3. 같은 원격의 작업 폴더를 새 프로젝트로 등록하지 않는다.
4. 운영 정본 미확인 항목은 `HOLD`로 기록하고 기존 운영을 임의로 바꾸지 않는다.
5. 모든 GitHub 인계에는 대상 프로젝트·파트·정본 저장소·브랜치/커밋·다음 작업을 적는다.

## NEXT_START_HERE

1. `jpkerp5`와 `teamjpkwork`의 배포 메타데이터 및 Firestore writer/reader를 읽기 전용으로 대조한다.
2. 결과로 JPK Rental ERP와 Work의 실제 경계를 확정한다.
3. 이어서 Freepass의 상품·접수·계약 writer를 대조해 `Admin/Sales/Quote/Data/Legacy` 책임표를 확정한다.
4. 확정 전에는 저장소 생성·이름 변경·데이터 이전을 하지 않는다.
