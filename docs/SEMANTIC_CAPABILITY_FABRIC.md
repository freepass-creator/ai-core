# Semantic Capability Fabric v0.1

Status: RESEARCH_CANDIDATE / DESIGN

## Why this research exists

The current development system is getting better at intent, continuity, Engine/Port/Adapter separation, and proof. A major gap remains between **finding code** and **knowing what can safely be reused**.

DevCenter already has a static function warehouse. Its own documentation explicitly warns that a function declaration count is not a count of independent business capabilities or verified behavior, and its improvement log says input/output business meaning, units, empty-value behavior, errors, permissions, side effects, aliases, dynamic calls, and consumer relationships are still incomplete for most collected declarations.

That means a larger symbol index or a giant Codebase Twin alone will not solve reuse. It may make search faster while still leaving the AI unable to answer the important question:

> "Does this thing mean the same thing, under the same conditions, with enough evidence that I can reuse it here?"

This research introduces a semantic layer between raw code discovery and execution.

## Central idea

Do not promote every function/module into a reusable capability.

Use an abstraction ladder:

```text
Raw Symbol / File
  ↓
Candidate Cluster
  ↓
Semantic Capability Cell
  ↓
Capability Graph
  ↓
Capability Resolver
  ↓
Reuse / Adapt / Compose / Extend / Build New / HOLD
```

The **Capability Cell** is the smallest reusable development unit that has enough declared meaning and evidence to be reasoned about across projects.

It is not a copy of the implementation. It is a revision-bound contract plus pointers to the implementation and evidence.

## What a Capability Cell must know

At minimum:

- stable capability id;
- kind: Engine / Port / Adapter / Connector / Component / Validator / Generator / Test Utility / Workflow;
- purpose and semantic key;
- scope: LOCAL / DOMAIN / UNIVERSAL_CANDIDATE / UNIVERSAL;
- source and implementation revision(s);
- inputs and outputs, including units/nullability where meaningful;
- invariants and state assumptions;
- declared errors/failure modes;
- side-effect class;
- compatibility/runtime constraints;
- dependencies and implemented Port(s);
- evidence state and evidence references;
- known unknowns;
- provenance of semantic statements: USER_CONFIRMED / SOURCE_DERIVED / AI_INFERRED.

AI-inferred semantics must not silently become adopted truth.

## Lifecycle

Recommended capability lifecycle:

```text
DISCOVERED
  ↓
DESCRIBED
  ↓
CONTRACTED
  ↓
EXECUTION_VERIFIED
  ↓
INDEPENDENTLY_VERIFIED
  ↓
ADOPTED_WITHIN_SCOPE
  ↓
OUTCOME_OBSERVED
```

Side exits:

```text
HOLD / DEPRECATED / SUPERSEDED / REJECTED
```

`DISCOVERED` means "we found code". It does **not** mean "we know what it does".

`DESCRIBED` can contain AI hypotheses but they must retain provenance.

`CONTRACTED` means inputs/outputs/invariants/errors/side effects are explicit enough to test.

`EXECUTION_VERIFIED` requires actual execution evidence bound to a revision.

`ADOPTED_WITHIN_SCOPE` is not UNIVERSAL. Cross-project promotion still needs Transfer Gate evidence.

## Capability Graph

The Capability Graph is a high-level semantic graph, not a complete file graph.

Useful edge types:

- IMPLEMENTS_PORT
- DEPENDS_ON
- WRAPS_CONNECTOR
- COMPOSES
- TESTED_BY
- USED_BY_PROJECT
- SUPERSEDES
- COMPATIBLE_WITH
- CONFLICTS_WITH

This graph should be much smaller and more useful for planning than a graph containing every function and import.

### Key architectural recommendation

Build the **semantic capability graph before a full Codebase Twin**.

Use the full code graph only on demand when implementation impact needs deeper analysis.

This avoids turning 100k+ symbols into permanent context while preserving a path to exact file-level impact analysis.

## Capability Resolver

A Change Packet should compile part of the user request into a Capability Query.

The resolver asks:

1. Is there an existing capability with the same semantic purpose?
2. Is its scope compatible with this project?
3. Are the input/output semantics compatible?
4. Are invariants and state assumptions compatible?
5. Are side effects acceptable?
6. Is evidence strong and fresh enough?
7. Does an Adapter solve only a shape/provider mismatch without changing business meaning?
8. Can multiple capabilities be composed without creating conflicting invariants?

Resolver outcomes:

- `REUSE_EXACT`
- `REUSE_WITH_ADAPTER`
- `COMPOSE`
- `EXTEND_CANDIDATE`
- `NEW_REQUIRED`
- `HOLD_SEMANTICS_UNKNOWN`
- `HOLD_EVIDENCE_INSUFFICIENT`
- `HOLD_SIDE_EFFECT_MISMATCH`
- `HOLD_COMPATIBILITY_UNKNOWN`

The resolver must never choose reuse only because names look similar.

## Adapter Forge — later layer

When semantic meaning matches but representation/provider differs, an Adapter can be synthesized as a candidate.

The proposed Adapter must explicitly cover:

- field mapping;
- unit conversion;
- null/empty semantics;
- enum/state mapping;
- error mapping;
- timeout/retry behavior;
- auth/permission boundary;
- data classification;
- idempotency for side effects;
- health check;
- source/target contract revisions.

For mappings that are intended to preserve meaning, verification should use golden cases, round-trip checks where meaningful, or mock-vs-provider semantic equivalence tests.

AI-generated Adapter code is a candidate, not an automatically trusted integration.

## Development becomes compilation

With Development Runtime + Requirement Continuity + Engine/Adapter contracts + Capability Fabric, the workflow becomes:

```text
Human Intent
  ↓
Living Requirement Graph
  ↓
Change Packet
  ↓
Capability Query
  ↓
Capability Resolver
  ├─ reuse exact
  ├─ adapt
  ├─ compose
  ├─ extend
  └─ build new
  ↓
Minimal implementation delta
  ↓
Proof Bundle
  ↓
Preview / Release Gate
  ↓
Outcome / Learning
```

The long-term goal is not "AI writes more code". It is:

> **AI writes only the delta that the existing capability system cannot already satisfy.**

That is a much more scalable development civilization.

## Relationship to DevCenter

DevCenter remains the likely owner of adopted development capabilities, standards, verification profiles, and reusable assets.

AI Core should:

- compile intent;
- resolve capability needs;
- query DevCenter;
- route execution;
- bind proof to the current requirement/revision;
- learn from outcomes.

DevCenter should not receive copied project business SSOT. Capability Cells point back to owner sources and revisions.

## Migration path from the current function warehouse

Do not attempt to semantically classify all collected functions.

Start demand-first:

1. A real Change Packet requests a capability.
2. Search the existing static catalog and repository for candidates.
3. Promote only the few relevant candidates to semantic review.
4. Inspect source, consumers, tests, units/errors/side effects.
5. Create or update one Capability Cell.
6. Execute the contract tests.
7. Record proof and scope.
8. Reuse it on a second task/project before considering wider promotion.

This turns the static warehouse into a discovery substrate without creating a massive manual cataloging project.

## First Shadow Pilot

Pick one small, already-used function that is:

- deterministic or easy to fixture;
- used in more than one place or plausibly reusable;
- has clear input/output meaning;
- low risk;
- already has some execution examples/tests.

Compare:

A. old workflow: repository search → inspect → copy/rewrite → test;
B. Capability Fabric: query → resolve → reuse/adapt → proof.

Measure:

- search/orientation time;
- number of files opened;
- clarification count;
- duplicate implementation avoided;
- rework;
- false reuse attempts;
- proof completeness;
- second-use time.

## Non-goals

This research does not:

- claim every function is a capability;
- auto-promote AI descriptions to truth;
- replace project SSOT;
- automatically move DevCenter folders;
- automatically deploy generated adapters;
- treat static extraction as execution verification;
- require a giant graph before value can be tested.

## Research hypothesis

If the system indexes **meaning + contract + evidence**, not just files/functions, then the user's future development requests can increasingly be satisfied by resolving and composing known capabilities instead of repeatedly rediscovering and rewriting code.

The hypothesis is unverified until a real shadow pilot shows lower effort without increasing semantic mistakes or false PASS.