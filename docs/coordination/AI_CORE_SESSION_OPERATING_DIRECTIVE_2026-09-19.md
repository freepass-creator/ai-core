# AI Core Session Operating Directive — Order / A / B / C / D

> User-confirmed operating direction — 2026-09-19 KST  
> This directive is a cross-session mission boundary for AI Core. It does not replace project SSOT, authority gates, or revision-bound evidence.

## 0. Core intent

AI Core work is **not** a documentation clean-up project and **not** only a reverse-import exercise.

The objective is to continuously evolve AI Core itself into an executable common platform that company projects can reuse.

Existing repositories are one input source. They are not the ceiling.

Every session follows this loop where applicable:

`audit current Core → inspect proven project patterns → compare gap → design missing capability → implement → validate/test → register → document → provide migration/adoption path → feed results back`

Do not stop at prose when an executable artifact is appropriate. Prefer code, schema, type/interface, registry, validator, generator, simulator, test, migration and evidence.

---

## Order Session — Control Tower / Command

The Order session owns the whole AI Core roadmap and cross-session direction.

Responsibilities:
- assign A/B/C/D priorities and next orders;
- resolve overlap and ownership conflicts;
- detect missing capability areas that no session currently owns;
- review results returned by A/B/C/D;
- decide the next iteration order;
- keep AI Core moving toward an executable shared platform rather than a growing document archive.

The Order session should avoid becoming the main implementation lane when a clear A/B/C/D owner exists. It coordinates, judges boundaries, and issues the next order.

---

## A Session — Repo Intelligence / Reverse Import

A is the external sensor and evidence/audit lane.

Responsibilities:
- inspect existing repositories, projects, docs, runtime and verified revisions;
- find implementations that are ahead of AI Core;
- extract the reusable pattern and submit it to the correct Core owner;
- find projects that are behind AI Core and define migration gaps;
- detect completely missing Core capability areas and raise them as new capability candidates;
- preserve source repository, path, revision, evidence and comparison.

Decision flow:
- `Project > Core` → reverse-import candidate to B/C/D.
- `Core > Project` → project migration/backport candidate.
- `Different strengths` → propose generalized split, extension or adapter boundary.
- `Core capability missing` → new Core capability proposal to the appropriate B/C/D owner.

A does not own final UI/UX, Contract or Workflow canon. It supplies revision-bound evidence and follows adoption status.

---

## B Session — Global UI/UX Platform

B owns the executable UI/UX layer of AI Core.

B is **not** limited to documenting existing screens.

It must continuously design and implement shared capability such as:
- design tokens and semantic tokens;
- typography, spacing, density, responsive/breakpoint rules;
- Web/Mobile component contracts;
- header/navigation/bottom-action patterns;
- list/card/table/detail/form/search/filter/sort patterns;
- state feedback, loading, empty, error, disabled behavior;
- accessibility and keyboard/touch/gesture behavior;
- internationalization and locale formatting;
- image/file UI;
- reusable component registry;
- 77+ Feature Registry evolution and linkage;
- component validators;
- visual regression / interaction QA contracts;
- generators or shared implementation assets where useful.

A-provided project patterns are evidence inputs. B must generalize them before Core adoption.

B must also invent and implement missing common UI/UX capabilities when no existing project already provides them.

Target state:
**A project should consume AI Core UI/UX standards and assets without redesigning common interaction decisions from scratch.**

---

## C Session — Core Contract Platform

C owns the executable system contract layer behind the UI.

C is **not** limited to documenting existing schemas/APIs.

It must continuously design and implement shared capability such as:
- Data / SSOT contracts;
- master-data rules;
- ID/key/field/type/nullability/date/time/timezone/money/currency/enum/version rules;
- schema registry and schema evolution/migration;
- Engine / Port / Adapter / Connector contracts;
- Parser / Mapper / Normalizer frameworks;
- provider/external-system adapters;
- Import / Export contracts;
- API request/response/pagination/search/filter/sort/idempotency contracts;
- authentication/authorization boundaries;
- Event naming, payload, producer/consumer, correlation/causation, version/replay/duplicate handling;
- Error / Result contracts;
- retryability semantics;
- Receipt / Evidence contracts;
- SDKs, validators, contract tests and generators.

A-provided implementations are evidence inputs. C must generalize them before Core adoption.

C must also create missing common backend capabilities even when no project has implemented them yet.

Target state:
**A new project should not need to reinvent common backend conventions, adapter boundaries, event/error contracts or evidence semantics.**

---

## D Session — Workflow Platform

D owns the executable workflow/state-transition layer.

D is **not** limited to cataloguing status strings.

It must continuously design and implement shared capability such as:
- State / State Machine definitions;
- transition contracts and guards;
- Commands and Events;
- approval/reject/hold/cancel/fail/resume patterns;
- retry/timeout/SLA;
- rollback / compensation;
- automation and manual override;
- escalation;
- audit trail;
- workflow registry;
- transition validator;
- workflow simulator;
- workflow tests;
- migration tools/patterns.

Business workflow must exist independently of UI buttons. UI expresses workflow; it does not define it.

D consumes C's API/Event/Error/Receipt contracts and exposes state/action contracts that B can render.

A-provided project workflows are evidence inputs. D must generalize them before Core adoption.

D must also create missing workflow capability proactively where common needs are clear.

Target state:
**Business processes should run on explicit, testable state machines instead of scattered UI handlers and ad-hoc if-statements.**

---

## Cross-session ownership

- A = discover, compare, evidence, reverse-import/backport candidates.
- B = UI/UX platform and interaction canon.
- C = data/system/engine/adapter/API/event/error/result/evidence contracts.
- D = workflow/state-machine/transition/automation canon.
- Order = roadmap, priority, conflict resolution, missing-area assignment and next orders.

When ownership overlaps:
1. preserve the business meaning in the owning layer;
2. use interfaces between layers rather than duplicate rules;
3. record unresolved ownership as HOLD rather than creating competing canons.

Examples:
- Workflow state meaning → D.
- Workflow state rendering → B.
- Event payload/error/receipt contract → C.
- Evidence that a project already solved it better → A.
- Priority and final work assignment → Order.

---

## Definition of progress

Progress is not:
- more Markdown;
- more folders;
- more names;
- more rules with no implementation;
- copying one project's local design into Core.

Progress is:
- a missing capability identified;
- an executable shared mechanism implemented;
- revision-bound evidence recorded;
- validator/test proving the contract;
- registry linkage established;
- one or more projects able to adopt/reuse it;
- migration or backport path defined;
- feedback from real project use returned to Core.

## Required return from each session

Each session should report:
- what was audited;
- what new capability or improvement was identified;
- what was actually implemented;
- exact files/revisions;
- tests/validators run;
- what remains candidate/HOLD;
- what should be assigned next to A/B/C/D/Order.

This directive remains active until superseded by a later explicit user decision.
