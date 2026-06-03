---
tags: [security, identity]
release_binding: null
created: 2026-04-20
---

# Auth Rate Limiter: In-Memory Store Not Shared Across Instances

`app.ts:58-72` — The authentication rate limiter is implemented with an in-memory store. In a single-process dev deployment this works correctly, but under horizontal scaling each process maintains its own counter: the effective rate limit per user becomes `configured_limit × number_of_instances`.

Accepted risk for current single-instance dev deployment. Before any move to multiple API instances (load-balanced or replicated), the rate limiter must be backed by a shared store — Redis or a PostgreSQL table (e.g. using `pg-boss` or a dedicated rate-limit table) — so that the limit is enforced across all processes.

Original note from board: "Suggested: replace with shared store (Redis or PostgreSQL) for production."

This is a pre-scaling prerequisite, not an active bug in the current single-instance setup. Scope when horizontal scaling is planned.
