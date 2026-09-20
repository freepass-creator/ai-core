# Project Audit Handoff — aiops

Status: **READY**

## Revision binding

- repository: `freepass-creator/aiops`
- branch: `main`
- subject revision: `03dd804962eb4e345b7a34b3e0e97e8bc6d5efe3`
- AI Core standard baseline: `d995d30e9b830894d53349c2196707bfbd1b6ad0`
- CI: `UNKNOWN` — no exact-head Actions run at the audited revision
- branch protection: `false`
- live freshness at handoff creation: `CURRENT`

## Project implementation

### workflow — P1

Standard owner: **D / Workflow Standard**

Choose one bounded AIOps lifecycle and add D SHADOW parity while preserving current operational runtime authority.

Gaps:
- strong local workflow semantics are not revision-bound to a canonical D state machine
- scheduler runtime state remains external observation

### security-audit — P1

Standard owner: **SECURITY / Security-Audit Standard**

Refresh the existing Security SHADOW to the current canonical partial baseline and re-observe exact-main CI without weakening the existing AIOps approval model.

Gaps:
- SHADOW pins an earlier Security candidate
- exact-head CI absent
- `lib/seungin.mjs` correctly remains runtime authority

### qa-observability — P1

Standard owner: **QA / QA-Observability Standard**

Create one verification manifest/entrypoint that includes penalty, finance, security and insurance suites. Add main-push coverage for the Insurance adapter and keep production health separate from repository CI.

Gaps:
- no unified checker manifest
- default `npm test` omits important focused suites
- Insurance workflow has no main push trigger
- scheduler/production health remains external

### build-deploy-governance — P1

Standard owner: **GOVERNANCE / Build-Deploy-Governance Standard**

Unify required verification, add main-push coverage for Insurance, stabilize required checks, then add branch protection. Do not infer Windows scheduler health from GitHub.

Gaps:
- exact-head Actions absent
- verification fragmented
- main branch protection disabled
- live scheduler/runtime state external

## Discovery

### ui-ux — P2

Standard owner: **B / Global UI/UX Standard**

Audit a concrete AIOps UI only when an active product surface becomes material. Do not invent UI conformance for CLI-only workflows.

## No-project-action axes

- data-ssot — CORE_MATCH
- engine-adapter — CORE_MATCH
- api-event-error — CORE_MATCH

## Execution boundary

- no automatic project write
- no automatic project PR
- no automatic Core promotion
- no deployment
- no production mutation
