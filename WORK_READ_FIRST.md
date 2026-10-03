# AI Core — 먼저 읽는 한 쪽

> 이 문서는 «지금» 하나만 말한다. 지난 지시는 [이력](docs/audits/WORK_READ_FIRST_UNTIL_2026-10-03.md)에 있고, 여기와 다르면 여기가 맞다.

## 지금 방향

- 사용자는 각 AI 에서 **직접** 일한다. 중앙 오더·claim·승인 대기는 일반 업무의 선행 조건이 아니다.
- **AI Core = 두뇌**(판단·규칙·노하우·기록). **AI Ops = 손발**(PC 위의 실행·자동화). 새 일은 «생각/기억이냐, 몸 동작이냐»로 소속부터 가른다 — `registry/platforms.json`.
- AI Core 는 여러 AI 가 실전에서 같은 규율을 익히는 **AI 사관학교**다. 최상위 규격은 [헌법](docs/AI_WORKING_STANDARD.md) 하나다.
- 고도화는 실제 업무에서 겪은 불편 하나를 줄이는 작은 개선부터 한다. 새 프레임워크·새 허브를 먼저 만들지 않는다.

## 시작할 때 (순서대로)

1. `npm run duo -- inbox` — 답 안 한 상의가 있으면 그것부터. (모든 worktree 를 합쳐 본다)
2. `npm run academy:start -- --task "<사용자 결과>" --root <대상 저장소> --track <development|design|data|operations|document>`
   - `READY` 면 시작. `HOLD` 면 `blockers` 만 푼다. `warnings` 의 `REGISTRY_HEAD_STALE` 는 등록부가 늦은 것 — 막힘이 아니다.
   - 새 파일·모듈·문서를 만들 거면 먼저 `npm run reuse:check -- "<만들 것>" --root <대상>` 하고 `--create … --decision …` 을 붙인다.
3. 대상 프로젝트의 지침(AGENTS.md·CLAUDE.md)과 정본을 읽는다. 대상 프로젝트 지침이 AI Core 보다 앞선다.
4. 설계·규격 결정, 되돌리기 어려운 변경, 중요한 문안은 상대 AI 와 상의한다 — 호출법은 [CLAUDE.md](CLAUDE.md) 머리. 사소한 단일 파일 수정은 혼자 한다.

## 지키는 것

- **막힘을 통과로 세지 않는다.** 못 불렀으면 FAILED/BLOCKED 로 적는다. 모르면 「모른다」.
- **기록이 없으면 안 한 것이다.** 상의는 `docs/coordination/CROSS_AI_LOG.md`, 결과는 GitHub(PR·커밋)에 남긴다. 채팅에만 둔 결과는 사라진다.
- **가지는 main 한 방향.** 작업은 `work/<project-id>/<work-id>` 가지 → PR → main. `node scripts/check-branch-flow.mjs` 가 판정한다. worktree 를 지우기 전엔 `npm run duo -- stranded --worktree <경로>`.
- **배운 것은 저장소에 둔다.** 한 AI 의 개인 메모리에만 두면 다른 AI 는 못 배운다 — `registry/operating-knowledge.json`·`docs/episodes/`.
- **규칙에는 검사기를 붙인다.** 글로만 있는 규칙은 지켜지지 않았다(2026-10-03 실측: 가지 규칙·duo 우편함).
- **되돌리기 어려운 일은 직전 승인.** 삭제·공개 전환·결제·실제 발송·운영 데이터 변경은 사용자 승인 전까지 `HOLD` 다. 앞선 승인은 다음 동작으로 이어지지 않는다.
- **민감정보**(주민번호·계약서 원문·키)는 커밋하지 않는다 — `npm run security:secrets`. 상대 AI·외부 도구에는 비식별한 최소 맥락만 넘긴다.

## 끝낼 때

결과를 `목적 / 대상 revision / 변경 / 검증 / 남음 / next_start_here` 로 남긴다. 사용자 수정·재작업·거짓 완료가 1 이상이면 Episode 와 함께 `npm run academy:closeout` — [ACADEMY_CLOSEOUT](docs/ACADEMY_CLOSEOUT.md).

## 이런 일이면 여기부터

| 상황 | 먼저 읽을 것 |
|---|---|
| 데이터 훼손·배포/보안 사고·AI 동시 수정·정본 불명확 | [비상매뉴얼](docs/EMERGENCY_RUNBOOK.md) — 해당 작업의 쓰기를 멈추고 [사고 기록](docs/INCIDENT_TEMPLATE.md). 문서를 읽은 것은 중지·복구 실행이나 승인이 아니다 |
| 실제 회사 업무를 AI Core 로 처리 | [운영 플레이북](docs/AI_CORE_OPERATING_PLAYBOOK.md) · `npm run ops:route -- "<오더>"` |
| UI/UX 공통 규격 | [UI/UX 헌법](docs/UI_UX_CONSTITUTION.md) → [화면 규격](docs/SCREEN_DESIGN_STANDARD.md) → `registry/ui-ux-features.json` |
| 본사·자회사 구조 | [그룹 운영 모델](docs/GROUP_OPERATING_MODEL.md) |
| 고도화 제안·반복 마찰 | [Evolution Bridge](docs/AI_CORE_EVOLUTION_BRIDGE.md) → [Evolution Inbox #211](https://github.com/freepass-creator/ai-core/issues/211) |
| 기존 중앙 오더(order-control-v1) 업무를 이어받음 | [공유 오더 실행](docs/SHARED_ORDER_EXECUTION.md) — 이 경로에서만 원장·claim 계약을 지킨다. 일반 업무용 order/work ID 를 새로 만들거나 추정하지 않는다 |
| 메일 | [기존 도구 연결](memory/TOOL_CONNECTIONS.md) — 설치·로그인 반복 금지, 발송은 승인 후 |
| 로컬 도구가 필요 | [도구 플레이북](docs/LOCAL_TOOLCHAIN_PLAYBOOK.md) · `npm run tools:doctor` |

압축 기억은 `MEMORY.md` → `memory/CURRENT.md`. 연구 후보(`memory/RESEARCH_INDEX.md`)는 자동 채택이 아니다. Gmail·Chat 기록은 출처일 뿐 운영 승인이 아니다.
