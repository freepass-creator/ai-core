# FreePass Admin Application Workflow Shadow

Status: **D5 SHADOW / PROJECT-VERIFIED SOURCE EVIDENCE**

Source repository: `freepass-creator/freepass-admin@77f682af680528124096e4f7871504a3596c8990`

## Key finding

FreePass Admin does **not** have a four-step authoritative state machine of:

`RECEIVED -> CONTRACTED -> DELIVERED -> CANCELLED`

The code explicitly treats progress as facts:

- `contractCompleted`
- `documentsCompleted`
- `balanceCompleted`
- `deliveryCompleted`

`RECEIVED / CONTRACTED / DELIVERED` are derived from those facts. `documentsCompleted` and `balanceCompleted` intentionally do not advance the displayed status.

Cancellation is different:

- requires a non-empty reason
- appends `APPLICATION_CANCELLED` history
- is sticky
- blocks all later progress mutation
- repeated cancel does not overwrite the first reason

Therefore D models:

- authoritative lifecycle: `ACTIVE -> CANCELLED`
- independent progress facts: four booleans
- derived projection: `application.status`

## Derived status order

1. lifecycle `CANCELLED` -> `CANCELLED`
2. deliveryCompleted -> `DELIVERED`
3. contractCompleted -> `CONTRACTED`
4. otherwise -> `RECEIVED`

This preserves the source behavior and prevents UI labels from becoming writable business state.

## Evidence

Pinned source files:

- `src/domain/application/types.ts`
- `src/domain/application/update-progress.ts`
- `src/domain/application/create-application.ts`
- `src/services/applications.ts`
- `src/services/__tests__/applications.test.ts`

A-session independently observed exact head `77f682af...` with green backend-check CI. D does not promote this project workflow beyond SHADOW until project-side D contract adoption/parity is implemented at the source repository.
