# AIOps ↔ AI Core Security/Audit P0 SHADOW

Status: SHADOW / NO RUNTIME AUTHORITY TRANSFER

AI Core candidate:
- PR #155
- revision: 791d0e1963cd46f937329491b44c655ddce39ea3

AIOps source baseline:
- main at branch creation: cc440e53e90c642c42a88a70d415355056594129

## Purpose

Prove that the proposed AI Core Security/Audit P0 can represent AIOps' existing approval semantics without weakening them.

AIOps remains runtime authority. The shadow does not grant permission and does not write any production resource.

## Risk mapping

- local -> LOCAL_MUTATION
- drive-add -> REVERSIBLE_EXTERNAL_MUTATION
- protected -> IRREVERSIBLE_EXTERNAL_ACTION

The protected mapping is intentionally conservative because the existing AIOps class contains multiple high-risk operations.

## Subject continuity

AIOps:
- plan SHA
- template SHA
- target SHA/count
- optional command hash

maps to candidate:
- plan_digest
- artifact_digest
- target_digest / target_count
- command_digest

Changing the subject therefore invalidates reuse of prior authorization in both models.

## Parity tests

The project-side test checks:
- action-grade mapping;
- local pass;
- drive-add block without review/owner approval;
- independent reviewer + owner approval pass;
- self-review rejection;
- command-bound emergency path for reversible external action;
- protected action emergency rejection.

## No-touch boundary

This shadow does not:
- replace lib/seungin.mjs;
- alter approval ledgers;
- grant authority;
- acquire Drive/Firestore/Sheet leases;
- execute penalty work;
- modify production scheduler state.

Promotion beyond SHADOW requires repeated project CI plus a second independent consumer.
