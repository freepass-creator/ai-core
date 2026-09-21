# AI Core A-session repository audit addendum — 2026-09-21T04:32Z

## Scope and reason

- Previous A-session evidence revision: `4214a984c6e7dba37176be5cc573872b05c02cf1`.
- AI Core canonical comparison target remains `ac8c502358c17613a712c9c7e1ab780f51f1eb97`.
- This is a scan-race correction only. While the preceding A evidence was being written, `freepasserp4` advanced from application merge `6691b0f27c3df91ab07f3e0078903c69a1471f5e` to audit-record head `578533c8451a6d69921fea9e0678d6c204ad8740`.
- No B/C/D canonical standard is modified.

## ERP4 scan-race correction

Current repository head: `578533c8451a6d69921fea9e0678d6c204ad8740`.
Application/runtime revision under audit remains: `6691b0f27c3df91ab07f3e0078903c69a1471f5e`.

The range from the preceding observed ERP4 head `257e742d73781af89c94809770f1d4208900fba9` to current head is fifteen commits ahead. The commits after `6691b0f...` are audit-recorder/documentation changes; they do not supersede the application/runtime revision that produced run `35560321553`.

### Different / evidence-level correction: Audit 89 confirms the repin and post-publish red state

Audit 89 explicitly confirms:

- production engine pin `0c31f98d412d9e006e1894804ebe767fc91683f1` is current main truth;
- F86 fixed tabs are `상품리스트 / 손오공상품 / 픽업구독 / 오플구독`;
- F01 intentionally remains `상품리스트 / 오공구독 / 픽업구독 / 오플구독`;
- F01 and F86 remain projections of the same canonical Atom/fixed snapshot rather than separate authorities;
- source/writer authority remains unchanged;
- generic CI and source-contract checks on application merge `6691b0f...` are green;
- production-equivalent run `35560321553` published outputs and passed the first F86↔Atom gate, then failed the Atom↔F01↔F86 cell-level cross-audit;
- the failed run preserved its snapshot artifact for diagnosis;
- Audit 88 scheduler/recovery HOLD remains independently open.

This does not create a new B/C/D candidate. It is **Different / evidence-level correction** and confirms the preceding A-session classification that the new publication pin is not production-verified yet.

### Stale-revision action

The preceding A evidence file stated ERP4 exact head as `6691b0f...`. That was already stale by the time the A evidence commit landed because Audit 89 had advanced the repository head. Future A scans must distinguish:

- **repository evidence head**: latest documentation/audit revision;
- **application/runtime head**: exact revision that executed the production-equivalent workflow;
- **runtime receipt/run ID**: authoritative execution evidence.

Do not infer a new application revision merely from an audit-recorder commit.

## Routing summary

- **Project > Core → B/C/D:** no new candidate in this addendum.
- **Core > Project:** no new gap beyond those already recorded in `4214a984...`.
- **Different:** ERP4 scan-race/stale-head correction; Audit 89 confirms the already-recorded post-publish cross-projection failure and current F86 projection semantics.

No B/C/D canonical standard was changed by this addendum.
