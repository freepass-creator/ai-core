# Runway ERP — 화면 틀 규격 v0.1

스타트업 경영관리 ERP의 업무 화면 규격. 테마는 새로 만들지 않고 저장소 정본 **claude-v1**
(`design/claude-v1/tokens.json` · `examples/claude/claude-v1.css`)을 그대로 쓴다.
이 폴더가 더하는 것은 **화면 틀(배치) 넷**과 그 틀로 만든 **업무 화면 넷**뿐이다.

## 파일

| 파일 | 역할 |
|---|---|
| `erp-templates.css` | 틀 넷(T1–T4)과 공용 배치 부품(`.e-*`). 토큰 값만 사용, 선·그림자 없음 |
| `index.html` | 틀 목록 · 영역 규격 · 공통 규칙 (여기서 시작) |
| `dashboard.html` | T1 개요형 — 경영 대시보드 |
| `billing.html` | T2 목록-상세형 — 청구서 |
| `approval.html` | T3 문서함형 — 전자결재 (+ 같은 업무 모바일) |
| `expense.html` | T4 검토 큐형 — 카드 · 경비 |
| `../freepass-erp/` | 같은 틀로 만든 프리패스 ERP: 상품몰(T5) · 재고(T2) · 계약 접수(T6) · 실적(T1) · 정산(T4) |
| `shots/*.png` | 1440px 캡처, `approval-390.png`은 모바일 폭 |

각 HTML은 `tokens.runtime.css → claude-v1.css → erp-templates.css` 순서로 불러온다.

## 틀 여섯 — 새 화면은 이 중 하나를 고른다

| 틀 | 클래스 | 쓰는 곳 | 영역 | 주 명령 |
|---|---|---|---|---|
| T1 개요형 | `.e-overview` | 대시보드 · 리포트 | 지표 ≤ 4 → 12칸 판 격자 (`.e-span-4/5/7/8/12`) | 없음, 판 안 링크로 이동 |
| T2 목록-상세형 | `.e-split` | 청구서 · 거래처 · 계약 · 구성원 | 지표 → 도구줄 → 칩 → 일괄줄 → 표 │ 상세 400px | 머리 «새 ○○», 상세 하단 |
| T3 문서함형 | `.e-inbox` | 결재 · 품의 · 휴가 | 문서함 320 │ 문서 │ 결재선 300 | 판단 줄 3:7 (반려·승인) |
| T4 검토 큐형 | `.e-queue` | 카드 경비 · 입금 매칭 · 정산 | 진행률 → 도구줄 → 칩 → 표 │ 검토판 380 | «확인하고 다음 건» 3:7 |
| T5 카탈로그형 | `.e-catalog` | 상품몰 | 거름 레일 240 │ 사진 카드 격자 (`.e-product`) | 머리 «계약 접수», 카드마다 기본 버튼 둘 |
| T6 작성형 | `.e-compose` | 계약 접수 · 신규 등록 | 번호 붙은 입력 판(`.e-no`) │ 요약 380 (`.e-summary`) | 요약 하단 3:7 «확인 요청» |

폭이 1180px 아래면 오른쪽 판이 아래로, 900px 아래면 한 칸이 된다.

## 공용 배치 부품 (`erp-templates.css`)

`.e-panel`(판) · `.e-panel-head` · `.e-kpis`(지표 줄) · `.e-toolbar` · `.e-bulk`(일괄 작업줄) ·
`.e-scroll`(가로 스크롤 표) · `.e-detail`(오른쪽 상세/검토판) · `.e-detail-head` · `.e-amount`(큰 금액) ·
`.e-tags` · `.e-bars`(입출금 막대) · `.e-legend` · `.e-stack`(누적 비율) · `.e-todo`(할 일) ·
`.e-doc`(문서 면) · `.e-approvers`(결재선) · `.e-progress` · `.e-receipt` · `.e-form`/`.e-form-2` ·
`.e-actbar`(하단 판단 줄 1=100% · 2=3:7 · 3=3:3:4) · `.e-phones` · `.e-sr` · `.e-link` ·
`.e-shot`(상품 사진 16:10, `<img>` 또는 차량 실루엣) · `.e-car`(색은 `--paint` 상품 데이터) · `.e-thumb` · `.e-paint` ·
`.e-price` · `.e-cond` · `.e-stock` · `.e-pickcar` · `.e-lines` · `.e-funnel` · `.e-meter` · `.e-cell` · `.e-two` · `.e-pipeline`(정산 단계판)

버튼 · 표 · 칩 · 탭 · 상태 · 뱃지 · 입력 · 이력 · 알림 · 폰 틀은 전부 `claude-v1.css`의 `c-*` 부품이다.

## 규칙

1. 색 · 글자 크기 · 모서리는 claude-v1 토큰만. 버튼 · 박스에 선 · 그림자 없음.
2. 한 영역에 면을 가진(primary) 버튼은 하나.
3. 상태는 글자 + 점/면 두 신호 (`c-state`, `c-badge`). 색 하나로 말하지 않는다.
4. 고른 한 건: 표 줄 `aria-selected="true"`, 카드 `aria-current="true"`. 오른쪽 판이 그 건을 연다.
5. 금액은 표에서 `.num`(등폭 · 오른쪽 맞춤, 원 단위), 지표는 만 · 억 + 작은 단위 글자.
6. 촘촘한 표는 글자를 접지 않고 가로로 스크롤한다 (claude-v1 결정 #15).
7. 웹과 모바일은 같은 ID · 상태 · 명령을 쓴다. 모바일은 카드 목록 + 하단 판단 줄.

## 검사

```bash
node scripts/check-claude-v1.mjs examples/claude/startup-erp/erp-templates.css
```

검사기는 이제 추가 CSS 파일을 인자로 받는다. 2026-09-23 기준 결과: 9개 중 8개 PASS.
`활자를 실제로 불러온다` 1개 FAIL은 이 작업 전 base(`590bb46`)에서도 똑같이 실패한다(claude-v1.css에 `@import`/`@font-face`가 없음).

## 아직 안 한 것

- 틀 넷을 `design-system/patterns.registry.json`에 feature로 등록하지 않았다.
- 다크 모드는 캡처로 확인하지 않았다. 390px 폭은 결재함(T3)과 상품몰(T5)만 확인했다.
- 차량 이미지는 실제 사진이 아니라 색만 다른 세단/SUV 실루엣 SVG다. 실제 사진이 오면 `.e-shot` 안에 `<img>`로 바꾼다.
- 캡처 환경에 Pretendard가 없어 Noto Sans CJK KR로 렌더됐다.
- 예시 수치 · 회사명은 설명용 샘플이다.

next_start_here: 프리패스 «접수 현황»(T2) · 공급사 확인 · 출고 화면 추가 → 실제 상품 사진(`<img>`)과 FreePass Data 상품 필드 연결 → 틀 여섯을 패턴 레지스트리에 등록.
