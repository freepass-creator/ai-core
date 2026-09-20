# A Session Delta Audit — 2026-09-20 01:12Z

Status: **RESEARCH ONLY / NO B-C-D CANONICAL CHANGE**

## Scope

Compare connected repository heads against the latest A-session machine evidence observed at `2026-09-20T00:56:35Z`. Inspect actual changed code, contracts/config, docs, tests, CI and available runtime/deployment evidence. This file records evidence and routing only; it does not edit B, C or D canonical standards.

AI Core comparison head observed during this audit: `3e17ce809dd16754a5ffc5d37759a9d782656ecd`.

## Head movement

Two non-self repositories moved after the stored A snapshot:

- `freepass-creator/freepass-sales`: `fe69f76d81f4b9acd6f67f7b3f4ef5619f5e33d1` -> `2ec46bb2e88b10a31915b68ec77b2eecbdac57bd` (**158 commits ahead / 0 behind**).
- `freepass-creator/freepasserp4`: `3b98649ff49a24376aca4b24590c15d36b95a8f6` -> `f01b91c7f68fc2f55d8d642bc3d39f5e07368967` (**docs-only Audit80 ledger append**).

Therefore `a-session-head-snapshot.v1.json` is stale for these two repositories until the next exact-head machine refresh. This audit file is the revision-bound delta evidence and must be considered before treating the old snapshot as a no-change proof.

---

# Delta A — FreePass Sales

## Revision evidence

- baseline: `fe69f76d81f4b9acd6f67f7b3f4ef5619f5e33d1`
- intermediate feature merge: `4fae22949afe6d040d3bbfb770bad5a3976f6f88`
- observed head: `2ec46bb2e88b10a31915b68ec77b2eecbdac57bd`
- exact-head Sales CI: run `35480676884` — **success**
- exact-head CI steps include UI/UX mapping, AI Core customer-search adapter, AI Core receipt shadow, browser regression, mobile capture and artifact upload.
- exact-head mobile capture artifact: `sales-mobile-capture`, digest `sha256:af15b6a1d77a9e29122662a1187e188ff1c95c6cb891f8c5ad4531dcb86c2504`.
- no production deployment/runtime receipt evidence was observed for the new B/C adoption in this audit.

Material implementation surfaces include:

- `웹/pipeline.js`
- `검토/pipeline검증.mjs`
- `검토/pipeline시뮬레이션.mjs`
- `.ai-core/ui-ux.consumer.json`
- `AI_CORE_UI.md`
- `docs/AI_CORE_CONTRACT_ADOPTION_2026-09-20.md`
- `lib/ai-core-sales-adapters.mjs`
- `scripts/ai-core-customer-search.py`
- `웹/core-contract-shadow.js`
- `검토/core-contract-shadow.test.mjs`
- `.github/workflows/ci.yml`

## Finding A1 — monotonic forward skip with evidence integrity

### Classification: **Project > Core**

Sales now implements and tests a useful workflow rule that is more specific than the current shared D rules:

1. transient contact outcome and durable business progress are separate axes;
2. later contact failure does not regress already proven progress;
3. backward progress transitions are rejected;
4. a user may move forward over intermediate milestones when the later business fact is valid;
5. skipped milestones do **not** receive fabricated completion timestamps merely to make the sequence look complete;
6. when the later fact logically implies a prerequisite, Sales writes an explicit inferred/provenance fact and reason instead of pretending the skipped action was independently observed;
7. next-action and reporting derive from the same pipeline SSOT.

Concrete example: `관심있음 -> 진행동의` may skip the UI milestone `견적 보냄`; the transition records that quote presentation was logically implied by consent, but distinguishes presentation from an actual quote-send event. The tests also prove backward movement is rejected and that a later `안 받음` does not move the sales funnel backward.

AI Core D already has facts-vs-state, orthogonal axes and derived projection rules. The new candidate is narrower: **forward-skip evidence integrity + explicit inferred prerequisite provenance**. No equivalent reusable `forward-skip` / inferred-prerequisite contract was found in the current Core.

Generalized candidate id: `workflow.forward-skip-evidence-integrity`.

Route:

- **D primary** — transition semantics, monotonicity, skip/guard rules.
- **C secondary** — typed provenance/evidence representation for inferred prerequisite facts.

Promotion status: **PROJECT_VERIFIED / ROUTE ONLY**. A does not edit D or C canon. A second independent project is still desirable before company-wide promotion.

## Finding A2 — B consumer mapping is implemented but not conformant

### Classification: **Core > Project**

Sales now has an explicit `ai-core-ui-ux-consumer/v1` mapping pinned to AI Core B revision `0ca3140d17daf4d51df0fbc2010c4130ec3bb20d`. Exact-head CI runs the mapping and browser suite successfully. This is a real evidence-level improvement from the prior Sales state.

However the project itself declares `adoption_status: MAPPED`, has no B conformance receipts, and lists pending evidence for:

- `en-US` / `de-DE` / `ar-SA` localization probes;
- IME composition browser receipt;
- revision-bound B4 conformance receipt;
- full 412 / 1440 rendered evidence.

Migration/backport gap id: `ui.freepass-sales-b-conformance`.

Breaking/operational impact if `MAPPED` is misreported as `PILOT/CONFORMANT`:

- localization, RTL, IME and input-modality behavior can be claimed without evidence;
- responsive conformance can be overstated outside the rendered matrix;
- evidence can drift from the pinned B revision without a revision-bound receipt;
- downstream projects may copy a product mapping as if it were B canonical conformance.

Verification needed:

1. retain exact-head green CI for the consumer mapping;
2. produce a revision-bound B4 conformance receipt;
3. complete required locale/RTL/IME probes;
4. retain full rendered evidence for the declared viewport matrix;
5. bind any production-conformance claim to an exact released revision.

Route: **B migration/adoption verification**. No B canonical edit from A.

## Finding A3 — C Sales adapters/receipt remain SHADOW runtime

### Classification: **Core > Project**

Sales now has code and tests for two C-facing surfaces:

- fail-closed, data-minimized customer lookup against Sales Firestore;
- promotion receipt projection separating `LAUNCHED`, `BUSINESS_CONFIRMED` and `SERVER_COMMITTED`.

The exact-head tests prove:

- launch-only -> `HOLD / AWAITING_BUSINESS_CONFIRMATION`;
- business-confirmed + server-committed -> `SUCCEEDED`;
- business-confirmed + server write failure -> `PARTIAL / SERVER_RECORD_FAILED`;
- impossible evidence combinations fail closed;
- the receipt excludes customer identifiers/message body;
- customer lookup rejects partial phone queries and turns source failure into HOLD rather than an empty successful result.

This is materially stronger than a design-only adoption. But the project adoption document still labels C **SHADOW / NON-BLOCKING**, and no production runtime receipt persistence/retrieval evidence was observed.

Migration/backport gap id: `core-contract.sales-shadow-runtime-binding`.

Breaking/operational impact if the SHADOW is promoted too early:

- opening the SMS app can be mistaken for business completion;
- a confirmed send followed by Firestore record failure can lose durable PARTIAL evidence;
- a read-source failure can be misrepresented as a legitimate empty customer result if callers bypass the adapter boundary;
- CI-verified projection semantics can be mistaken for production receipt durability.

Verification needed:

1. exact-head CI green — **observed** at run `35480676884`;
2. bind the customer-search adapter to the intended production read boundary and verify fail-closed behavior there;
3. persist and retrieve real promotion receipts at runtime;
4. verify HOLD/PARTIAL/SUCCEEDED behavior with controlled or production evidence;
5. verify receipt retention and sensitive-data exclusion;
6. bind the runtime evidence to an exact deployed Sales revision before promotion beyond SHADOW.

Route: **C migration/adoption verification**. No C canonical edit from A.

## Different / project-owned portions

Sales funnel labels, partner-report wording, contact-attempt presentation and product-specific next-action text remain **Different / project-owned domain behavior**. They are not automatically promoted into AI Core because they encode the FreePass Sales business process rather than a reusable platform primitive.

---

# Delta B — ERP4 / ERP5 audit ledger

Observed head: `f01b91c7f68fc2f55d8d642bc3d39f5e07368967`.

### Classification: **Core > Project — existing gap unchanged**

This head advances only `docs/AI-SSOT-AUDIT-LOG.md`. It appends the already-discovered Audit80 main-push path asymmetry for the AI Core shadow surfaces and fixes a historical SHA typo. It does not modify application code or business logic.

Therefore:

- `governance.erp5-shadow-main-push-path` remains open;
- `core-contract.erp5-receipt-enforcement` remains open;
- `audit.metadata-consistency-validator` remains open;
- there is **no new Project > Core candidate** from this ERP4 delta;
- the new head should be added as DOC evidence when the A machine registries refresh.

---

# Routing summary

New material routes from this audit:

- `workflow.forward-skip-evidence-integrity` -> **D primary / C secondary** — Project > Core.
- `ui.freepass-sales-b-conformance` -> **B** — Core > Project migration/backport.
- `core-contract.sales-shadow-runtime-binding` -> **C** — Core > Project migration/backport.

No B/C/D canonical standard is modified by this audit.

# Machine-baseline follow-up

The A exact-head snapshot/coverage registry must be refreshed to at least:

- `freepass-sales = 2ec46bb2e88b10a31915b68ec77b2eecbdac57bd`
- `freepasserp4 = f01b91c7f68fc2f55d8d642bc3d39f5e07368967`

A future no-change scan must not notify again on these same revisions unless receiver decisions, production/deployment/runtime evidence, migration state or repository heads change.
