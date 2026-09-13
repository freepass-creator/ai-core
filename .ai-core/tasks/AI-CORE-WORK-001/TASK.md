# AI-CORE-WORK-001

## Goal
Take the current AI Core implementation branch and turn it into a reproducibly tested Work/Codex result without redefining the product intent.

## Source branch
`feature/orchestrator-v0.1`

## Work ownership
Work/Codex owns implementation, build/test/debug, and result packaging for this task. Chat must not modify the same implementation files while status is WORK_ACTIVE.

## Required outcome
- checkout the source branch at its current head before work begins
- inspect existing project instructions before editing
- run the existing test/demo workflow in a real repo environment
- repair failures within the declared scope only
- add missing implementation glue only when needed to make the declared v0.2 candidate executable/testable
- commit and push all Work changes
- leave a machine-readable result with start SHA, end SHA, commands, test counts, failures/skips, changed files, unresolved issues

## Forbidden
- no main merge
- no deployment
- no external data writes, permission changes, deletion, payment, or production action
- no silent scope expansion
- no claiming PASS for skipped, zero-count, unsupported, or stale tests

## Handoff back to Chat
When finished, change owner to `chat_review` and provide the final commit SHA plus WORK_RESULT.json. Chat will review the result against task intent and acceptance criteria before any merge decision.
