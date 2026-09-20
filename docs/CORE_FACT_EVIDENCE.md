# Core Fact Evidence v1

Status: **C SESSION CANONICAL CANDIDATE / PROJECT_VERIFIED PILOT**

## Purpose

AI Core must distinguish a fact that was directly observed from one that was inferred from other verified facts or derived by transformation. Without this distinction, a valid workflow shortcut can accidentally manufacture stronger completion evidence.

## Contract

- schema: `contracts/core-fact-evidence.schema.json`
- helper: `src/contracts/fact-evidence.mjs`
- registry id: `core.fact-evidence.v1`

`assertion_kind` is one of:

- `OBSERVED` — direct source evidence exists;
- `INFERRED` — a declared rule infers this fact from basis facts;
- `DERIVED` — deterministic/non-direct transformation from source evidence.

An `INFERRED` assertion must include `inference.rule_ref` and `inference.basis_fact_refs`. `OBSERVED` and `DERIVED` assertions may not carry an inference payload.

## Safety boundary

An inferred assertion does not become direct observation merely because its logical inference is valid. A consumer that requires `OBSERVED` evidence must reject `INFERRED` evidence.

C owns this evidence envelope. D owns whether a workflow transition requires an inferred prerequisite, which rule is applicable, and which stronger workflow/completion facts remain forbidden.

## Source evidence

Reverse-imported from the FreePass Sales forward-skip pattern and D's adopted workflow progression primitive:

- `freepass-creator/freepass-sales@2ec46bb2e88b10a31915b68ec77b2eecbdac57bd`
- AI Core `workflow.forward-skip-evidence-integrity` D decision / workflow progression contract

Sales proves the concrete failure mode: progressing to agreement can logically imply that a quote was presented, while it must not fabricate evidence that the quote was sent through a specific channel.

Evidence maturity remains **PROJECT_VERIFIED** until another independent project proves the same generic fact-evidence distinction.
