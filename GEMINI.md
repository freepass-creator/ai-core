# AI Core project entrypoint

Read [WORK_READ_FIRST.md](WORK_READ_FIRST.md), then follow the current [AI Academy Constitution](docs/AI_WORKING_STANDARD.md). Work directly on the user's current task using the target project's canonical source and instructions.

Before editing a project, run `npm run academy:start -- --task "<user outcome>" --root <target repo> --track <development|design|data|operations|document>`. Proceed only from a `READY` receipt pinned to the actual project revision. If creating an asset, also pass `--create`, `--decision`, `--selected`, and `--reason`; a missing reuse decision is `HOLD`.

Do not require a central order, work packet or claim for ordinary work. Apply those contracts only when the task explicitly continues an existing central-order workflow. Preserve repository state, permission boundaries and sensitive-data limits. Return the actual changes, verification, unresolved items and `next_start_here` so another AI can continue without rereading the whole conversation.
