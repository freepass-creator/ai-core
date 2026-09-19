# A Session Gap Backport — JPKERP-v4 Server-Acknowledged Mutation

상태: **CORE_AHEAD / RESULT_REPOSITORY_MIGRATION_REQUIRED / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: JPKERP-v4
- Repository: `freepass-creator/jpkerp-v4`
- Source path:
  - `lib/create-keyed-store.ts`
- Revision:
  - observed repository head: `8e72823454732a0d6bceddf8be646ad3c9cc83ff`
  - store implementation blob: `da430313016209f5c36ec20e1e2926e52a756bf9`
- Category: Core Contract / Repository / Result / Server Truth

## Current implementation

The common keyed RTDB store correctly prevents writes before the first remote load, which avoids one class of destructive overwrite.

But the normal mutation path is optimistic without a reconciliation/result contract:

1. compute `next`;
2. assign `cache = next`;
3. notify all UI listeners immediately;
4. start asynchronous RTDB `set(...)`;
5. if the RTDB write fails, show an alert and log the failure;
6. local cache/listeners are **not** rolled back or re-read;
7. `setItems` returns no Promise/result that the caller can await or inspect.

Therefore the visible/client state can represent a mutation that the server never accepted.

## AI Core equivalent

Current AI Core direction already separates:

- action launched / local intent
- provider/storage confirmation
- verified completion/result

and uses explicit result contracts rather than UI state as proof of persistence.

FreePass Sales research also established server-truth vs local-recovery as an important practical boundary.

## Classification

- **Core > Project** for Repository/Result semantics.

## Gap

This is not merely an error-message issue.

The contract currently allows:

`local optimistic state = apparent success`

while:

`server persistence = failed`.

Because the setter returns `void`, upstream Workflow/UI cannot reliably distinguish:

- accepted
- pending
- failed
- reconciled

states.

## Recommended migration

1. Repository mutation should return an awaitable structured result or throw a typed error.
2. Do not mark persisted/complete state solely from local optimistic mutation.
3. Choose and document one of:
   - pessimistic update after server ACK;
   - optimistic update with rollback snapshot;
   - optimistic update with mandatory remote reconciliation.
4. On failure, restore/re-read authoritative state before claiming the UI is current.
5. Expose mutation state separately from domain state:
   - pending
   - confirmed
   - failed/retryable
6. Bind audit/completion evidence to the acknowledged server result.
7. Add concurrency/failure tests around the shared store factory.

## Breaking impact

- MEDIUM.
- Many domain stores may rely on the current synchronous setter shape.
- Migration should start by adding an async/result-capable API while keeping a compatibility wrapper, then move consumers.

## Verification needs

- RTDB success → local state confirmed
- RTDB failure → local optimistic state rolled back/reconciled
- caller receives deterministic failure result
- concurrent remote update during pending write is handled
- no false "saved" completion from UI-only cache state
- initial-load write guard remains intact

## Destination

- C — Repository / Result Contract backport.
- D consumers should use the confirmed result before advancing workflow completion.

## Gap Backport Pipeline

Core Standard 확인 → DONE
Project Gap 확인 → DONE
Breaking 여부 → MEDIUM
Migration 방법 → ACKNOWLEDGED RESULT + ROLLBACK/RECONCILIATION
적용 우선순위 → P1
Project 적용 후보 → READY FOR OWNER REVIEW
검증 → PENDING
