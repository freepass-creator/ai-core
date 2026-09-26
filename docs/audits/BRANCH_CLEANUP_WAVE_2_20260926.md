# Branch Cleanup Wave 2 — 2026-09-26

Status: **ACTIVE PR SET COLLAPSED / UNIQUE HISTORY PRESERVED**

기준 main: `76f513ab0b61e30150887fc535a52f442e0eeb7b`

## 관측

- remote branches: **289**
- cleanup 직전 open PR: **4**
- 네 PR 모두 현재 main보다 **211 commits behind**
- branch 자체는 고유 commit을 보유하므로 무턱대고 삭제하지 않는다.

## 이번 정리

| PR | 기존 head | unique ahead | 판정 |
|---|---|---:|---|
| #291 | `gpt/activation-authority-contract-20260925` | 5 | `HOLD_REEXTRACT` |
| #283 | `claude/erp-platform-ui-ux-hvfyfa` | 108 | `SUPERSEDED_REVIEW_ONLY / PATTERN_EXTRACTION` |
| #262 | `integration/shadow-freshness` | 2 | `HOLD_REEXTRACT` |
| #261 | `integration/docshub-templates` | 1 | `HOLD_REEXTRACT` |

네 PR은 모두 닫아 **열린 PR이 오래된 별도 개발선의 권위를 갖지 않게 했다.** 코드와 diff는 PR/branch history에 남아 있으므로 필요한 기능은 현재 main에서 새로 만들지 말고, 해당 evidence에서 유효한 부분만 현재 canonical line으로 재추출한다.

## 물리 branch cleanup

이 wave는 고유 commit이 있는 branch를 삭제하지 않는다. `ahead=0` 안전 retire 후보는 [Wave 1](BRANCH_CLEANUP_WAVE_1_20260926.md)의 기준을 계속 적용한다.

현재 연결된 GitHub 실행 경로에는 remote ref 삭제 동작이 노출되어 있지 않아 이 세션에서 물리 branch 삭제는 하지 않았다. 따라서 remote branch 총량 **289**는 그대로다. 이것을 정리 완료로 표현하지 않는다.

대신 현재 main에는 다음 방어가 이미 있다.

- `main`이 default canonical branch
- canonical line registry
- `RESUME BEFORE CREATE`
- actor-prefixed 신규 PR 차단
- 같은 canonical path의 복수 open PR 차단
- main 밖 workflow checkout 차단
- branch debt 정기 감사

## 다음 물리 정리 순서

1. Wave 1의 `ahead=0` branch부터 삭제
2. merged/closed PR head 중 `ahead=0` 삭제
3. actor-prefixed branch는 unique diff가 있는 것만 review queue로 남김
4. unique diff 회수 뒤 branch 삭제
5. 정상 live set을 `main + 0~2 work branches`로 유지

branch는 역사 보관소가 아니다. 역사는 commit/PR/tag에 남기고, 개발은 main으로 돌아온다.
