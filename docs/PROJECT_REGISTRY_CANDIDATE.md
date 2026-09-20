# Project Registry Candidate Compiler v1.1

A Project Capsule contains observed technical facts. Project Registry v1.1 additionally separates repository authority/lifecycle from runtime execution readiness.

The compiler combines an exact-revision Capsule with explicit project declarations and returns a review packet. It never writes the Registry.

## Hard boundary

Every new candidate is emitted as:
- `repository_lifecycle_status = HOLD`
- `execution_readiness_status = HOLD`
- `activation_allowed = false`

A caller may separately request desired lifecycle and execution states for review, but the compiler never grants either. Existing entries are emitted as `UPDATE_REVIEW` and preserve both existing axes as evidence.

Intended flow:

`core.project-inspect → Project Capsule → Registry Candidate v1.1 → reviewed registry mutation`

Run:

```bash
node --check src/engine/project-registry-candidate.mjs
node --test test/project-registry-candidate.test.mjs
```
