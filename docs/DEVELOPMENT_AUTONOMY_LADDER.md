# Development Autonomy Ladder v0.1

Status: RESEARCH_CANDIDATE

## Goal

Move development effort away from repeatedly explaining repositories, locating files, choosing tools, and manually checking completion. The user should mostly express intent and review consequential decisions or visible outcomes; AI should absorb the implementation complexity while preserving evidence, reversibility, and user control.

## Ladder

### L0 — Prompted Coding
User supplies paths, commands, implementation details, and validation instructions.

### L1 — Context-Aware Development
AI resolves the project and loads a revision-bound Project Capsule. Repeated repo orientation is reduced.

### L2 — Intent-Native Development
AI compiles natural-language intent into a Change Packet with acceptance criteria, non-goals, affected surfaces, unanswered high-value questions, and test obligations.

### L3 — Impact-Aware Execution
AI uses repo search / Codebase Twin candidates to estimate blast radius, find reusable assets, choose an executor, and work in an isolated branch/worktree or equivalent safe environment.

### L4 — Proof-Driven Delivery
AI returns a Proof Bundle bound to the exact subject revision. "Done" means required checks were actually run and remaining unknowns are explicit. Preview evidence is included when the change is visual or interactive.

### L5 — Supervised Development Autopilot
AI can maintain multiple active changes, detect branch/file conflicts, propose sequencing, monitor CI/preview health, and prepare release/rollback plans. Production deployment, permission changes, destructive actions, and other gated actions still follow explicit authority boundaries.

### L6 — Self-Improving Development System
The system compares actual development outcomes across task signatures: elapsed time, rework, first-pass success, false PASS, context rereads, regression, rollback, and post-release defects. It proposes routing/process/tool changes through shadow tests and evidence gates rather than silently changing operating policy.

## Core rule

Autonomy increases only when observability and reversibility increase with it.

More automation without stronger evidence is not higher maturity.

## First implementation target

Do not jump directly to L5/L6. Validate the L1-L4 spine first:

1. Project Capsule
2. Change Compiler
3. Impact/Reuse hints
4. Proof Bundle
5. Preview/verification obligations

Use one real non-production project change as a shadow pilot and compare against the prior workflow.

## Success metrics

- fewer user clarification questions;
- less repeated repository orientation;
- fewer unnecessary file touches;
- lower rework count;
- higher first-pass acceptance;
- no increase in false PASS or regression;
- shorter intent-to-preview time;
- complete proof attached to the exact revision;
- rollback/recovery path available when required.
