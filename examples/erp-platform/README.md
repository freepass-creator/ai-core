# 범용 ERP 플랫폼 — 명세 구동 시안 (Claude 공모작)

이미지 목업이 아니라 **돌아가는 규격**이다. 화면의 정본은 [`erp.spec.json`](erp.spec.json) 하나이고,
메뉴·대시보드·결재함·목록·상세·입력·상태 흐름·권한·계산·재고 반영이 전부 그 파일에서 나온다.
모듈을 늘리려면 코드가 아니라 명세에 entity 를 더한다.

## 파일

| 파일 | 역할 |
|---|---|
| `erp.spec.json` | **정본.** 표준(필드 타입·문서 종류·tone·채번·계산·가드·효과) + 역할 + 모듈/entity + 대시보드 |
| `erp.seed.json` | 시안용 가상 데이터 (47건) |
| `erp-engine.js` | 순수 로직 — 계산·상태 전이·권한·가드·효과·채번·검증. 업무별 `if` 없음. Node 시험과 브라우저가 같이 씀 |
| `erp-app.js` | 렌더러 — 명세를 읽어 화면을 그림 |
| `erp.css` | 배치만. 색·크기·모서리는 [claude-v1 정본](../claude/claude-v1.css) 토큰만 |
| [`scripts/validate-erp-platform.mjs`](../../scripts/validate-erp-platform.mjs) | 규격 검사기 (`npm run erp:validate`) |
| [`test/erp-platform.test.mjs`](../../test/erp-platform.test.mjs) | 동작 시험 + 무력화 시험(규격을 깨면 빨강) |

## 들어 있는 것 (5모듈 · 11 entity)

- **영업** 거래처 · 견적 · 수주 / **구매** 공급사 · 발주 / **재고** 품목 · 입출고
- **재무·회계** 전표(차대변 균형 가드) · 세금계산서(연체) / **인사** 사원 · 휴가 신청(승인 시 연차 차감)
- 공통: 대시보드 지표, 역할별 **결재함**, 역할 바꿔 보기(담당자·팀장·재무·관리자), 일괄 처리, CSV 내보내기, 변경 이력

## 규격 (검사기가 강제)

1. entity 는 `master`(기준정보: code 필수, 사용/중지) · `document`(채번·결재) · `ledger`(확정 후 수정 불가) 셋 중 하나
2. 문서번호 `{prefix}-{yyyy}{mm}-{seq4}`, prefix 는 겹치지 않는다
3. 상태 tone 은 `idle·accent·ok·warn·risk` 다섯뿐, 상태 글자와 함께만 쓴다
4. 끝이 아닌 상태는 반드시 나갈 길이 있다(막다른 상태 금지), 끝 상태에서는 못 나간다
5. 한 상태·한 역할에 primary 동작은 하나까지. `risk` 동작은 확인문(confirm) 또는 사유 입력 필수
6. 가드에 막힌 동작은 숨기지 않고 **막힌 이유**를 보여 준다
7. 효과(재고·연차 증감)는 전부 가능할 때만 한꺼번에 반영 — 반쯤 반영 없음
8. 시안 데이터도 명세를 지켜야 한다, 배치 CSS 에 선·그림자·날색·토큰 밖 값 금지

## 열기

```bash
python3 -m http.server 4178   # 저장소 루트에서 (fetch 로 명세를 읽으므로 file:// 은 안 된다)
# → http://localhost:4178/examples/erp-platform/
npm run erp:validate
node --test test/erp-platform.test.mjs
```

## 아직 안 한 것

- 저장은 브라우저 localStorage 뿐(시안). 서버·DB·인증 연결 없음
- 권한은 역할 단위. 부서·금액 한도별 결재선(전결 규정)은 명세 확장 자리만 있다
- 줄 입력은 품목/계정 한 종류의 lines 필드만 지원
- 다크 모드는 정본 토큰(`prefers-color-scheme`)을 따르며 눈으로는 덜 봤다
