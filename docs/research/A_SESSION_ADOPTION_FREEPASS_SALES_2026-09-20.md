# A Session Adoption — FreePass Sales

상태: **POST-PHASE-1 REPO ADOPTION / VERIFIED MAIN / NO PRODUCTION CUTOVER CLAIM**

관측일: 2026-09-20 KST

## 1. Order flow

AI Core Phase 1 is `BASELINE_LOCKED`.

This repository was processed using the Order post-lock flow:

`repo preflight → current revision evidence → compare to AI Core → reverse-import/migrate gap → verify → record adoption`

First target:
`freepass-creator/freepass-sales`

## 2. Baseline

### Before adoption

- Sales main: `fe69f76d81f4b9acd6f67f7b3f4ef5619f5e33d1`
- several independent/stale adoption PRs existed:
  - #16 cross-platform browser CI
  - #18 C customer search adapter
  - #19 old AI Core UI pointer
  - #20 B consumer mapping
  - #21 C promotion receipt shadow
- #18/#20 failed Sales browser CI because they were based on old Sales UI/test expectations rather than the current v260 product tree.

The failures were not treated as proof that the AI Core contracts were wrong.

## 3. Product baseline first

Sales v260 PR #17 was inspected and retained as the product authority.

A added only one missing operational guard from #16:
- run Sales CI on `push: main` as well as pull requests.

Updated #17 head:
`16256c181b0574b73e85f7b9b25f464f025accff`

Exact-head evidence:
- Sales CI `35480393064` — SUCCESS
- Security Rules CI `35480393067` — SUCCESS

#17 merged:
`4fae22949afe6d040d3bbfb770bad5a3976f6f88`

No Firebase deploy action exists in this merge path.

## 4. Consolidated AI Core adoption

Instead of merging stale adoption PRs independently, A rebuilt their reusable intent on top of the verified v260 tree.

Integrated PR:
- FreePass Sales #22
- title: `AI Core adoption: Sales v260 B mapping + C shadow contracts`
- exact head before merge: `bc4ecf5efe07ab434ad3b204de7777fa04115d61`
- merged Sales main: `2ec46bb2e88b10a31915b68ec77b2eecbdac57bd`

Old PRs #16/#18/#19/#20/#21 were closed as superseded by #22.

## 5. B adoption

Added:
- `.ai-core/ui-ux.consumer.json`
- `scripts/check-ai-core-uiux-consumer.mjs`
- `AI_CORE_UI.md`
- local B binding in `docs/UI-STANDARD.md`

Binding:
- AI Core B canonical revision:
  `0ca3140d17daf4d51df0fbc2010c4130ec3bb20d`
- Feature Registry:
  `1.3.0`

Current claim:
**MAPPED**

Not claimed:
- PILOT
- CONFORMANT

Pending:
- multi-locale probes
- IME composition
- complete 412/1440 rendered evidence
- revision-bound B4 conformance receipt

Product-owned behavior remains product-owned:
- Sales brand
- menu/domain labels
- business priority
- product density
- operational deployment.

## 6. C customer-search adapter

Added:
- `lib/ai-core-sales-adapters.mjs`
- `scripts/ai-core-customer-search.py`
- Node/Python contract tests

Boundary:
- exact full phone lookup only
- exact customer-name equality query only
- max 5 results
- no partial phone search
- no whole-customer dump
- phone is masked in output
- notes/address/email/call-record raw data are omitted
- source failure is HOLD, never false empty-success
- adapter has no external write effect

This reuses Sales Firestore as the project authority; AI Core does not become the customer-data owner.

## 7. C receipt SHADOW

Added:
- `웹/core-contract-shadow.js`
- `검토/core-contract-shadow.test.mjs`

Existing Sales facts are projected to `core-receipt/v1`:

- SMS app opened → `LAUNCHED`
- employee confirms actual send → `BUSINESS_CONFIRMED`
- Firestore send-record commit → `SERVER_COMMITTED`

Result:
- launch only → `HOLD / AWAITING_BUSINESS_CONFIRMATION`
- business confirmed + server committed → `SUCCEEDED`
- business confirmed + server record failure → `PARTIAL / SERVER_RECORD_FAILED`

Impossible evidence combinations fail closed.

Receipt excludes customer identifiers and message body.

Current claim:
**SHADOW**

No runtime receipt persistence/cutover is claimed.

## 8. Verification

PR #22 exact-head:

- Sales CI `35480614165` — SUCCESS
- Security Rules CI `35480614042` — SUCCESS

New AI Core adoption checks:
- `npm run uiux:map` — PASS
- `npm run test:ai-core-customer-search` — PASS
- `npm run test:core-contract-shadow` — PASS

Existing product checks:
- syntax/static — PASS
- browser regression — PASS
- mobile capture — PASS
- Firestore/Storage rules emulator — PASS

Resulting main:
- revision: `2ec46bb2e88b10a31915b68ec77b2eecbdac57bd`
- push workflow: Sales CI `35480676884`
- conclusion: **SUCCESS**

## 9. Project > Core feedback

No new candidate is promoted from this adoption pass.

Existing Sales evidence remains useful for:
- repository idempotency
- launch vs verified completion
- hold/resume

The adoption work primarily moves **Core → Project** common contracts into a real product without overriding product SSOT.

## 10. Remaining migration / HOLD

### B
MAPPED → PILOT/CONFORMANT remains pending until the full B conformance matrix and immutable receipt are produced.

### C
Promotion receipt remains SHADOW until actual runtime receipt persistence/retrieval is bound and verified.

### Deployment
Production deployment and served revision were not changed or verified by this work.

Do not describe merge/CI success as production activation.

## 11. A decision

FreePass Sales is now the first post-Phase-1 repository with a verified AI Core adoption layer on main.

A next step:
- route adoption evidence to B/C owners for their canonical adoption registries if desired;
- proceed to the next Order queue repository rather than broadening Sales scope unnecessarily.
