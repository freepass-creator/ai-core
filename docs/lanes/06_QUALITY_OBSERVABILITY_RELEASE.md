# L6 — Quality / Observability / Release Standard

## Mission
Standardize proof that a change works and proof that a running system remains healthy.

## Scope
### Quality
- unit/integration/contract/e2e boundaries
- deterministic fixtures
- schema compatibility tests
- UI regression checks
- migration tests
- failure-path tests
- consumer conformance tests

### Observability
- structured logs
- metrics
- traces/correlation
- health/readiness
- business outcome receipts
- error budget / SLO where applicable
- alert ownership

### Release
- build artifact identity
- environment separation
- configuration validation
- CI required checks
- migration/deploy order
- canary/rollback where applicable
- release receipt
- post-release verification

## Reuse
- `docs/DEVELOPMENT_COVERAGE.md`
- `docs/CONCURRENT_WORK.md`
- checkpoint verifier
- existing evidence/receipt patterns

## Definition of done
Every common capability or contract has reproducible pre-merge checks and a defined runtime verification path; “green CI” is never confused with “successful production outcome”.
