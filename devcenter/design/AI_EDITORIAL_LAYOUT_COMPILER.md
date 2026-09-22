# DevCenter AI Editorial Layout Compiler

상태: Design Hub 문서 레이아웃 제작 방법론 — AI Core와 브랜드 정본에 종속
대상: 문서 제작 작업자와 AI
연계 문서: `design/AI_DESIGNER_OPERATING_GUIDE.md`

이 문서의 페이지 계산 예시는 문서 제작 방법이며 공통 UI 토큰이나 제품 브랜드 값을 대체하지 않는다.

> **목표**
> AI에게 단순히 “디자인해”라고 지시하는 방식이 아니라, `콘텐츠 설계 → 레이아웃 계산 → HTML/CSS/SVG 렌더링 → 시각 검수 → 자동 수정` 과정을 통해 사람이 만든 것처럼 비율과 정보밀도가 안정적인 업무문서를 생산하는 구조를 만든다.

---

## 1. 핵심 개념

Design Hub의 핵심 구현체는 이미지 생성기가 아니라 **AI Editorial Layout Compiler**임.

입력 원고를 바로 이미지로 만들지 않고 아래 순서로 처리함.

`원고 → 콘텐츠 분석 → 페이지 설계 → PAGE_SPEC → HTML/CSS/SVG → A4/16:9 렌더 → PNG/PDF → Visual QA → 수정 → 승인`

최종 본문은 텍스트 정확성과 재현성을 위해 HTML/CSS 또는 동등한 텍스트 기반 렌더러를 기본으로 함.
이미지 생성 AI는 표지·컨셉 시안·장식 비주얼 등 보조 역할로 사용함.

---

## 2. Claude의 핵심 역할

Claude의 핵심은 CSS를 잘 쓰는 것이 아니라 **렌더링 전에 디자인 판단을 구조화하는 것**임.

반드시 먼저 판단할 것:

- 무엇이 이 페이지의 핵심 메시지인지
- 무엇을 크게 보여줄지
- 무엇을 줄이거나 다음 페이지로 넘길지
- 무엇을 글로 둘지
- 무엇을 표로 만들지
- 무엇을 도식화할지
- 한 페이지에 어느 정도 정보만 허용할지

디자인 판단 없이 원고에서 곧바로 HTML을 생성하지 않음.

---

## 3. PAGE_SPEC 중간 산출물 필수

각 페이지는 렌더링 전에 구조화된 설계정보를 가져야 함.

예시:

```json
{
  "page": 3,
  "title": "상품 구성",
  "summary": "상품은 단기와 장기 2개로 단순화함.",
  "message": "단기는 기간 메리트, 장기는 가격 메리트",
  "layout": "comparison",
  "density": "medium",
  "blocks": [
    {"type": "table", "span": 12, "importance": 1},
    {"type": "text", "span": 6, "importance": 2},
    {"type": "text", "span": 6, "importance": 2},
    {"type": "key_summary", "span": 12, "importance": 1}
  ]
}
```

PAGE_SPEC는 디자인 설계도이자 다른 AI가 작업을 이어받기 위한 공통 인터페이스로 사용함.

---

## 4. 페이지 타입 분류

원고를 읽고 페이지마다 아래 유형 중 하나를 먼저 선택함.

- `text` : 판단·배경·전략 설명형
- `comparison` : A/B 비교형
- `table` : 숫자·조건·기간 중심
- `flow` : 순서·업무 흐름 중심
- `relationship` : 조직·역할·주체 관계 중심
- `kpi` : 핵심 숫자 중심
- `decision` : 확정/미정·의사결정 항목 중심
- `mixed` : 위 유형 두 개 이내 조합

**기본값은 `text`임.**
도식화할 명확한 이유가 없는 경우 글로 작성함.

---

## 5. A4 레이아웃 기본 프레임

A4 내부기획안 예시:

```css
@page {
  size: A4 portrait;
  margin: 0;
}

.page {
  width: 210mm;
  height: 297mm;
  padding: 16mm 17mm 14mm;
  box-sizing: border-box;
}

.header { min-height: 12mm; }
.content { min-height: 244mm; }
.footer { min-height: 8mm; }
```

고정 규격을 먼저 적용하고, 내용 때문에 페이지 자체 비율을 임의로 변경하지 않음.

---

## 6. 12-column Grid 사용

문서 레이아웃은 자유비율보다 정해진 그리드를 우선 사용함.

```css
.content-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  column-gap: 4mm;
}
```

권장 분할:

- 4 : 8
- 5 : 7
- 6 : 6
- 8 : 4
- 12 전체폭

임의의 37:63 같은 비율은 특별한 이유가 있을 때만 사용함.
정렬축이 페이지마다 바뀌지 않도록 함.

---

## 7. Typography Token 고정

페이지마다 폰트 크기를 임의 결정하지 않음.

예시:

```css
:root {
  --font-cover: 30pt;
  --font-page-title: 23pt;
  --font-section: 15.5pt;
  --font-lead: 11.5pt;
  --font-body: 10.2pt;
  --font-small: 8.7pt;
  --line-body: 1.55;

  --space-1: 2mm;
  --space-2: 4mm;
  --space-3: 7mm;
  --space-4: 11mm;
}
```

실제 수치는 문서 유형·브랜드별 token으로 관리함.

### 최소 글자 규칙

본문이 기준보다 작아져야 들어가는 경우 글씨를 더 줄이지 않음.

예:

`본문 9pt 이하 필요 → FAIL → 페이지 재분할 또는 내용 재구성`

---

## 8. Density Budget

페이지 공간이 남는다고 장식이나 박스를 추가하지 않음.
한 페이지의 정보량 상한을 둠.

A4 기본 예시:

```text
제목       1
리드문     1
본문문단   최대 3
표         최대 1
도식       최대 1
핵심정리   1

대형 표 + 대형 도식 동시 사용 지양
카드 4개 초과 금지
본문이 과도하게 길면 페이지 분할
```

`whitespace`는 빈 공간이 아니라 정보 위계를 만드는 디자인 요소로 취급함.

---

## 9. 표현 방식 선택 로직

다음 판단을 기본으로 사용함.

```text
사업 판단·배경·의견이 핵심 → TEXT
숫자·조건 비교가 핵심       → TABLE
A와 B의 차이가 핵심          → COMPARISON
순서가 핵심                  → FLOW
주체 관계가 핵심             → RELATIONSHIP
한 숫자 강조가 핵심          → KPI
확정/미정 상태가 핵심        → DECISION TABLE
```

다시 강조함:

> **TEXT가 기본값임.**
> 도식이 이해속도를 실제로 높이는 경우에만 도식 사용함.

---

## 10. Brand Gate

브랜드 문서를 제작할 때 실제 CI 자료가 없으면 임의 로고나 임의 브랜드컬러를 생성하지 않음.

권장 구조:

```text
design/brands/{brand}/
  brand.json
  logo.svg
  logo-white.svg
  colors.json
  approved/
  rejected/
```

예시 `brand.json`:

```json
{
  "primary": "#...",
  "text": "#...",
  "background": "#...",
  "muted": "#...",
  "logo": "./logo.svg"
}
```

### Gate

`브랜드 작업 + CI 자료 없음 → 렌더링 보류 또는 사용자 확인`

브랜드명을 보고 비슷한 로고를 AI가 새로 만드는 행동 금지함.

---

## 11. Approved Design을 Design DNA로 변환

승인 이미지만 저장하지 않고 승인 이유를 구조화함.

예시:

```json
{
  "name": "internal-plan-a4-v1",
  "page_margin": "17mm",
  "title_scale": 2.2,
  "body_width": 0.92,
  "primary_layout": "editorial",
  "box_usage": "low",
  "icon_usage": "minimal",
  "diagram_usage": "only-if-needed",
  "whitespace": "generous",
  "approved_by_user": true
}
```

새 프로젝트는 가장 가까운 Approved Design DNA를 우선 참조함.

Rejected 결과도 실패 사유와 함께 저장하여 동일한 패턴 반복 금지함.

---

## 12. 대표 페이지 승인과 Design Lock

전체 페이지를 한 번에 제작하지 않음.

`원고 분석 → PAGE_SPEC 전체 작성 → 대표 페이지 1장 렌더 → 사용자 승인 → Design Lock → 전체 페이지 제작`

승인 후 고정할 것:

- 실제 CI
- 컬러
- 폰트
- 제목/본문 비율
- 여백
- Grid
- 표 스타일
- 핵심정리 스타일
- 헤더/푸터
- 페이지 번호
- 보안표시

전체 페이지는 Design Lock 안에서만 변형함.

---

## 13. Visual QA Loop

HTML/PDF를 한 번 렌더하고 완료하지 않음.
렌더된 PNG 또는 페이지 이미지를 AI가 다시 검수함.

예시 체크:

```text
PAGE QA
- 제목이 과도하게 큼? PASS/FAIL
- 본문이 너무 작음? PASS/FAIL
- 상하 여백 균형? PASS/FAIL
- 카드/박스 과다? PASS/FAIL
- 정렬축 깨짐? PASS/FAIL
- 표 폭 균형? PASS/FAIL
- 실제 CI 사용? PASS/FAIL
- 한 페이지 한 메시지? PASS/FAIL
- 불필요한 도식 있음? PASS/FAIL
- 텍스트 누락/왜곡 없음? PASS/FAIL
```

FAIL 항목이 있으면 CSS/PAGE_SPEC 수정 후 다시 렌더함.
권장 2~3회 반복 후 사용자에게 시안 제시함.

---

## 14. 렌더링 엔진 권장 구조

```text
design/
├─ AI_DESIGNER_OPERATING_GUIDE.md
├─ AI_EDITORIAL_LAYOUT_COMPILER.md
├─ brands/
├─ styles/
│  ├─ internal-plan-a4/
│  ├─ proposal-a4/
│  ├─ presentation-16x9/
│  └─ contract-a4/
├─ engine/
│  ├─ content-planner/
│  ├─ page-planner/
│  ├─ layout-engine/
│  ├─ html-renderer/
│  ├─ visual-qa/
│  └─ export/
├─ approved/
└─ rejected/
```

이 구조는 구현 권장안이며 기존 DevCenter 구조와 충돌하지 않도록 실제 적용 전 현재 폴더와 통합 설계함.

---

## 15. 실행 파이프라인

사용자 명령은 단순해야 함.

예:

> “이 원고 A사 CI로 A4 내부기획안 디자인해.”

내부 실행은 아래처럼 진행함.

1. 원고 목적/독자 분석
2. 브랜드 자료 확인
3. 문서 유형 선택
4. 페이지 분할
5. PAGE_SPEC 생성
6. Approved DNA 선택
7. HTML/CSS/SVG 생성
8. Headless browser 렌더
9. PNG/PDF 생성
10. Visual QA
11. 자동 수정
12. 대표 시안 사용자 승인
13. Design Lock
14. 전체 페이지 생성
15. 콘텐츠/브랜드/시각 최종검수
16. 최종 산출

---

## 16. Claude 구현 원칙

Claude를 Production Designer로 사용할 경우 아래 순서를 강제함.

### 금지

- 원고에서 바로 HTML 생성
- 디자인 편의를 위해 내용 임의 축약/추가
- 페이지가 넘친다고 폰트를 계속 축소
- 실제 CI 없이 유사 로고 생성
- 모든 내용을 카드/아이콘/도식으로 변경

### 필수

- 먼저 PAGE_SPEC 작성
- Density Budget 확인
- Design Token 사용
- 실제 브랜드 asset 참조
- 대표 페이지 먼저 렌더
- 렌더 이미지를 다시 보고 Visual QA
- FAIL 수정 후 재렌더
- 승인 후 나머지 페이지 제작

---

## 17. GPT / Claude 역할 예시

### GPT 또는 기획 AI

- 원고 이해
- 핵심 메시지 선별
- 정보 위계
- 페이지 구조
- 글/표/도식 판단
- 결과물 비평

### Claude 또는 제작 AI

- PAGE_SPEC 구현
- HTML/CSS/SVG 작성
- Grid/Token 준수
- 정확한 텍스트 조판
- 렌더링
- QA 수정
- PDF/PNG/PPT 등 산출

역할은 모델명에 고정하지 않으며, 같은 AI가 두 역할을 수행할 때도 단계 자체는 분리함.

---

## 18. 완료 기준

다음 조건을 만족해야 완료로 봄.

- 내용이 빠르게 이해됨
- 페이지당 핵심 메시지가 명확함
- 글씨 크기와 줄간격이 실사용 가능함
- 정렬축과 여백이 안정적임
- 불필요한 도식·아이콘 없음
- 브랜드 CI가 정확함
- 숫자·본문이 원문과 일치함
- Approved Design과 시각 언어가 일관됨
- 수정 가능한 소스가 남아 있음
- PDF/PNG 등 최종 산출물이 함께 생성됨

---

## 핵심정리

**Claude가 사람 디자이너처럼 보이게 만드는 핵심은 HTML/CSS 능력이 아니라, 렌더링 전에 디자인 판단을 강제하고 렌더 후 스스로 시각 검수를 반복하게 만드는 구조임.**

Design Hub는 `AI 이미지 생성기`가 아니라 **콘텐츠를 이해하고 편집디자인 규칙으로 컴파일하는 AI Editorial Layout Compiler**를 목표로 함.
