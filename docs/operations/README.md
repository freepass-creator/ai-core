# Operations state readback

This directory holds timestamped, evidence-only observations. It does not replace
the project registry, order ledger, repository, deployment provider, or session
history as an authority.

Generate a board without writing operational data:

```powershell
npm run operations:board -- --input docs/operations/active-state-observation-2026-09-21.json
```

Create a closeout handoff only from an explicit JSON closeout packet:

```powershell
npm run operations:handoff -- --input docs/operations/active-state-observation-2026-09-21.json --closeout closeout.json
```

The handoff is rejected unless its repository revision is present in the
observation and an existing repository-relative authoritative path, completion
evidence plus a next order are supplied. A handoff
never grants merge, deploy, database-write, or external-send authority.

`NO_DURABLE_ROUTE_RECEIPT` means that the coordinator-to-repository-session-to-
coordinator round trip was not proven. Session titles or an assistant message do
not count as a durable receipt.
