# A-session Repo Audit — 2026-09-21T0705Z

## Scope and authority boundary

This record is **A-session evidence only**. It records observed project revisions, evidence-level changes, candidate routing, and migration/backport gaps. It does **not** change or promote any B/C/D canonical standard.

- Previous A evidence revision: `acd6b3c014eee698db8fef6f73f6a5052b4556df`
- Canonical AI Core comparison revision: `ac8c502358c17613a712c9c7e1ab780f51f1eb97`
- Observation window: 2026-09-21 16:05 KST / 07:05Z

## Repository revision observations

| Repository | Previous observed revision | Current observed revision | Material delta |
| --- | --- | --- | --- |
| `freepass-creator/ai-core` | `acd6b3c014eee698db8fef6f73f6a5052b4556df` | `acd6b3c014eee698db8fef6f73f6a5052b4556df` before this evidence commit | No source revision change; prior exact-head CI reached terminal failure |
| `freepass-creator/freepass-sales` | `c56074765c3dbbb4e4044d041e9a5d085ee17b23` | `964a9799c5a3b0ca821a02e17f920e36d2e509f0` | Product-local help copy + service-worker cache bump; exact-head CI green |
| `freepass-creator/freepasserp4` | `ca537fd388fe60cc9b2e07069d6c0d7198221d12` | `562ff11a547562b90298af6517938220855f8650` | Recovery evidence, transient ERP5 engine repin/revert, audit docs, source-contract gate evidence |
| `freepass-creator/freepass-estimate` | `6d575af8d00ef43835fdbcd0cd0c1f5e26ae9140` | `a8fe8bd6c711aa341d75dd162e6a8ab29edf1367` | Two-commit feature+revert pair; net tree delta empty |
| `freepass-creator/freepass-data` | `fea18ce185399d057682509166e32ee21435651c` | unchanged | none |
| `freepass-creator/devcenter` | `41fcdd625480a6725e159852f43aa59b5e6f8516` | unchanged | none |
| `freepass-creator/freepass-admin` | `02deb4dd8f83a95b5e43f3a7d5b2b3ab324adebd` | unchanged | none |
| `freepass-creator/aiops` | `03dd804962eb4e345b7a34b3e0e97e8bc6d5efe3` | unchanged | none |

## Findings

### A11-01 — AI Core exact-head evidence closed red

**Classification:** `Different / evidence-level change`

The previous A evidence revision `acd6b3c014eee698db8fef6f73f6a5052b4556df` was previously observed while its `Main State Consistency` run was still in progress. Run `35568682236` is now terminal `failure`.

The runner entered normally: checkout, Node setup, and `npm ci` completed. `npm test` then failed; subsequent main-state, registry, evidence, contracts, workflow, and UI/UX validators were skipped. The test run reported 888 tests, 787 passed, 100 failed, 1 skipped.

Representative failure families include project/capability registry invalidity, stale project revision expectations, order/work integration tests moving from READY/LINKED into HOLD, project-audit maturity drift, UI/UX runtime probe-count drift, and `verify-main-state` successor-episode changed-file mismatch.

**Evidence implication:** this is an actual test-state failure, not a runner-entry failure. The A evidence revision must not be treated as exact-head CI verified.

**Action:** repair the AI Core registry/test-state coherently, then require a fresh exact-head green `Main State Consistency` run before evidence promotion.

### A11-02 — ERP4 15:05 recovery completed full green, but recovery timing/reconciliation gap remains

**Classification:** `Core > Project → D` (existing gap, evidence improved but still open)

The 15:05 KST native settlement trigger was absent and fallback recovery was dispatched at approximately 15:34:12 KST, about 29 minutes after the logical slot and outside the configured 20-minute grace window. The recovered settlement run `35569056120` succeeded and downstream ERP5 run `35569097238` completed terminal `success`.

The downstream ERP5 run executed the validated engine `c3838708b84527db241f1985c140a3ec6ece6bff` and completed source contract, recrawl, ledger lock, atom calculation, Core receipt shadow, snapshot, public catalog, sales sheet, F86 publication, freshness, Atom↔F01↔F86 parity, and plate/photo audit successfully. Manual Sonogong registration remained skipped/default-off.

Persistent evidence is still contradictory after terminal success:

- `.automation/heartbeats/settlement-intake-sync.txt` now records the 15:05 settlement and ERP5 runs as success.
- `.automation/safe-chain-monitor.json` still records ERP5 run `35569097238` as `in-progress`, keeps `lastKnownGoodErp5RunId=35566458884`, and `needsFollowup=true`.

This leaves two Core D gaps open:

1. **Recovery timing:** due logical slots must be recovered within the declared grace/SLO rather than eventually.
2. **Authoritative terminal reconciliation:** persisted monitor state must converge idempotently to authoritative terminal workflow evidence before the next slot decision.

**Breaking impact:** stale monitor state can incorrectly suppress, delay, or duplicate later recovery decisions; late fallback can leave downstream publication stale beyond the declared recovery window.

**Verification needs:** reconcile the 15:05 terminal success into persisted state; prove no replay after success; prove the next missed native slot is recovered once within grace; test delayed/out-of-order workflow evidence, restart, and concurrent monitor writers.

### A11-03 — ERP4 Sonogong classification repin was not proven and was reverted; current audit entrypoint is stale

**Classification:** `Different / stale-revision contradiction`

PR #453 temporarily repinned ERP5 refresh to engine `0e0f486186d9a060378e6505a0a36a6a5ca1b621`. Its exact source-contract run `35571169079` failed pre-job with no executable jobs, and there was no production-equivalent full-green ERP5 refresh evidence on that pin.

PR #455 then restored `.github/workflows/erp5-ssot-refresh.yml` to the last validated engine `c3838708b84527db241f1985c140a3ec6ece6bff` at merge revision `025765424ef60a233474e447c4bb5b695ae1d376`.

However current `CLAUDE-AUDIT.md` at repository head `562ff11a547562b90298af6517938220855f8650` still describes the `0e0f486...` pin as the current production engine in the Audit 96 current-state section. That statement is now stale relative to executable workflow configuration.

**Action:** correct the audit/entrypoint document to bind current production engine evidence to `c3838708...`, while retaining `0e0f486...` only as an unverified/reverted attempt. Do not claim Sonogong classification production verification from PR #453.

### A11-04 — ERP4 dedicated Source Contract gate is currently non-executable/red

**Classification:** `Different / evidence-level change`

At current ERP4 head `562ff11a547562b90298af6517938220855f8650`, `SSOT Source Contract` run `35571313595` is terminal `failure` with no jobs instantiated. The workflow file still declares the source-registry/engine/policy contract job, but the current exact-head evidence gate did not enter execution.

**Evidence implication:** a green product CI or an earlier validated ERP5 runtime cannot be used as proof that the current source-contract workflow itself is healthy. Current semantic-source-contract evidence is weaker until the gate becomes executable again.

**Action:** repair/validate the workflow definition or trigger path that causes the pre-job failure, then rerun the source-contract gate at the exact current revision before any future engine repin or source semantic promotion.

The previously recorded `Core > Project → C` gap remains open: current-main `inventory-source-registry.ts` still exposes the older Sonogong RP012 registry shape while the validated production engine contains richer source-specific runtime semantics. The transient `0e0f486...` pin did not close that gap because it never obtained executable contract/full-green evidence and was reverted.

### A11-05 — FreePass Sales change is product-local and verified

**Classification:** `Different`

Sales advanced to `964a9799c5a3b0ca821a02e17f920e36d2e509f0`. The delta makes help copy explicitly distinguish `셀프견적기` from `FreePass 플랫폼`, updates static browser assertions, and bumps the service-worker cache version. Exact-head Sales CI run `35569366725` completed `success`.

This is a product-specific usage/help clarification, not a reusable Core B/C/D pattern. No new candidate is routed.

### A11-06 — FreePass Estimate transient feature/revert has no current semantic delta

**Classification:** `Different / net-zero transient`

Estimate advanced through feature revision `477ad46e072eecaa251513fb12970eef3c86a195` and immediate revert `a8fe8bd6c711aa341d75dd162e6a8ab29edf1367`. Comparing the pre-change baseline `6d575af8d00ef43835fdbcd0cd0c1f5e26ae9140` to current head yields no changed files. Neither transient head had exact-head Actions evidence.

No migration gap or Core candidate is created from a reverted, non-runtime-evidenced delta.

## Routing summary

- **B:** no new candidate.
- **C:** no new `Project > Core` candidate. Existing ERP4 `Core > Project` source-semantic parity gap remains open.
- **D:** no new `Project > Core` candidate. Existing ERP4 `Core > Project` recovery timing/reconciliation gap receives stronger runtime evidence and remains open.
- **B/C/D canonical files changed:** none.

## Promotion / notification decision

Notify because this observation contains meaningful evidence-level and stale-revision changes:

1. previous AI Core A evidence run is now terminal red at real `npm test`;
2. ERP4 15:05 downstream is full green, but fallback exceeded grace and persisted monitor state did not reconcile terminal success;
3. ERP4 attempted Sonogong classification engine pin was unverified and reverted while the current audit entrypoint still describes it as current;
4. the current ERP4 Source Contract workflow itself is terminal pre-job red.

No new B/C/D canonical standard is authorized by this record.
