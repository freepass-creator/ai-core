# Project Registry Candidate Compiler v1

AI Core already has `core.project-inspect` and `ai-core-project-capsule/v1`, but a Capsule alone is not enough to safely mutate `registry/projects.json`.

A Capsule owns observed technical facts: repository/ref/revision, commands, framework, delivery candidates, evidence and technical blockers. The Project Registry additionally owns human/project declarations such as mission, organization, operating checkout, approvals and canonical status.

`src/engine/project-registry-candidate.mjs` combines a revision-bound Capsule with an explicit project profile and returns an `ai-core-project-registry-candidate/v1` review packet.

## Hard boundary

The compiler **always emits `candidate.status = HOLD`** and `activation_allowed=false`, even when the caller asks for ACTIVE and the Capsule is ready. It never writes the Registry.

Existing entries are emitted as `UPDATE_REVIEW`, never silently overwritten.

## Intended flow

`core.project-inspect -> Project Capsule -> Registry Candidate -> reviewed registry mutation`

Only the final step may change the canonical Registry and remains separately authorized and revision-checked.

This PR intentionally does not modify `registry/projects.json`, `registry/capabilities.json`, or `registry-refresh`.

## Verification

```bash
node --check src/engine/project-registry-candidate.mjs
node --test test/project-registry-candidate.test.mjs
```
