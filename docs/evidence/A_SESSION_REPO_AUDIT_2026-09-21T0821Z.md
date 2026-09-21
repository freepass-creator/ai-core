# A-session repository audit — 2026-09-21T08:21Z

Status: **EVIDENCE ONLY**. This record does not modify B/C/D canonical standards.

## Baseline

- Previous A-session evidence revision: `768424b77c119afcb5e8bb80d2d6667e8fcfaef9`
- Canonical AI Core comparison revision: `ac8c502358c17613a712c9c7e1ab780f51f1eb97`
- Repositories with material new default-branch revisions since the previous evidence: `freepass-sales`, `freepasserp4`.
- No material default-branch revision change observed for FreePass Data, DevCenter, FreePass Admin, FreePass Estimate, or AIOps in this scan.

## 1. AI Core evidence-level change — exact-head consistency is terminal red

`Main State Consistency` run `35571869174` for previous A evidence revision `768424b...` is now terminal `failure`.

The runner entered normally; checkout, Node setup, and `npm ci` succeeded. `npm test` failed, and every later main-state / registry / A-evidence / contracts / workflow / UIUX validator was skipped.

Classification: **Different / evidence-level change**.

Action: do not treat `768424b...` as exact-head verified. Repair the Core test state before using a later A evidence commit as a green Core conformance proof.

## 2. ERP4 Project > Core — Evidence-Bound Narrow Mutation Envelope

ERP4 added an isolated `Sheet Contract 표시 전용` writer surface and runtime executor. The reusable pattern is not the spreadsheet formatting policy itself; it is the mutation safety envelope around a narrow external write.

Generalized pattern:

1. allowlist the target and operation mode;
2. produce a dry-run plan/diff with zero writes;
3. bind apply to the exact code revision plus a fresh, explicitly reviewed external-state snapshot hash/timestamp;
4. fail closed on concurrent drift and re-read immediately before apply;
5. constrain the executable request family to the owned mutation scope;
6. execute at most one mutation with no automatic retry;
7. read back and prove both the intended owned-field delta and invariance of non-owned state;
8. emit rollback requests, but require separate approval and a current post-state binding before rollback.

Evidence:

- workflow: `.github/workflows/sheet-formatting-only.yml`
- executor: `scripts/apply-sheet-contract.mts`
- F01 dry-run run `35573509757`: success after delegated-auth scope fix
- guarded apply-mode run `35573824838`: success with exact expected hash/revision/timestamp and readback, but `writes=0` because the target was already compliant
- `full` title/wrapping mode remains fail-closed while the reference audit is unavailable; F86 post-fix evidence was not established in the reviewed evidence.

Classification:

- **Project > Core → C candidate**: `Evidence-Bound Narrow Mutation Envelope` — reviewed live-state binding, owned-field mutation scope, non-owned-state preservation proof, and revision/snapshot-bound result evidence.
- **Project > Core → D candidate**: `DRY_RUN → REVIEWED_APPLY → PRE_APPLY_DRIFT_CHECK → SINGLE_MUTATION → READBACK → SEPARATELY_APPROVED_ROLLBACK`.

No B candidate is created from this change. B/C/D canonical files are unchanged.

Promotion gate: require at least one real non-zero mutation proving narrow write + readback, and separately validate guarded rollback against a current post-state hash. Keep `full` mode fail-closed until reference dependencies are verified.

## 3. ERP4 Core > Project — new Sheet Contract writer lacks Core request context

The new live-write workflow exposes target/apply/mode/expected snapshot hash/expected revision/expected timestamp, but it does not carry or project AI Core `core-request-context/v1` fields such as `request_id`, `correlation_id`, normalized Core `actor`, and semantic idempotency digest into the plan/receipt/evidence chain.

Classification: **Core > Project → C migration/backport gap**.

Breaking impact: replacing the current external workflow input shape outright could break manual/operator invocation and existing evidence tooling. The safe migration is an internal compatibility projection: retain the current workflow inputs, build Core request context internally, and propagate request/correlation/actor/expected_revision/idempotency evidence through plan, mutation receipt, readback and rollback artifacts.

Verification needs:

- exact actor provenance for manual dispatch;
- `request_id` and `correlation_id` propagation through every artifact;
- semantic payload digest covering target/mode/reviewed snapshot/revision;
- replay test proving a repeated request cannot create a duplicate live mutation;
- compatibility test proving existing workflow invocation still works.

## 4. ERP4 Core > Project D — 16:05 recovery escalated to a real downstream cancellation

The watchdog again recovered a missing 16:05 logical slot by moving the settlement heartbeat. Persistent monitor evidence initially recorded settlement run `35574717419` and downstream ERP5 run `35574765889` as `erp5-in-progress`.

Authoritative Actions evidence later closed ERP5 run `35574765889` as `cancelled`. This was not a pre-job cancellation: the job entered a real runner, passed checkout/OIDC/npm/source-contract/source recrawl/TCar audit/ledger-lock steps, then the `원천에서 ERP5 현재 원자 계산` step was cancelled after roughly ten minutes. Snapshot fixation, public catalog, sales-sheet/F86 publication, freshness, cross-parity, photo audit and evidence-preservation steps were skipped.

Classification: **Core > Project → D migration/backport gap, evidence escalation**.

Breaking impact: a logical slot can be recovered and partially execute while the persisted control-plane state remains stale and no terminal publication/audit proof exists. A later scheduler/recovery decision can therefore incorrectly suppress, replay, or misclassify the slot.

Verification needs:

- reconcile authoritative terminal `cancelled` into the persistent monitor;
- treat cancelled/failed execution as non-success rather than as success evidence merely because a trigger/run exists;
- retry or HOLD by the same logical identity exactly once according to Core D policy;
- never replay if delayed authoritative success later appears;
- prove restart, delayed/out-of-order `workflow_run`, and concurrent monitor-writer behavior;
- prove recovery is initiated within the configured grace/SLO rather than merely eventually.

## 5. ERP4 engine pin — state changed back to active repin but remains unverified

After the previous A evidence recorded a safety revert, merge `5266d634187493d871f4c5f13a07af0fb0f70698` restored the production refresh pin from `c3838708...` to `0e0bfb3a6e227fd65b754c1d74f7ca5c8b1c327e`, and the AI-Core shadow pipeline source revision was updated to the same pin.

This is an operational state change, not a Core candidate. The current evidence still does not justify calling the new pin production-verified: the 16:05 downstream run on the current lineage cancelled before fixed snapshot/public/F01/F86/freshness/parity/photo completion.

Classification: **Different / evidence-state change**.

Action: keep `0e0bfb3...` on validation HOLD until one production-equivalent run reaches the full publication and audit chain green. The previously recorded Source Registry/runtime semantic-parity gap remains open; this audit does not create a duplicate C candidate.

## 6. FreePass Sales — deployment/runtime evidence advanced, no new Core candidate

Sales advanced from the previously observed product-help revision to code revision `1ef7fd6799b6776a660d5937b42e9ed018dfaeca` and evidence head `c1c787ca03e61bc7f23a8bf1be0708d8a864dfc3`.

Material delta:

- restored the SMS promotion card top spacing while preserving call/interest card behavior;
- hardened the forced-update regression so service-worker cache versions are derived dynamically instead of hard-coded;
- recorded production-hosting release evidence for both Sales addresses: only three intended files changed, the remaining asset hashes/hosting settings were preserved, deployed files were re-fetched, and a synthetic deployed-CSS browser probe confirmed the 14px SMS spacing;
- exact-head Sales CI run `35577199103` is green through static checks, AI Core UI/UX mapping, receipt/workflow shadow checks, Playwright browser regression and mobile capture.

Classification: **Different / evidence-level deployment verification**.

No new B/C/D candidate: this is product-local spacing plus stronger deployment proof for previously extracted update-hand-off behavior. Real logged-in customer runtime was not observed in this evidence, so do not overstate it as end-user runtime verification.

## 7. ERP4 current head UI polish

Current ERP4 default-branch application head `6f5499f15acc7aa76fa83ee3efbbea8709023861` adds whole-card background/radius/overflow to `ShopCard.tsx`. Exact-head CI run `35575936501` is green.

Classification: **Different**. This is local visual polish, not a generalized B candidate.

## Routing summary

- B: no new candidate.
- C: candidate `Evidence-Bound Narrow Mutation Envelope`; migration gap for missing `core-request-context/v1` projection on the new Sheet Contract writer.
- D: candidate lifecycle for reviewed narrow mutation; existing ERP4 recovery gap escalated with authoritative 16:05 cancellation evidence.
- Canonical B/C/D standards: **unchanged**.
