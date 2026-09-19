# AI Core Phase 1 Closeout Order — 2026-09-19

> Issued by: Order Session  
> Scope: AI Core only. Do not begin broad cross-repository modernization until this closeout gate is satisfied.

## Goal

Finish AI Core Phase 1 as a stable **company-wide baseline platform** before moving the main effort to other repositories.

Phase 1 does **not** mean every future capability is implemented or every HOLD is removed.

Phase 1 means:
- the ownership model is stable;
- the shared platform contracts are explicit;
- each core lane has executable baseline assets, not prose only;
- registry/validation/test paths exist;
- project learning can enter Core through A and be adopted by B/C/D without creating duplicate canons;
- future repository work can reliably say “follow AI Core baseline” and know what that means.

After Phase 1, the main program changes from **Core construction first** to **Repo-by-repo adoption / reverse-import / migration**, while Core continues to evolve through evidence from those projects.

---

## Global closeout gate

AI Core Phase 1 may be declared BASELINE_LOCKED only when all conditions below are met.

### G1. Single-entry operating model
- Order / A / B / C / D responsibilities are documented and linked from the common entrypoint.
- No competing role/canon document contradicts the current session directive without an explicit supersession marker.

### G2. Canon ownership
There is exactly one named owner for each class:
- Repo evidence / reverse import → A
- UI/UX / interaction → B
- Data / Engine / Adapter / API / Event / Error / Result / Receipt → C
- Workflow / State Machine / transition semantics → D
- priority / conflict / next order → Order

Unknown or overlapping ownership must be explicitly HOLD, not silently duplicated.

### G3. Executable baseline
For each B/C/D lane, at least one executable verification path must exist:
- schema/type/registry/validator/test/generator/simulator or equivalent,
- with a documented command or deterministic test path.

A lane consisting only of Markdown is not Phase 1 complete.

### G4. Registry linkage
Shared capabilities and standards must be addressable through the current registries or an explicitly named canonical registry.

Do not create a second competing capability or feature registry just for Phase 1.

### G5. Evidence and revision
Important adopted claims must identify:
- source project/repository when applicable;
- source revision;
- Core destination;
- adoption state: CANDIDATE / ADOPTED / HOLD / REJECTED;
- verification evidence.

### G6. Validation
Current AI Core validation/test commands must pass for the declared Phase 1 scope.

Skipped, unavailable, stale or environment-blocked checks remain explicitly reported and cannot be described as PASS.

### G7. No false completion
The following remain distinct:
- documented;
- implemented;
- locally tested;
- CI/revision verified;
- production activated;
- real-world outcome observed.

Phase 1 baseline lock does not imply production activation of HOLD capabilities.

---

## A Session — Phase 1 exit criteria

A must provide a usable cross-project learning intake, not a complete audit of every repository in existence.

Required:
1. canonical Discovery / Reverse Import record format;
2. source repo/path/revision/evidence fields;
3. Project > Core / Core > Project / Different / Core Missing classification;
4. B/C/D destination routing;
5. adoption status tracking;
6. initial prioritized repo inventory for the post-Phase-1 program.

A does **not** need to finish every repository before Phase 1 closes.

A should stop broad scanning once the post-closeout audit queue is sufficiently prioritized and hand the focus back to Order.

---

## B Session — Phase 1 exit criteria

B must establish the first usable Global UI/UX Platform baseline.

Minimum:
- canonical UI/UX constitution / global principles;
- token baseline: typography, spacing, sizing/density, semantic status/color roles;
- Web/Mobile layout and responsive rules;
- action hierarchy and bottom-action/navigation principles;
- list/card/table/detail/form/search/filter/sort baseline;
- loading/empty/error/disabled feedback;
- accessibility baseline;
- i18n / date / time / money / locale behavior;
- Feature Registry linkage;
- at least one executable validator/test/contract path;
- version/deprecation/migration rule.

Not required:
- every possible component in the future;
- all product screens rewritten.

Phase 1 closes when new product UI can start from this baseline rather than inventing common rules.

---

## C Session — Phase 1 exit criteria

C must establish the first usable Core Contract Platform baseline.

Minimum:
- Data / SSOT conventions;
- ID, type, nullability, date/time/timezone, money/currency, enum/version rules;
- Engine / Port / Adapter / Connector boundary;
- Import / Export and Parser / Mapper / Normalizer contract;
- API request/response/search/filter/sort/pagination/idempotency baseline;
- Event naming/version/correlation/duplicate/replay baseline;
- Error / Result baseline;
- Receipt / Evidence baseline;
- schema or machine-readable contract assets;
- executable validator / contract test path;
- schema evolution / migration rule.

Not required:
- every provider adapter implemented;
- every project migrated.

Phase 1 closes when a new backend capability can be built without inventing these contracts again.

---

## D Session — Phase 1 exit criteria

D must establish the first usable Workflow Platform baseline.

Minimum:
- State / State Machine model;
- transition / guard model;
- Command vs Event distinction;
- approval / reject / hold / cancel / fail / resume patterns;
- retry / timeout / SLA baseline;
- rollback / compensation baseline;
- automation / manual override / escalation baseline;
- audit trail contract;
- workflow registry or canonical specification;
- executable transition validator/test/simulator path;
- migration rule for project-local status logic.

Not required:
- every business workflow modeled.

Phase 1 closes when a new workflow can be expressed and tested without scattering status logic across UI handlers.

---

## Order Session — Phase 1 duties

Order owns closeout judgment.

Order must:
1. collect A/B/C/D return packets;
2. identify any blocking cross-lane conflict;
3. reject duplicate canons;
4. separate Phase 1 blocker vs Phase 2 enhancement;
5. issue BASELINE_LOCKED only with evidence;
6. create the post-Phase-1 repository audit/adoption sequence.

Do not keep Phase 1 open merely because additional useful features can still be imagined.

---

## Post-Phase-1 program

After BASELINE_LOCKED, the main work changes to **one repository at a time**.

Default flow per repository:

`repo preflight → current revision evidence → compare to AI Core → reverse-import superior patterns → migrate Core-behind project gaps → verify → record adoption → next repo`

Order chooses the sequence based on:
- business criticality;
- shared capability value;
- current instability / risk;
- evidence quality;
- likelihood of teaching AI Core something reusable.

Initial queue candidates:
- FreePass Sales
- FreePass Estimate / Self Quote
- FreePass ERP / ERP4 / ERP5
- FreePass Admin
- FreePass Mobility
- Welrix-related repositories
- AIOps
- DevCenter
- DocsHub
- remaining engines/adapters/import-export/backend utilities

This list is a queue candidate, not a fixed priority order. Order sets the actual sequence after Phase 1 closeout evidence is received.

---

## Order-side closeout registry

The current machine-readable status is `registry/phase1-closeout.json` under `contracts/phase1-closeout.schema.json`.
Run `npm run closeout:validate` to validate lane identity, blocking state, global gates and the rule that `BASELINE_LOCKED` requires A/B/C/D PASS plus green CI at the same observed revision.
The registry may remain structurally valid while status is HOLD; that is intentional and prevents false completion.

## Immediate order

A/B/C/D should now stop open-ended expansion and perform **Phase 1 gap-to-exit review** against this document.

Each lane returns:
- PASS items;
- remaining Phase 1 blockers;
- items that should be deferred to Phase 2;
- exact files/revisions;
- validators/tests and results;
- one next implementation action if blocked.

Order then decides the smallest set of work required to reach BASELINE_LOCKED.
