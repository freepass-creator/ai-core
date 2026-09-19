# A Session Gap Backport — JPKERP Silent Reconciliation & Partial Write

상태: **CORE_AHEAD / WORKFLOW_RESULT_MIGRATION_REQUIRED / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: JPKERP
- Repository: `freepass-creator/jpkerp`
- Default branch: `master`
- Source path:
  - `lib/firebase/events.ts`
  - `lib/derive/payment-match.ts`
  - `lib/derive/billings.ts`
- Revision:
  - observed repository head: `e6de03adbac98a33da7d844fb8fb197ff885e7cb`
  - event persistence blob: `943e0fff28c4c91134874a770d9e8420a65be515`
  - payment reconciliation blob: `8df76c69ab161d259c5d422530ba642ad0617fc5`
  - billing derivation blob: `a0fa9ff7dd9a5582dc12cd16e612ebb2194619cf`
- Category: Workflow / Partial Failure / Result / Reconciliation

## Current implementation

### Event save path

`saveEvent()` persists the event first.

For bank/card events that have a contract and amount, it then calls `reconcilePayment()`.

That call is wrapped in:

`try { await reconcilePayment(...) } catch { /* 매칭 실패는 이벤트 저장 결과에 영향 없음 */ }`

The public result of `saveEvent()` is still the event key.

The same pattern exists in `upsertEventByRawKey()`: a newly inserted event can be persisted successfully while reconciliation failure is swallowed.

### Reconciliation path

`reconcilePayment()`:

1. loads unpaid billings for the contract;
2. sorts oldest due first;
3. applies one payment across one or more billing rows;
4. performs individual RTDB updates sequentially;
5. only after billing updates, writes a back-reference/match status to the source event.

This is not one transaction.

If a later billing update or the final event back-reference fails, earlier billing mutations may already have been committed.

No compensation, outbox, persisted reconciliation job/status, or explicit partial-result contract was found in this path.

Repository tree inspection also found no executable test/spec suite covering this reconciliation behavior.

## AI Core equivalent

Current AI Core direction already requires:

- launch/action separated from verified completion;
- partial multi-effect failure must not be hidden;
- multi-aggregate effects must explicitly choose transaction / outbox / saga-compensation / reconciliation;
- result contracts must expose meaningful failure/HOLD rather than infer success from the first write;
- Renman now provides project-verified reverse-order domain compensation evidence through `workflow.compensated-multiwrite`.

## Classification

- **Core > Project**
- This is a Backport Gap.
- JPKERP is a useful negative/counterexample for the need behind:
  - `workflow.compensated-multiwrite`
  - `workflow.launch-vs-completion`
  - Result/Receipt contracts.

It does **not** count as positive second-project evidence for compensation.

## Gap

The current externally observable meaning is effectively:

`event persisted = save succeeded`

while downstream business meaning may actually be:

- event persisted;
- some billing rows updated;
- remaining billing update failed;
- event match back-reference missing;
- reconciliation error hidden from caller.

This creates a false-completion and financial consistency risk.

## Recommended migration

1. Keep event ingestion and financial reconciliation as distinct states.
2. After event persistence, store an explicit reconciliation state such as:
   - PENDING
   - SUCCEEDED
   - FAILED_RETRYABLE
   - HOLD/PARTIAL
3. Do not swallow reconciliation exceptions.
4. Return or persist a structured result carrying:
   - event identity
   - reconciliation attempt identity
   - affected billing identities
   - applied amount
   - remainder
   - failure/partial-state evidence
5. Choose a consistency strategy:
   - datastore transaction where the full write-set can fit;
   - durable outbox/reconciliation worker for asynchronous convergence;
   - domain compensation if effects must be reversed.
6. Make retries idempotent using the source event/raw key plus allocation identity.
7. Add repair/reconciliation tooling for events whose persistence succeeded but matching did not.
8. Add failure injection tests:
   - first billing write fails;
   - second/Nth billing write fails;
   - event back-reference write fails;
   - retry after partial application does not double-allocate.
9. Workflow/UI must advance to “matched/completed” only from verified reconciliation result, not event-save success.

## Breaking impact

- **MEDIUM-HIGH**
- Financial matching behavior is operationally meaningful.
- Do not rewrite historical allocations blindly; first detect events/billings that may already be partially reconciled.

## Verification needs

- no duplicate allocation after retry;
- exact total applied remains conserved;
- event result distinguishes saved vs reconciled;
- partial failure is visible and repairable;
- retry resumes/reconciles safely;
- source event remains preserved even if financial reconciliation is HOLD.

## Destination

- D — primary: partial failure / reconciliation workflow
- C — secondary: Event/Result/Idempotency contract

## Gap Backport Pipeline

Core Standard 확인 → DONE
Project Gap 확인 → DONE
Breaking 여부 → MEDIUM-HIGH
Migration 방법 → EXPLICIT RECONCILIATION STATE + IDEMPOTENT RETRY + TRANSACTION/OUTBOX/COMPENSATION
적용 우선순위 → P1
Project 적용 후보 → READY FOR OWNER REVIEW
검증 → PENDING
