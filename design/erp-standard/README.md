# ERP 표준 UI 규격 v1

업계 통상 ERP(SAP Fiori · Oracle Redwood · MS Dynamics · 더존/영림원 계열) 공통 패턴을 기준으로 한 **ERP 화면 규격**이다.
대표 승인(2026-09-23): 「표준 UI UX 아주 좋아, 지금 만드는 거 이렇게 하라」.

| 파일 | 역할 |
|---|---|
| [`tokens.json`](tokens.json) | **값의 정본** — 색·글자·간격·모서리·골격 치수 76개 |
| [`erp.css`](erp.css) | 공통 스타일. `:root` 는 tokens.json 투영, 나머지는 `erp-*` 컴포넌트 |
| [`main.html`](main.html) | **메인(목록) 화면 템플릿** — 새 목록 화면은 이 파일을 복사해 시작 |
| [`form.html`](form.html) | **등록/수정 폼 템플릿** — 새 입력 화면은 이 파일을 복사해 시작 |
| [`platform/`](platform) | **우리 플랫폼(FreePass ERP) 적용 시안** 5장 — 콕핏·계약진행·계약 상세·재고관리·정산확인 |
| [`themes/`](themes) | **공식 테마 2종** — 등록부 [`themes/index.json`](themes/index.json). 테마 1 `classic`(기본 = tokens.json + erp.css) · 테마 2 `retro`(`retro.json` + `retro.css`) |
| [`images/`](images) | 규격서(`erp-spec.png`)·목록(`erp-main.png`)·폼(`erp-form.png`) 캡처 |
| [`../../scripts/check-erp-standard.mjs`](../../scripts/check-erp-standard.mjs) | 규격 검사 — `npm run erp:check` (npm test 에도 포함) |

![메인 화면](images/erp-main.png)

---

## 1. 화면 골격 (Shell) — 모든 ERP 화면 공통

| # | 영역 | `data-region` | 규격 |
|---|---|---|---|
| ① | 상단바 | `topbar` | 높이 56 · 로고 · 회사 전환 · 통합검색(Ctrl K) · 도움말/일정/알림 · 사용자 |
| ② | 좌측 메뉴 | `sidenav` | 너비 240 (접힘 64, `data-nav="collapsed"`) · 그룹 › 모듈 › 메뉴 2단 · 현재 메뉴 `aria-current="page"` |
| ③ | 작업 탭 (MDI) | `tabs` | 여러 화면을 탭으로 동시에 연다 · 선택 탭 `aria-selected="true"` |
| ④ | 페이지 헤더 | `page-header` | 경로 · 제목(22/700) · 즐겨찾기 · 설명 · 액션(우측 정렬) |
| ⑤ | 요약 KPI | `kpi` | **선택** · 4열 카드 · 숫자 24/700 · 증감은 ▲▼ + 색 |
| ⑥ | 조회조건 바 | `filter` | 라벨 위 입력 · 필수 `*` · 초기화 · 조회(F3) |
| ⑦ | 데이터 그리드 | `grid-toolbar` · `grid` | 선택 건수·일괄 액션 · 상태 탭 · 컬럼 설정 · 합계 · 페이징 |
| ⑧ | 상태바 | `statusbar` | 높이 26 · 서버 연결 · 회계기간 · 마지막 조회 · 단축키 |

본문 여백 좌우 24 / 상하 16 · 섹션 간격 14 · 최소 폭 1280 · 4px 그리드.

## 2. 화면 유형

| 유형 | 템플릿 | 구성 |
|---|---|---|
| 목록(메인) | `main.html` | ④ → ⑤(선택) → [⑥ + ⑦ 한 카드] |
| 등록/수정 폼 | `form.html` | ④(문서 상태 뱃지·전표번호) → 섹션 카드들(4열 폼 그리드, 품목 라인 그리드+합계행) → 하단 고정 저장 줄 `form-footer` |
| 상세 | (다음 단계) | 목록 행 클릭 → 우측 드로어 또는 전체 화면. 폼과 같은 섹션 구성, 읽기 전용 |

## 3. 글자

| 용도 | 토큰 | 크기/굵기 |
|---|---|---|
| KPI 숫자 | `fs-kpi` | 24 / 700 |
| 페이지 제목 | `fs-title` | 22 / 700 |
| 섹션 제목 | `fs-section` | 15 / 700 |
| 본문·셀·버튼 | `fs-body` | 13 / 400 (버튼 600) |
| 라벨·표 헤더·소형 버튼 | `fs-label` | 12 / 500–600 |
| 보조·캡션·상태바 | `fs-caption` | 11.5 / 400 |

- 폰트 Pretendard Variable (한글·영문 한 벌). 숫자는 고정폭(`tabular-nums`).
- 금액·수량은 **오른쪽 정렬**(`erp-num`), 천 단위 콤마. 날짜 `YYYY-MM-DD`. 전표·코드 번호는 링크색.

## 4. 색

- **Primary** `#1D4ED8` — 주요 버튼·링크·선택. **Navigation** `#0F1B2D` — 상단바·좌측 메뉴.
- 면: 바탕 `#F4F6F9` · 카드 `#FFFFFF` · 우묵(조회바·표 헤더) `#F8FAFC`. 선: `#E3E8EF` / 입력 `#CDD5DF`.
- 글자: `#101828` · `#475467` · `#98A2B3`.
- 상태 5종 — 뱃지 `erp-badge--*`

| 상태 | 클래스 | 쓰임 |
|---|---|---|
| 완료·승인 | `--ok` | 출하완료, 결재완료 |
| 확정·진행 | `--info` | 확정, 결재중 |
| 대기·주의 | `--warn` | 출하중, 보류 |
| 반려·지연·오류 | `--err` | 납기지연, 반려 |
| 작성중·임시 | `--neutral` | 작성중, 임시저장 |

상태는 **색 + 점 + 글자**를 함께 쓴다. 색만으로 구분하지 않는다(WCAG 1.4.1).

## 5. 컴포넌트

| 컴포넌트 | 클래스 | 치수 / 규칙 |
|---|---|---|
| 버튼 | `erp-btn` `--primary` `--ghost` `--danger` `--danger-text` `--sm` | 높이 34 (소형 28) · 모서리 6 · 좌우 14 · 아이콘 16. **Primary 는 영역마다 최대 1개, 맨 오른쪽.** 삭제는 확인 대화상자 필수 |
| 입력 | `erp-field` > `erp-label` + `erp-input` | 높이 32 · 모서리 6 · 라벨 위. 포커스 파란 링, 오류 `aria-invalid="true"` + `erp-field-error`, 자동값 `readonly` 회색 |
| 그리드 | `erp-grid` (`--dense`) | 헤더 36 · 행 40 (조밀 32) · 헤더 고정 · hover/선택(`aria-selected`) 행 색 · 합계 `tfoot` |
| 체크박스 | `erp-check` | 16 · 모서리 4 · 일부 선택(indeterminate) 지원 |
| 칩·세그먼트 | `erp-chip` · `erp-seg` | 적용된 조건 칩 · 상태별 건수 탭 (`aria-pressed`) |
| KPI 카드 | `erp-kpi` | 라벨 · 값 · 증감(`erp-up`/`erp-down`) |
| 폼 섹션 | `erp-section` · `erp-form-grid` | 4열 그리드, 넓은 항목 `erp-span-2` / `erp-span-4` |
| 카드 머리 · 2단 배치 | `erp-card-head` · `erp-cols` | 카드 제목 + 링크 / 본문 + 360 보조 패널 |
| 진행 단계 | `erp-steps` | 업무 흐름. 완료 `data-state="done"`, 현재 `aria-current="step"` |
| 처리 대기열 · 값 묶음 · 이력 | `erp-queue` · `erp-props` · `erp-timeline` | 콕핏·상세 화면 ([platform/](platform/README.md) 참고) |

## 6. ERP 공통 동작 규칙

1. **조회 우선** — 화면 진입 시 기본 조건(이번 달·내 담당)으로 자동 조회. 조건은 사용자별 저장.
2. **상태 흐름** — 작성중 → 확정 → 진행 → 완료. 확정 이후는 수정 대신 취소/정정 전표.
3. **권한** — 권한이 없는 버튼은 숨기지 않고 비활성(`aria-disabled`) + 사유 툴팁.
4. **피드백** — 저장 성공 토스트(3초) · 오류는 필드 인라인 · 미저장 이탈 경고 · 변경 감사로그.
5. **키보드** — F2 신규 · F3 조회 · F8 저장 · Esc 닫기 · Ctrl K 통합검색.

## 7. 새 화면을 만드는 법

1. 목록이면 `main.html`, 입력이면 `form.html` 을 복사한다.
2. 메뉴 경로·제목·조회조건·그리드 컬럼·액션만 바꾼다. 골격 영역(`data-region`)은 지우지 않는다.
3. 색·크기는 `var(--erp-*)` 만 쓴다. 새 값이 필요하면 `tokens.json` 에 먼저 추가하고 `erp.css :root` 에 같은 값으로 투영한다.
4. `npm run erp:check` 통과를 확인한다.

## 8. 검사 (`npm run erp:check`)

- tokens.json ↔ erp.css `:root` 값 일치, 정본에 없는 토큰 금지
- erp.css `:root` 밖에서 날것 색(`#hex`·`rgb()`) 금지, 글자 크기·굵기·모서리는 토큰만
- 테마(`themes/*.json` ↔ `themes/*.css`): 덮어쓰기는 기본 토큰 이름만, 추가 변수는 `<테마>-*` 만, 블록 밖은 토큰만
- 템플릿(`main.html`·`form.html`·`platform/**/*.html`): 인라인 `style` · `<style>` 금지, erp.css 에 없는 `erp-*` 클래스 금지, 골격 영역 필수, 영역당 Primary ≤ 1

## 9. 테마 (공식 2종)

| 테마 | 켜는 법 | 정본 | 성격 |
|---|---|---|---|
| **테마 1 · classic** (기본) | 속성 없음 또는 `data-theme="classic"` | `tokens.json` · `erp.css` | 테두리형 표준 ERP. 차분한 회청 바탕, 네이비 메뉴, 파란 Primary |
| **테마 2 · retro** | `data-theme="retro"` + `themes/retro.css` | `themes/retro.json` · `themes/retro.css` | 90년대 사무용 단말기. 크림 모눈 바탕, 잉크 2px 테두리·하드 그림자, 픽셀 제목(Galmuri11), 고정폭 숫자(IBM Plex Mono), 도장 뱃지, F키 상태바 |

- 두 테마는 **같은 HTML** 을 쓴다. 테마는 색·선·모서리·글꼴·그림자만 바꾸고 자리·차례·기능은 바꾸지 않는다.
- 제품은 사용자가 고른 테마를 사람별로 기억한다(예: 쿠키 `fpa-theme`). 서버가 첫 화면부터 `<html data-theme>` 를 찍어 깜빡임이 없게 한다.
- 새 테마는 `themes/<id>.json`(기본 토큰 덮어쓰기 + `<id>-*` 추가 변수) · `themes/<id>.css` 를 만들고 `themes/index.json` 에 등록해야 검사를 통과한다.

## 10. 다른 규격과의 관계

`design/claude-v1` 은 «버튼과 박스에 라인이 없다» 컨셉의 규격이고, 이 규격은 업계 통상 **테두리형** ERP 규격이다. 두 규격은 파일·토큰 이름(`--c-*` / `--erp-*`)이 겹치지 않아 함께 존재할 수 있다. `examples/claude/erp.html` 을 이 규격으로 옮길지는 다음 작업에서 결정한다.
