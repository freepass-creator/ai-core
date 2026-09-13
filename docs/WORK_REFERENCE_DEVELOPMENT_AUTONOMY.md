# Work Reference — Development Autonomy v0.1

This is a forward reference for Work/Codex. It does not expand the current Work Packet by itself.

## Read only when development-flow automation is relevant

1. `docs/DEVELOPMENT_RUNTIME.md`
2. `docs/DEVELOPMENT_AUTONOMY_LADDER.md`
3. `contracts/project-capsule.schema.json`
4. `contracts/change-packet.schema.json`
5. `contracts/proof-bundle.schema.json`

## Near-term integration direction

Prefer extending existing handoff and verification machinery instead of creating parallel systems.

- Existing Work Packet / Plan Slice should be extended toward the Change Packet fields rather than replaced wholesale.
- Existing WORK_RESULT should evolve toward Proof Bundle semantics rather than adding another competing result format.
- DevCenter registry remains the capability/source pointer system; Project Capsule is a revision-bound read cache, not a replacement SSOT.
- Codebase Twin remains future work until Project Capsule + Change Compiler + Proof Bundle show measurable reduction in repeated context and rework.

## Shadow-pilot target

Use one non-production project change with a clear visual/functional acceptance condition.

Compare prior workflow vs candidate workflow on:
- clarification questions;
- repeated repo-orientation steps;
- files touched;
- rework loops;
- intent-to-preview time;
- verification completeness;
- false PASS/regression;
- user first-pass acceptance.

Do not claim improvement without baseline and candidate observations.
