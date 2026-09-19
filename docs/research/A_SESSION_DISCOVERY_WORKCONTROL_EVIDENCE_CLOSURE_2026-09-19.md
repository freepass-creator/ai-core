# A Session Discovery — WorkControl Evidence-backed Closure

상태: **SUPPORTING_CROSS_PROJECT_EVIDENCE / NO_NEW_STANDARD / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: WorkControl
- Repository: `freepass-creator/workcontrol`
- Source path:
  - `app/task.tsx`
  - `scripts/proof.mjs`
  - `scripts/todo-push.mjs`
  - `docs/AI_SHEET_SPEC.md`
  - `lib/sheets.ts`
- Revision:
  - observed repository head: `b841ad748f39322a150ce3d3fdd5840fc8a7ee0f`
  - proof implementation: `scripts/proof.mjs@71e5063e7b7dfe5ae58051d2b36e9a35392f1cb9`
  - recovery todo implementation: `scripts/todo-push.mjs@60c4de327ebe30ff03c777d50608782843e62ff3`
- Category: Workflow / Evidence / Completion

## Current implementation

- User-facing task UI allows a worker to press `완료`.
- UI itself explicitly says the task is only considered truly finished after evidence is checked.
- `proof.mjs` independently tests completed collection/recovery work against business evidence:
  - dunning/collection complete requires either money received or vehicle returned;
  - recovery complete is rejected when asset state is still rented;
  - recovery without prior notice evidence is flagged as procedurally unsupported.
- `todo-push.mjs` keeps incomplete recovery work open and derives the next required step:
  - notice → recovery start → vehicle intake.
- disappearance from the derived problem set does not delete history; it transitions the task to resolved with a memo.
- `AI_SHEET_SPEC.md` separately defines work items with owner, due date, action and state.

## Comparison to existing A-session candidates

This is not a new standard family.

It independently reinforces:

- `workflow.guard-vs-evidence`
- `workflow.launch-vs-completion`

because a human/UI completion claim is not the same as verified business completion.

## Obligation-pair decision

This evidence is **not sufficient** to promote `workflow.obligation-pair`:

- the documentation defines `누가·언제까지`,
- but the inspected recovery runtime does not prove that due/timeout is mechanically enforced as part of the open→due→close obligation lifecycle.

Therefore:

- `workflow.obligation-pair` remains `PROJECT_VERIFIED` from AIOps.
- WorkControl is adjacent/partial evidence only.

## Destination

- D — supporting evidence only.
- No new canonical proposal is created.
