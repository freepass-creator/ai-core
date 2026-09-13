# AI Core Memory

This repository is the read-optimized memory entrypoint for Chat, Work/Codex, and other AIs.

## Read order

1. `memory/CURRENT.md` — current compact operating memory.
2. `memory/CANONICAL.md` — deduplicated principles and boundaries.
3. `memory/LINEAGE.md` — how the ideas evolved, only when historical context matters.
4. `memory/EMAIL_INDEX.json` — archival map back to the original Gmail records.

Do **not** reread all AIOPS email history by default. Read additional history only when a current decision has a freshness gap, a conflict, or a critical missing premise.

## Authority boundary

This memory is a compact inheritance layer, not an automatic approval system.

- Project repositories remain the SSOT for project facts/code.
- AIOPS remains the source for operational/control knowledge where applicable.
- DevCenter remains the registry/verification source for development capabilities where applicable.
- DocsHub/Doc Center remains the document-design source where applicable.
- New CIVILIZATION/DEVKIT research is not automatically adopted by a project.
- External actions, production changes, permissions, payments, legal filing, deletion, and other authority-sensitive actions keep their own approval boundaries.

## Why this exists

The original knowledge was accumulated in Gmail. Gmail remains useful as an archive and provenance trail, but Work and other AIs should not need to rediscover the same history repeatedly. This folder compresses that history into a versioned GitHub memory with explicit lineage, current status, and superseded ideas.