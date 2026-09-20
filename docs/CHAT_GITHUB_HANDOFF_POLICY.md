# Chat to GitHub handoff policy

## Purpose

Work performed in a chat must not remain only in that chat. GitHub is the durable development and handoff record. A chat is a working surface; the relevant project repository keeps the reviewed result, evidence pointers, unresolved items and the next starting point.

This policy does not require copying full conversation transcripts into GitHub. Sensitive, personal, credential, customer, legal and financial source content stays in its approved source. GitHub receives a minimized, reviewed work record or a pointer to the restricted source.

## Completion rule

A chat task is not complete until one of these outcomes exists:

1. a commit or pull request in the target project repository;
2. a reviewed handoff file ready for a local Codex session to commit;
3. an explicit `HOLD` record naming why GitHub publication could not be completed and what must happen next.

Saying that a result exists in a chat, draft, local file or unpushed branch is not GitHub publication.

## Where to save

- Project-specific work goes to that project's repository, normally `docs/HANDOFF.md`, `docs/handoffs/`, an existing work packet, issue or pull request.
- Cross-project coordination, routing and portfolio status go to `freepass-creator/ai-core`.
- Executable KakaoTalk and operations automation stays in `freepass-creator/aiops`; AI Core stores only the routing, contract and cross-project handoff.
- If the target repository is unknown, save a routing proposal in AI Core and mark the project mapping `HOLD` rather than inventing a destination.

## Minimum record

Every chat handoff must include:

- task title and source chat/thread identifier when available;
- recorded time and authoring AI;
- target repository, branch and checked revision;
- original request summarized without inventing requirements;
- completed work and changed files;
- tests or checks actually run and their result;
- items not run or not independently verified;
- blockers, risks and `HOLD` items;
- `next_start_here`: the next concrete action and file or command to begin with;
- local-only work packet when the next step requires files, processes, browsers, credentials or a real device.

## Role boundary

- General chat: research, planning, document drafts, GitHub issue/PR/repository classification and review.
- Local Codex: local files and processes, implementation, integration, tests, browser/device verification and Git operations.
- Claude: complex design, contradiction and important wording review.
- Cursor: codebase exploration and static code review.
- Gemini: long Google Workspace source analysis with minimum necessary disclosure.

The chat assigns local-only work through a bounded work packet. It must not claim that local execution, tests, deployment or external delivery happened when it did not observe them.

## Publication verification

Before reporting that a chat result is preserved in GitHub, verify:

1. the exact commit SHA or pull request URL;
2. remote readback of the committed file;
3. CI result when a runner actually started;
4. any remaining `HOLD`, including unavailable CI.

GitHub Actions failing before runner assignment is infrastructure failure, not a test result. Local test evidence may be recorded separately but cannot be described as GitHub CI success.

