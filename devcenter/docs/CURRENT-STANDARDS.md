# 현재 규격 취합 — 적용 범위와 원본

2026-09-09 선택 원문 발췌/선언 기준. [source snapshot](baseline-sources.json)은 출처/버전 기록이며 [기존 등록부](../registry.json)의 권위 판정을 대체하지 않는다. 모든 파일 내용·소비자·동작을 전수검증한 목록이 아니다.

## 규격 묶음

| 묶음 | 원본 ID / 경로(C:/dev 기준) | 지금 적용할 범위 |
|---|---|---|
| 센터 구성·협업 | S01~S03 devcenter/AGENTS.md, ssot/PART.md, ssot/AGENTS.md | 그룹·파트와 현행 검수 경계 |
| 현역·보관 | S05 aiops/docs/저장소지도.md | 어떤 저장소를 기준으로 읽을지. 프로젝트 수나 최근 커밋으로 임의 승격 금지 |
| FP4 규격 | S06~S10 freepasserp4/CLAUDE.md, DESIGN.md, .cursorrules, AGENTS.md, docs/AI_COLLABORATION.md | fp4 작업·UI·기능·검수. 과거 역할을 센터 전역에 자동 확대하지 않음 |
| FP4 공통 UI | S11~S17 freepasserp4/components/ui/* | 현재 토큰·부품의 사용 후보와 실제 export |
| WORK-ERP 규격 | S18/S19 teamjpkwork/docs/erp-design/{README,SPEC-UI}.md | 직원 ERP 화면. 원본/사본 경계 아래 확인 필요 |
| 기존 기능 엔진 | S20 aiops/asset-engine/README.md | 차량 자산 엔진의 설명/연결 후보. 초안·미연결 상태 보존 |
| 분야별 예외 | S21 webtoon-studio/AGENTS.md | 작품별 분리·전달/보관. 개발센터 GitHub를 창작 원본의 새 저장 지시로 해석하지 않음 |
| 문서 양식 | registry의 doc-form → docshub/양식 | 기존 빈 양식 위치만 확인. 내용/인쇄 규격은 이번 미취합; 임의 기본값 생성 금지 |

## 버튼·드롭다운·표·박스: 이미 있는 것

아래는 FP4 원본의 export/문서 확인 목록이다. 새 패키지로 추출하거나 실제 화면 테스트한 결과가 아니다. 진입점은 `freepasserp4/components/ui/index.tsx` (S12); `@/`는 해당 프로젝트 별칭이라 다른 프로젝트에서 그대로 동작한다고 가정하지 않는다.

| 필요 | 기존 심볼 | 원본 | 사용 전 확인 |
|---|---|---|---|
| 버튼 | Btn, IconBtn, IconSeg | S13 buttons.tsx | variant·size·disabled·이벤트·아이콘 |
| 드롭다운 | Select | S14 form-controls.tsx | options/groups·value/onChange·disabled·ariaLabel |
| 입력/검색 | Input, SearchInput, Textarea, Checkbox | S14 | 입력 의미·오류/라벨·읽기전용·키보드 |
| 표 | DataTable 및 th/td 계열 | S15 table.tsx | 열·행 계약과 실제 사용처. DataTable의 과거 미사용 표기를 현재 사용 증거로 대체하지 않음 |
| 박스/폼 | Section, FormCard, DetailGrid, DetailTable | S16 detail.tsx | 값/폼 계약·배치·표시 조건 |
| 팝업/패널 | Modal, Drawer | S17 overlays.tsx | 열기/닫기·포커스·모바일·권한 |
| 색/치수 | C, R, FS, CTRL, ICON 및 ctrl* | S11 | 코드와 관련 문서의 현재 차이부터 확인 |

## 통합하지 않고 남길 차이·충돌

| ID | 현재 원문 증거 | 1차 처리 |
|---|---|---|
| C01 | FP4 라운드 R=4, WORK-ERP 규격 --radius=8 | 범위가 다른 프로필 차이. 하나로 강제 통합하지 않음 |
| C02 | FP4 CLAUDE 문서의 웹 컨트롤 폰트 md13/sm12.5와 tokens CTRL의 md12.5/sm12가 다름 | 동일 범위 문서/코드 불일치. 두 수치는 충돌 증거이며 어느 쪽도 신규 기본값/확정 규격값으로 인용하지 않음. 승인 근거 확인까지 HOLD |
| C03 | WORK-ERP README는 정본 안내와 원본 사본 양쪽 갱신을 함께 지시 | 원본 소유자/갱신 경계를 확인할 때까지 통합 판정 HOLD |
| C04 | FP4 문서의 Claude 직접 구현/Codex 검사 역할과 센터의 Claude PM/Codex 구현 역할이 다름 | 프로젝트별 범위 보존. 대상 작업의 역할을 명시 |
| C05 | 로컬 ssot 이동 관련 변경과 GitHub 초기 안내가 다른 시점 | 이동 담당 변경을 별도 검토. 이 취합에서 합치거나 되돌리지 않음 |
| C06 | 양식 및 기타 프로젝트는 경로 후보 조사만 있었음 | 기본 규격 완전 취합으로 표시하지 않음. 필요한 대상의 원문부터 확인 |

위 차이는 자동 보정 항목이 아니다. 확정된 규격/사용자 요구에 근거해 해당 항목만 해소하며 무관한 디자인 통합으로 범위를 넓히지 않는다.

## 미취합·미검증 목록

- 문서 양식 원문·인쇄 규격: 위치만 확인. 해당 작업의 기본 규격이 필요하면 원문을 추가 취합한다.
- 나머지 프로젝트의 고유 규격: 1차 경로 조사만 있었으며 이번 21개 선택 원문 확인과 구분한다.
- 각 부품의 전체 의존성·실제 소비자·모바일/접근성·실행: 선언 확인을 넘어서는 검증은 하지 않았다.
- 기능별 정확한 입력/출력·승인 버전: 현재 설명/위치 후보이며 공통 기능 계약 완성은 아니다.

현재 1차에 필요한 출처 누락은 1차 잔여로 유지한다. 실행 자동화/패키지화 등 고도화만 2차로 넘기며, 필요한 규격 취합을 2차라는 이름으로 미루지 않는다.
