# L3 — Core Contract Standard

## Mission
Define the system-to-system language of AI Core.

## Scope
### Canonical identity/data
- stable IDs and correlation IDs
- entity naming
- timestamps/timezones
- money/currency/decimal semantics
- nullable/unknown/not-applicable semantics
- status and reason codes
- provenance and source revision

### API
- request/response envelope
- pagination/filter/sort
- idempotency keys
- optimistic concurrency
- partial failure
- error contract
- compatibility/version negotiation

### Event
- event ID/type/version
- subject/entity reference
- occurred/observed timestamps
- actor/authority
- correlation/causation
- replay/deduplication
- schema evolution

### Adapter
- canonical-in / provider-out boundary
- mapping validation
- capability declaration
- retry/timeouts
- provider error normalization
- raw payload retention policy
- read/write separation

## Existing assets to reconcile
- `contracts/*.schema.json`
- `registry/capabilities.json`
- `registry/work-map.json`
- `src/integration/*`
- project learning files for Admin/Sales/Self Quote/AIOps

## Required artifacts
- canonical contract index
- schema/version policy
- API envelope schema
- event envelope schema
- adapter interface contract
- error taxonomy
- contract-test fixtures

## Definition of done
A new project/provider can be integrated by writing an adapter against versioned canonical contracts without adding provider-specific fields to the core domain model.
