# aiops 에서 건진 미병합 가지

`freepass-creator/aiops` 저장소는 2026-09-25 대표 지시로 **삭제**된다(「AI 옵스도 삭제할 거니까 빨리 삭제할 거라고 생각하고 데이터 가져갈 거 가져가라」).
main 에 병합되지 않은 가지 중 이 저장소가 주인인 것을 **가지 하나당 패치 하나**로 남긴다.

| 가지 | 커밋 | 끝 커밋 | 패치 |
|---|---:|---|---|
| `claude/rental-manager-analysis-z139xg` | 1 | `1308d3b6072f` | [`claude__rental-manager-analysis-z139xg.patch`](claude__rental-manager-analysis-z139xg.patch) |
| `codex/secure-firebase-key-handoff-20260922` | 1 | `58570912ba93` | [`codex__secure-firebase-key-handoff-20260922.patch`](codex__secure-firebase-key-handoff-20260922.patch) |

- 패치는 `git diff --binary --irreversible-delete <merge-base> <가지 끝>` 이다 — 경로는 **aiops 루트 기준**이다. 머리 주석에 병합 기준·끝 커밋·커밋 목록이 있다.
- 적용: 대상 폴더에서 `git apply --3way --directory=<옮겨 둔 폴더> <패치>`. 원본 기준이 사라졌으므로 맞지 않는 줄은 손으로 옮긴다.
- 개인정보: 고객 이름·전화·주민번호는 `고객NNN`·`010-0000-0000`·`######-#######` 로 바꾼다(이 패치들에는 바꿀 값이 없었다). git 이력은 가져오지 않았다.
- main 과 같은 내용이라 버린 가지: `codex/refresh-ai-core-kit-v2-20260922`, `gpt/penalty-p0-fail-closed-20260925`, `gpt/penalty-p0-guardrails-20260925-r2`, `gpt/penalty-p0-guardrails-20260925-r3`(main 대비 새 커밋 0).

## `ai-core-v0.1-candidate/` (다른 뿌리의 가지)

`origin/ai-core-v0.1-candidate` @ `013580ffa45b2dc9b8f01dfe0d0dfc3d8c539103` 는 2026-09-13 무렵 aiops 의 옛 사본 위에 AI Core v0.1 초안 문서를 얹은 가지다. 옛 사본 부분은 main 의 더 새 판으로 대체됐으므로 버리고, **AI Core v0.1 문서 6개(`ai-core/*.md`)만** 이력 자료로 옮겼다. 지금의 규격이 아니다 — 현행은 `docs/AI_WORKING_STANDARD.md` 다.
