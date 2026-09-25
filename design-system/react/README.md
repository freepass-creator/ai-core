# design-system/react — 본사 공용 React 원자

본사 디자인 정본(`design-system/tokens.runtime.css`) 위에 선 React 부품과 훅이다. 페이지는 부품을 여기서만 가져다 쓴다.

> 대표(2026-09-25): 「그 외적인 개발, 문서, 디자인, UI, UX 이런 것만 AI 코어에 모아둔다」 · 「본사로 가져갈 기능들만 뽑으라는 거야. 그 프로젝트의 고유 기능은 거기에다 남겨야」

## 들어 있는 것 (v0.1 — 첫 묶음)

| 묶음 | 이름 |
|---|---|
| 토큰 다리 | `C` · `R` · `SH` · `ELEV` · `SCRIM` · `CTRL`/`ctrlH`/`ctrlFs`/`ctrlInputFs` · 표 셀 스타일 |
| 컨트롤 | `Btn` · `IconBtn` · `Input` · `TextArea` · `Select` · `Checkbox` · `Search` · `TextLink` · `PillTabs` · `IconSeg` · `ToggleChips` · `FilterChips` |
| 층 | `Modal` · `Drawer` · `BottomSheet` · `FilterSheet` · 확인·입력창(`ConfirmProvider` · `useConfirm` · `usePrompt`) · `ContextMenu` · 마법사(`WizPanel` · `WizCard` · `WizField` · `WizPhotos`) |
| 화면 | `PageToolBar` · `MobileToolbar` · `MonthCalendar` · `StatusBadge` · `Spinner`/`Loading`/`LoadingOverlay` · `ToastHost`/`toast`/`toastError`/`toastInfo` · `FileDrop` · `SignaturePad` |
| 훅 | `useIsMobile` · `useMinWidth` · `useDeskTier` · `haptic` · `useSecOrder` · `useRowSelection` · `useTableSelection` · `useCtrlASelectAll` · `useBusyAction` |

원본은 렌터카 매니저 `freepass-creator/renman` 의 공용 원자다. 파일마다 원본 blob·sha256·바꾼 점은 [`PROVENANCE.json`](PROVENANCE.json).
렌터카 업무에 묶인 두 부품(회사 필터 `CompanyFilter`, 결산 기간 `PeriodBar`)은 빼서 renman 에 남겼다.

## 지키는 것 — `npm run design:react:check` (CI)

1. 원자가 쓰는 CSS 변수는 전부 `design-system/tokens.runtime.css` 에 있어야 한다.
2. 리터럴 색(#hex · rgb/rgba)은 `src/ui/tokens.ts` 에만 둔다. 떠 있는 층 그림자·토스트·서명 잉크처럼 변수로 못 하는 것도 거기에 이름을 붙여 둔다.
3. 패키지 밖 import 는 `react` · `lucide-react` 뿐이다.
4. PROVENANCE 가 파일을 빠짐없이 지금 내용으로 적는다. `EXACT_COPY` 는 원본과 한 바이트도 다르면 안 된다.

타입검사: `npm run design:react:typecheck` (CI).

## 쓰는 법

프로젝트는 ai-core 의 **고정 revision** 을 채택한다(`latest` 자동 추종 금지 — 그룹 운영 모델 2절). 채택 전까지 각 프로젝트는 제 사본을 그대로 쓴다.

## 다음 묶음 (인벤토리 `docs/integration/HQ_EXTRACTION_INVENTORY_2026-09-25.md` 1단계)

- freepasserp4 `components/ui` 의 목록·표·폼 격자·상세·레이아웃 원자 — 업무 톤맵(차량 상태 등)은 프로젝트에 남긴다.
- renman `table`·`ledger-frame`·`action-menu` — 업무 라벨을 걷어낸 뒤.
- estimate 진동 설치기(프레임워크 무관판).
