# AI Core UI Composition Standard v1.0

Status: **CANONICAL CANDIDATE**

## Purpose

AI Core 공통 UI/UX는 색상·폰트·버튼 모양만 통일하지 않는다.
반복되는 화면 구조는 **기능 필요성 → 공식 composition mode 선택 → 공통 배치 문법 적용** 순서로 만든다.

프로젝트가 검색창, 필터, 퀵필터, 결과건수, 적용조건을 임의의 위치에 조립해서 새로운 로컬 표준을 만드는 것을 금지한다.

## 1. Search & Discovery 공식 4모드

한 검색 surface는 아래 중 **정확히 하나**를 선언한다.

### A. SEARCH_ONLY

구조:

```
[ 검색창                                   ]
```

사용 조건:
- 자유 검색만으로 주요 업무가 끝난다.
- 별도의 반복 structured filter가 필요하지 않다.

금지:
- 공간이 남는다는 이유로 필터 버튼을 추가하지 않는다.

### B. SEARCH_FILTER

구조:

```
[ 검색창                         ][ 세부필터 ]
[ 적용된 조건 / 조건수 / 결과수                ]
```

사용 조건:
- structured filter가 필요하지만 반복적으로 즉시 전환할 소수 핵심 조건은 없다.
- 관리자/내부 업무 화면의 기본 선택이다.

배치:
- 필터 trigger는 검색창과 **같은 row, 바로 인접한 trailing 위치**에 둔다.
- 모바일에서는 trigger가 bottom sheet 또는 동등한 공통 overlay를 연다.
- PC에서는 drawer/sheet/popover 중 제품 profile이 정한 한 방식을 사용한다.

### C. SEARCH_QUICK

구조:

```
[ 검색창                                   ]
[ 전체 | 진행중 | 완료 | ...                  ]
```

사용 조건:
- 소수의 안정적인 조건을 사용자가 매우 자주 바꾼다는 운영 근거가 있다.
- 조건 의미가 설명 없이도 명확하다.

규칙:
- quick filter는 검색창 **바로 아래 별도 row**에 둔다.
- 장식용 shortcut이나 “있으면 편해 보이는” 조건을 넣지 않는다.

### D. SEARCH_FILTER_QUICK

구조:

```
[ 검색창                         ][ 세부필터 ]
[ 전체 | 진행중 | 완료 | ...                  ]
[ 적용된 세부조건 / 조건수                     ]
```

사용 조건:
- 대량 반복 업무에서 quick criteria와 secondary structured filter가 **둘 다 실제로 필요함이 확인된 경우만** 사용한다.
- 네 모드 중 가장 무거우므로 기본값으로 선택하지 않는다.

## 2. 선택 우선순위

항상 가벼운 모드부터 판단한다.

1. SEARCH_ONLY로 업무가 가능한가?
2. 아니면 SEARCH_FILTER만 필요한가?
3. 실제 반복 사용 근거가 있는 quick criteria가 있는가?
4. quick + detailed filter가 동시에 필요한가?

“기능을 넣을 수 있다”는 이유는 선택 근거가 아니다.

## 3. Quick Filter 자격

quick filter가 되려면 모두 만족해야 한다.

- 자주 반복해서 바꾸는 조건이다.
- 항목 수가 작고 안정적이다.
- 라벨만 보고 의미가 즉시 이해된다.
- 결과를 크게 나누는 실무 가치가 있다.
- detailed filter와 독립된 두 번째 state를 만들지 않는다.

위 조건을 못 만족하면 detailed filter로 보낸다.

## 4. 중복 조건 금지

동일한 business criterion을 다음 세 곳에서 서로 독립적으로 관리하지 않는다.

- 검색어 parser
- quick filter
- detailed filter

검색어가 structured condition을 해석할 수 있다면 현재 해석된 조건을 UI에 되돌려 보여 주고,
동일 조건의 세부필터 state와 충돌하지 않게 단일 query model로 합성한다.

## 5. Query SSOT

아래는 항상 같은 query revision을 본다.

- 검색어
- quick filter
- detailed filter
- 적용된 조건 표시
- facet count
- result count
- 결과 목록

부분적으로 이전 query를 보여주는 mixed snapshot을 금지한다.

## 6. Applied Filter

structured filter가 적용되면 사용자가 현재 조건을 알 수 있어야 한다.

허용:
- 조건 chip/token
- 필터 버튼의 적용 개수
- 둘의 조합

금지:
- 화면에는 결과만 줄어들고 어떤 조건이 적용됐는지 알 수 없는 상태

## 7. Responsive

모바일은 PC를 축소하지 않는다.

- 검색 row의 의미와 우선순위는 유지한다.
- detailed filter는 overlay surface로 전환할 수 있다.
- quick filter는 필요 시 가로 scroll을 허용한다.
- touch target은 AI Core 공통 최소 규격을 따른다.
- overlay 종료 후 focus는 filter trigger로 돌아간다.

## 8. Project Profile

프로젝트는 다음만 결정한다.

- 네 공식 mode 중 어느 mode를 쓰는지
- domain copy
- quick criteria 목록과 업무 근거
- detailed filter 내부 항목
- 허용된 brand/density 표현

프로젝트가 검색/필터의 새로운 위치 문법을 만들려면 AI Core exception 또는 공통 pattern 승격 절차가 필요하다.

## 9. FreePass Admin 기본값

FreePass Admin의 상품 찾기 기본 mode는 **SEARCH_FILTER**다.

이유:
- 관리자 검색창이 차량/공급사/상품 및 조건 검색을 담당한다.
- 상세 조건은 별도 필터로 충분하다.
- 1/6/12/24/36/60개월 같은 기간 shortcut은 현재 운영 근거 없이 quick filter로 상시 노출하지 않는다.

접수/정산의 상태 tabs는 검색 quick filter가 아니라 **업무 workflow navigation/filter**로 분류하며,
각 화면의 상태 업무량과 빈도를 근거로 별도 유지할 수 있다.

## 10. Direct Variant Selector

검색 결과를 좁히는 Quick Filter와, 실제 상품/서비스 variant를 고르는 선택줄을 구분한다.

예:
- 계약기간 13 / 27 / 48개월
- 트림
- 요금제
- 실제 재고 옵션

이 경우 `data.variant-selector`를 사용한다.

규칙:
- source data에 실제 존재하는 값만 표시한다.
- 관행적인 12/24/36/48/60 등을 빈 자리를 채우기 위해 만들지 않는다.
- 가로 선택줄은 overflow 시 horizontal scroll을 허용한다.
- 선택 상태를 명확하게 보여 준다.
- 한 표시값 아래 서로 다른 조건 variant가 여러 개면 하위 선택지를 그대로 노출한다.
- 최종 선택된 stable variant id가 다음 workflow로 넘어간다.
- 검색 query를 바꾸는 동작이 아니므로 Search Quick Filter로 분류하지 않는다.

## Machine binding

- feature: `data.search-discovery`
- runtime shell: `.ui-search-discovery`
- modes: `search-only | search-filter | search-quick | search-filter-quick`
- interaction contract: `search_discovery_composition`
- direct variant feature: `data.variant-selector`
- direct variant runtime: `.ui-variant-selector`
- direct variant interaction: `variant_selection`
