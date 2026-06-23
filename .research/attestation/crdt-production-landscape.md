---
source_handle: crdt-production-landscape
fetched: 2026-06-23
source_url: https://zylos.ai/research/2026-01-29-crdt-real-time-collaboration/
provenance: source-direct
---

## Summary

A survey of production CRDT deployments and CRDT library landscape as of January 2026. Relevant to verifying the current state of CRDT adoption and specifically whether video editing timelines have been addressed.

## Production Domains Named

- **Figma** — design/graphics collaboration (switched from OT to CRDTs in 2019)
- **League of Legends** — chat system handling "7.5M concurrent users, 11K messages/second"
- **Notion** — hybrid approach combining CRDTs with OT
- **Linear** — issue tracking with hybrid CRDT/OT strategy

**No video editing, timeline editing, or NLE applications are named as CRDT deployments.**

## CRDT Libraries Named

- **Yjs** — "The fastest CRDT implementation for web-based applications"; bindings for CodeMirror, Monaco, Quill, ProseMirror; handling 26K–156K operations per second
- **Automerge 2.0** — Rust-based; achieves 600ms processing time for 260,000 keystrokes (down from 2 seconds per character in prior versions); JSON-like data structures
- **Diamond Types** — claims "world's fastest CRDT" for plain text
- **Loro** — Rust implementation; supports rich text, lists, maps, and movable trees
- **Jazz, Fireproof, DXOS, Zero, ElectricSQL, PowerSync** — broader ecosystem tools (no detail given)

## OT vs CRDT Summary

- Google Docs uses OT for centralized real-time editing with sub-millisecond latency
- Figma switched from OT to CRDTs in 2019 for offline-first capabilities
- 2026 consensus: OT for reliable servers with centralized coordination; CRDTs for offline-first, peer-to-peer, or distributed applications

## Gap Finding

The document confirms CRDTs are production-ready for text, rich text, and structured document collaboration. Video editing timelines (NLE sequences) are not named in any production CRDT deployment.
