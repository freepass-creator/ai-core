# A Session Discovery — Renman Compensated Multi-write

상태: **PROJECT_VERIFIED / ROUTED_TO_D / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: Renman
- Repository: `freepass-creator/renman`
- Source path:
  - `lib/commit.ts`
  - `tests/commit-compensated.test.ts`
  - `lib/contracts/commit-transition.ts`
  - `tests/commit-transition.test.ts`
- Revision:
  - observed repository head: `262e06de09db94a116fa377ea2f5dbe024bb086b`
  - compensation implementation blob: `lib/commit.ts@e9b3e6d0b4e74cfe311c5b4ddefb9e6df96a3968`
  - compensation test blob: `tests/commit-compensated.test.ts@3d9038a57b2578960f349eb8c1d28b1868c1fac4`
- Category: Workflow / Partial Failure / Compensation / Rollback

## Current implementation

Renman has an executable compensation mechanism for multi-entity writes that are not protected by one datastore transaction.

`commitAllCompensated`:

1. applies operations sequentially;
2. records each successfully applied operation;
3. if a later operation fails, walks the applied operations in reverse order;
4. applies only operation-specific `undo` patches;
5. does not invent a generic rollback for operations that have no valid domain compensation;
6. records compensation through the normal commit path/audit path;
7. if compensation itself fails, it does **not** swallow that error and explicitly reports that a partial state remains.

The implementation comments correctly note that restoring "previous values" generically can be semantically wrong. The compensation patch belongs to the domain operation.

Tests verify:

- all-success path does not compensate;
- second-write failure compensates the first write;
- compensation runs in reverse order;
- operations without `undo` are not blindly reverted;
- compensation failure is surfaced as a remaining partial-state error;
- a real payment-matching consumer carries a domain-specific undo block.

## AI Core equivalent

AI Core Workflow research already states that multi-aggregate effects must choose one of:

- transaction
- outbox
- saga/compensation
- reconciliation

and must not hide partial success behind a success response.

However, the A-session promotion matrix did not yet have a project-verified compensation candidate with concrete executable semantics.

## Gap

AI Core has the architectural requirement; Renman has a reusable, tested specialization:

**multi-write failure → reverse-order domain compensation → explicit partial-state escalation when compensation fails**

This is stronger than a generic "support rollback" requirement.

## Project ahead / Core ahead / Different

- **Project > Core on verified compensation mechanics.**
- AI Core remains broader on workflow contract ownership and strategy selection.

## Generalizable

Yes.

Generalize:

1. multi-effect operation declares consistency strategy;
2. compensatable effects carry explicit domain compensation commands/patches;
3. only effects known to have succeeded are compensated;
4. compensation runs in reverse causal order unless the domain contract says otherwise;
5. non-compensatable effects are explicitly marked, not guessed;
6. compensation itself is audited;
7. failed compensation produces a distinct partial-state/HOLD/escalation result;
8. original failure and compensation failure remain separately observable.

Do not copy Renman's entity names, payment semantics or patch shapes into AI Core.

## Destination

- D — Workflow Standard primary
- C may later define result/error fields for compensation evidence, but canonical ownership of compensation semantics belongs to D.

## Recommended action

D should evaluate `workflow.compensated-multiwrite` as a machine-readable recovery/compensation contract candidate.

Potential contract concepts for D to decide:

- effect_id
- applied
- compensation_defined
- compensation_command
- compensation_order
- compensation_result
- partial_state_remaining
- escalation/evidence

A session does not define the final names or schema.

## Evidence level

- Current: `PROJECT_VERIFIED`
- Second-project exact evidence search in AIOps / ERP4 / FreePass Admin / FreePass Sales did not establish the same reverse-order domain compensation behavior.
- Next gate: `SECOND_PROJECT_REQUIRED`

## Reverse Import Pipeline

Discover → DONE
Evidence → DONE
Compare → DONE
Extract Pattern → DONE
Generalize → DONE
Assign D → DONE
Create Core Candidate → DONE (`workflow.compensated-multiwrite`)
Core adoption 확인 → PENDING
Source revision 기록 → DONE
완료 → PENDING
