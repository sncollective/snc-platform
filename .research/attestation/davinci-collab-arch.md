---
source_handle: davinci-collab-arch
fetched: 2026-06-23
source_url: https://www.blackmagicdesign.com/products/davinciresolve/collaboration
provenance: source-direct
---

## Summary

Blackmagic Design's own product page describing DaVinci Resolve's multi-user collaboration architecture. Relevant as the production reference for how NLE (non-linear editing) collaboration currently works in shipping software.

## Collaboration Model: Lock-Based, Not CRDT/OT

DaVinci Resolve's collaboration architecture uses **automatic bin and timeline locking** rather than CRDT or OT:

- Bins and timelines are "read only" until unlocked by the current user
- Multiple colorists can work on the same timeline simultaneously as an editor is trimming because color and fusion operations are clip-based (clip-level locking granularity)
- Individual clips are auto-locked while being graded so they cannot be overwritten

No mention of CRDT (Conflict-free Replicated Data Types) or OT (Operational Transformation) on this page. The approach is explicitly lock-based with sequential change acceptance rather than algorithmic conflict resolution.

## Real-Time Sync Mechanism

"Live save" functionality: multiple users constantly save small incremental changes to the project's database in real time. Changes are not forced — "changes are only applied when you accept updates."

## Conflict Resolution

Visual timeline comparison tools: "let you visually see the differences between two versions of a timeline." Users selectively accept modifications via merge/compare tooling, rather than automatic conflict resolution.

## Infrastructure Requirements

- Requires DaVinci Resolve Studio (paid; $295 one-time purchase)
- Requires Blackmagic Cloud, shared network storage, or proxy-based workflow to share media
- Project Server (Blackmagic Cloud or local) manages access and prevents conflicts

## Relevance

DaVinci Resolve represents the current production state of multi-editor NLE collaboration: lock-based with visual merge tools, not CRDT/OT. This is the reference point for "what ships" in NLE collaboration.
