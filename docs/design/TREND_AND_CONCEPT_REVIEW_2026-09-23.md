# 밖의 기준과 대조 · 컨셉 부합 점검 — 2026-09-23

대표: 「내 의견을 따르긴 하는데 트렌드에 맞춰야 돼. 이렇게 디자인하는 게 있는지, 이렇게 디자인해도 되는지 이런 거를 좀 잘 맞춰야 되고, 내가 정한 컨셉에 부합하는지까지도 봐야 되고」

그래서 이 문서는 **우리 규칙 → 밖의 근거 → 판정** 순서로 적는다. 근거는 **공식 문서만** 쓴다(블로그·의견글 제외). 검증 못 한 것은 `UNVERIFIED` 로 남긴다 — 「없다」가 아니라 「모른다」다.

컨셉(대표 2026-09-23): **심플·미니멀, 대신 구분되고 표시되고 기능은 다 된다.**

---

## 0. 가장 중요한 근거 — 테두리를 지워도 되는가

WCAG 2.2 SC 1.4.11 (비문자 대비)는 「사용자 인터페이스 요소와 상태를 **식별하는 데 필요한** 시각 정보」에 3:1 을 요구하고, **비활성(disabled) 요소는 예외**로 둔다. 그리고 Understanding 문서의 Boundaries 절이 우리 컨셉을 그대로 허용한다:

> "If a control has visible content (such as text or a sufficiently contrasting icon) ... a border or other indication of the overall boundary of the hit area is not required."
> — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html

**판정: 컨셉이 규범과 충돌하지 않는다.** 글자나 충분한 대비의 아이콘이 있으면 테두리는 «요구되지 않는다». 다만 그 글자는 여전히 1.4.3(4.5:1)을 지켜야 하고, 그래서 우리 측정표가 모든 면 위에서 글자 대비를 함께 잰다.

---

## 1. 박스(카드·패널)에서 선을 뺀 것

| 밖의 근거 | 내용 |
|---|---|
| Material 3 | 카드 세 갈래(elevated·filled·outlined) 중 하나를 고르는 것이고 「filled cards provide subtle separation from the background」 — https://m3.material.io/components/cards/guidelines |
| Apple HIG | 묶음 화면은 테두리가 아니라 **배경 층**으로 가른다(systemGroupedBackground ↔ secondarySystemGroupedBackground) — https://developer.apple.com/design/human-interface-guidelines/color |
| Fluent 2 | 카드 기본 appearance 가 `filled`(선 없음), `outline` 은 선택 — microsoft/fluentui react-card Spec |
| Carbon | 기본 타일은 채움만, 선은 «상호작용» 타일에서만 — https://carbondesignsystem.com/components/tile/style/ |
| **반대편 근거** | shadcn/ui Card 는 `ring-1`(가는 선)을 기본으로 두고, Primer 에는 `BorderBox`가 있으며, Atlassian 은 「flat 카드는 테두리와 짝지으라」고 한다 — https://atlassian.design/foundations/elevation |

**판정: 흔한 방식이다. 단, 공짜가 아니다.** 앱·모바일 쪽(M3·Apple·Fluent·Carbon)은 면으로 가르고, 데이터 밀도 높은 웹 대시보드 쪽(shadcn·Primer·Atlassian)은 가는 선을 남긴다. 선을 뺀 대가는 **면 단계를 더 벌리는 것**이고, 우리는 실제로 그렇게 했다:

| | 바탕 ↔ 면 대비 | 선을 쓰나 |
|---|---|---|
| GitHub Primer (light, https://primer.style/foundations/primitives/color) | `#ffffff` ↔ `#f6f8fa` = **1.07** | 쓴다 (`borderColor-default #d1d9e0`, 흰 면 대비 1.43) |
| Material 3 (light) | surfaceContainerLowest ↔ surfaceContainer = **1.15** / High = **1.23** | 안 쓸 수 있다 (filled card) |
| **AI Core** | `#ffffff` ↔ `#eaeef4` = **1.16** | 안 쓴다 |

우리 값은 M3 의 컨테이너 단계 범위 안에 있다. **선을 빼면서 Primer 수준(1.07)의 얕은 단계를 쓰는 것이 틀린 조합**이었고, 그게 직전까지 우리 상태(1.06)였다.

**컨셉 부합: ○** — 덜어냈고(선), 구분은 측정으로 지킨다.

---

## 2. 버튼에서 선을 뺀 것 — ★여기서 하나 고쳤다

| 밖의 근거 | 내용 |
|---|---|
| Material 3 | 강조 순서 「Elevated · Filled · **Filled tonal** · Outlined · Text」. 가장 중요한 동작은 filled(선 없음). outlined 는 중간 강조로 «남아 있다» — https://m3.material.io/components/buttons/guidelines |
| Fluent 2 | **기본 버튼은 테두리가 있다**. 기본 appearance 가 `secondary` 이고 `border: strokeWidthThin solid colorNeutralStroke1` — microsoft/fluentui react-button |
| Apple HIG | 「가장 유력한 동작에 두드러진 스타일」, 두드러진 버튼은 화면당 한둘. 기본이 테두리 없는지는 UNVERIFIED |

**판정: 기본(primary) 버튼을 채움으로 두는 것은 주류다. 그러나 「모든 버튼에서 선을 뺀다」는 보편이 아니다.** Fluent 는 정반대다.

**우리 결함**: 보조 버튼(`.ui-button.secondary`)이 흰 카드 위에서 **흰 면 + 선 없음** 이었다. 즉 글자 말고는 아무 신호가 없는 M3 의 「Text button」(최저 강조)인데, 자리는 「임시 저장」 같은 중간 강조 동작이었다. WCAG 상으로는 글자 예외로 허용되지만, **컨셉의 「구분이 되어야 한다」에는 미달**이다.

**고침**: 보조 버튼을 **우묵한 면(tonal)** 으로 바꿨다 — M3 의 filled tonal 자리, 측정 1.27:1. 테두리를 되살리지 않고 「누를 수 있는 것」으로 읽힌다.

**컨셉 부합: 고친 뒤 ○**

---

## 3. 칩(필터) — 우리가 살짝 벗어난 곳

| 밖의 근거 | 내용 |
|---|---|
| Material 3 | 선택된 필터 칩은 **앞에 체크 아이콘이 붙는다** — 「appends a leading checkmark icon to the starting edge」 https://m3.material.io/components/chips/guidelines |
| Material 3 | 선택 안 된 필터 칩은 **외곽선을 쓴다** — 「Use an outline to define the edge of the chip's container」. 안드로이드 구현 기본값 `chipStrokeWidth=1dp`, `checkedIconVisible=true` |

**판정: 체크 아이콘은 정확히 일치한다**(우리는 루시드 check 를 마스크로 그린다). **외곽선은 의도적으로 벗어났다** — 대신 우묵한 면(1.27:1)으로 칩의 경계를 만든다. M3 자신도 칩 색 역할에 「Surface container low (optional)」 채움을 둔다. 벗어남이지만 같은 문제를 다른 수단으로 푼 것이고, 측정값이 그 수단을 보증한다.

**컨셉 부합: ○** (덜어냈고, 구분은 면+굵기+체크 셋으로)

---

## 4. 값 넣는 자리에 선을 남긴 것

| 밖의 근거 | 내용 |
|---|---|
| Material 3 | 「A text field container has a fill and a stroke either around the entire container, or just the bottom edge」 — 두 변형 모두 선이 있다 https://m3.material.io/components/text-fields/guidelines |
| Fluent 2 | 입력 기본 appearance 가 `outline` — 「the field has a full outline, with a slightly darker underline」 |
| Apple HIG | 테두리 요구를 적지 않음 — UNVERIFIED |

**판정: 우리 규칙(값 넣는 자리만 선)은 주류와 정확히 같다.** 「버튼은 빼고 입력은 남긴다」가 임의 취향이 아니라는 뜻이다.

---

## 5. 호버·누름 상태 층

Material 3 상태 층 불투명도: **hover 0.08 · focus 0.10 · pressed 0.10 · dragged 0.16 · disabled 0.38** — https://m3.material.io/foundations/interaction/states/state-layers

**우리**: hover `0.08`(일치), pressed 는 처음 `0.12` 로 잡았다가 근거가 없어 **0.10 으로 맞췄다**. focus 는 층 대신 윤곽선(측정 3:1 이상)으로 쓴다 — 키보드 포커스는 「보이는 것」이 규범 요구라 층보다 윤곽선이 확실하다.

---

## 6. 비활성(disabled) — 우리가 기준보다 «더» 엄격한 곳

| 밖의 근거 | 내용 |
|---|---|
| Material 3 | 「visually communicated through color changes and reduced elevation」, 그리고 「Disabled states don't need to meet Material's contrast requirements」 |
| WCAG 2.2 | 1.4.11 에서 **비활성 요소는 예외** |

**판정: 색만 바꿔도 규범 위반은 아니다.** 그런데 우리 컨셉은 「구분이 되어야 한다」이고, 선이 없는 화면에서 색 하나는 색각·저대비 환경에서 사라진다. 그래서 **면+글자 둘을 함께 바꾸는 쪽으로 유지**한다(기준보다 엄격한 선택이고, 그게 선택임을 여기 적어 둔다). Apple 쪽 수치는 UNVERIFIED.

---

## 7. 아이콘 — 루시드

- 24×24 캔버스, 기본 stroke 2px — https://lucide.dev/contribute/icons/design-principles
- stroke 는 크기에 따라 함께 줄어든다(기본 SVG 동작). 고정하려면 `nonScalingStroke`.
- **작은 크기(16px)에서 stroke 를 올리라는 공식 권고는 없다 — UNVERIFIED.** 우리 규칙(「배치마다 stroke 를 바꾸지 않는다」)은 문서가 금지하지도 요구하지도 않는 **우리 선택**이다. 밀도 높은 표에서 16px 아이콘이 흐려 보이면 이 규칙부터 다시 보면 된다.
- 라이선스 **ISC** 확인 — https://lucide.dev/license (Feather 유래분은 MIT). 표기는 `design-system/icons.lucide.json` 에 들어 있다.

---

## 남은 것 (정직하게)

- **다크 모드 없음.** 선 없는 디자인에서 다크는 별도 면 스케일을 요구한다(어두울수록 올라온 면이 «밝아진다»). 지금 토큰 구조에 얹을 수 있게 만들어 뒀지만 아직 안 했다. 반만 하면 오히려 해롭다.
- **`tokens.css` 갈라짐.** 2026-09-14 브라우저 영수증이 지문으로 묶고 있어 이전 값이다. 영수증 재실행(axe 포함)이 Codex 레인의 남은 한 건.
- **Polaris·Apple 일부 수치 UNVERIFIED.** 공식 페이지에서 확인 못 했다. 확인되면 이 문서에 채운다.
