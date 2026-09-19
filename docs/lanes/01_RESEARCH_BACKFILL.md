# L1 — Research / Repository Backfill

## Mission
Inspect existing repositories and external standards to find proven patterns that AI Core should learn, while also identifying places where AI Core is already ahead.

## Inputs
- `registry/projects.json`
- `docs/coordination/*_LEARNING.md`
- repository source at pinned revisions
- relevant international/industry standards when material

## Required output per target
1. current capability/standard observed;
2. evidence path + revision;
3. AI Core current equivalent;
4. delta: `CORE_AHEAD / PEER / PROJECT_AHEAD / INCOMPARABLE`;
5. reusable primitive;
6. project-specific part that must stay local;
7. candidate destination: UI/UX, contract, workflow, security, quality or governance;
8. verification proposal.

## Guardrails
- do not copy an entire project pattern into common core;
- do not treat popularity as proof;
- do not promote research without a target consumer;
- keep dated audit findings separate from current SSOT.

## Definition of done
A reviewed repository either contributes a bounded candidate to another lane or is explicitly recorded as having no reusable delta.
