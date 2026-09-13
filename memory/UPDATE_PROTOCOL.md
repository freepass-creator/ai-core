# Memory Update Protocol

Use this when new Chat research, Work outcomes, AIOPS records, or DEVKIT/CIVILIZATION notes appear.

## Objective

Keep one compact, versioned inheritance memory that other AIs can read quickly without replaying the full Gmail/chat history.

## Update rules

1. **Do not append duplicates.** Search `CANONICAL.md` first. If the idea already exists, update its scope/status/evidence rather than creating another copy.
2. **Preserve provenance.** New mail/history records go to `EMAIL_INDEX.json` or an equivalent source index with message/source ID and status.
3. **Separate research from adoption.** A new CIVILIZATION/DEVKIT/Chat idea starts as a candidate unless there is explicit adoption evidence.
4. **Promote by evidence, not recency.** Newer date/version does not automatically supersede an older operating rule.
5. **Mark supersession explicitly.** If a default changes, update `CURRENT.md` and record the old rule under `Superseded defaults` or lineage.
6. **Keep current memory small.** `CURRENT.md` should contain only information that can materially alter near-term decisions or handoff behavior.
7. **Use history on demand.** `LINEAGE.md` is for why/how a rule evolved; do not load it for every task.
8. **Do not copy restricted raw data.** Generalize lessons; use pointers to owner systems for sensitive/project-specific facts.
9. **Record real outcomes.** If a research candidate gets a shadow/real result, update its status and evidence; do not infer success from implementation alone.
10. **Record failures too.** A rejected/suspended candidate stays in lineage so the same failed idea is not rediscovered as new.

## Proposed lifecycle

`OBSERVED → CANDIDATE → LOCALLY_TESTED → INDEPENDENTLY_VERIFIED → SHADOW_VALIDATED → OUTCOME_VERIFIED → ADOPTED_WITHIN_SCOPE`

Failure paths:

`REWORK / REJECTED / SUSPENDED / SUPERSEDED`

Not every item must pass through every state, but state names must not imply evidence that does not exist.

## What Work should write back

At handoff completion, Work should provide or point to:

- task/plan identifier;
- starting and ending revision;
- files changed;
- commands/checks actually executed;
- pass/fail/skip counts or equivalent evidence;
- unresolved blockers/uncertainty;
- whether the change altered an existing principle or produced a reusable failure/success lesson;
- actual outcome if observable.

Chat/AI Core then decides whether the result belongs in project-local memory, AIOPS, DevCenter, Doc Center, or this cross-system memory.

## Conflict resolution

Priority for a specific task:

1. user's latest explicit instruction;
2. current adopted owner-system/project source for that scope;
3. reproducible/observable evidence;
4. execution logs;
5. this memory's generalized guidance;
6. AI inference.

This memory must never overwrite a project/case SSOT merely because it is easier to access.