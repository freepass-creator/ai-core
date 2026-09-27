# AI Core project entrypoint

## 1순위 — 둘이 상의한다 (2026-09-27 대표 직접 지시)

**Codex 는 Claude 와, Claude 는 Codex 와 상의한다.** 다른 어떤 절차보다 먼저다.

- **Codex → Claude**: `npm run claude:status` 로 열려 있는지 보고 `npm run claude:review -- <인자>` 로 부른다.
- **Claude → Codex**: `codex exec -s workspace-write -C <경로> --skip-git-repo-check -o <출력> "<질문>" < /dev/null`
- 부른 사실과 답을 `docs/coordination/CROSS_AI_LOG.md` 에 한 줄 남긴다. 기록이 없으면 «안 부른 것»으로 본다.
- 상대가 막혀 있으면(사용량 한도 등) 그 사실과 풀리는 시각을 적는다. **막힘을 통과로 세지 않는다.**
- 상의가 필요한 일: 설계·규격 결정, 되돌리기 어려운 변경, 반례가 필요한 판단, 중요 문안.
  사소한 문구·형식, 단일 파일의 가역적 변경은 혼자 한다.

★이 규칙을 1순위로 올린 이유(실측): 2026-09-21 사용량 한도로 게이트가 닫혔고 **9-22 새벽에 이미 풀렸는데**,
그 뒤 6일간 호출이 한 번도 없었다. 호출 이력이 남지 않아 「안 불렀다」와 「부르다 실패했다」를 구별할 수도 없었다.
상의는 «생각나면 하는 것»이 아니라 **처음에 확인하는 것**이다.

Read [WORK_READ_FIRST.md](WORK_READ_FIRST.md), then follow the current [AI Academy Constitution](docs/AI_WORKING_STANDARD.md). Work directly on the user's current task using the target project's canonical source and instructions.

Before editing a project, run `npm run academy:start -- --task "<user outcome>" --root <target repo> --track <development|design|data|operations|document>`. Proceed only from a `READY` receipt pinned to the actual project revision. If creating an asset, also pass `--create`, `--decision`, `--selected`, and `--reason`; a missing reuse decision is `HOLD`.

Do not require a central order, work packet or claim for ordinary work. Apply those contracts only when the task explicitly continues an existing central-order workflow. Preserve repository state, permission boundaries and sensitive-data limits. Return the actual changes, verification, unresolved items and `next_start_here` so another AI can continue without rereading the whole conversation.
