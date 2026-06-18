---
id: research-handoff-stack-library-gap-audit-2
tags: [documentation, streaming, workflow]
release_binding: null
research_origin: stack-library-gap-audit
created: 2026-06-18
---

# [prose] Add a gotcha to the srs-v6 skill: on_unpublish swallows callback errors

Source-verified (SRS v6.0.48): the `on_unpublish` callback returns `void` and on a callback
failure does `srs_freep(err); srs_warn(...); return` — the error is **silently swallowed**. By
contrast `on_publish` returns `srs_error_t` and a callback failure is **fatal** (disconnects the
publisher). The asymmetry is undocumented in the `srs-v6` skill.

Operational consequence: if our `on_unpublish` endpoint errors or is unreachable when a stream
ends, SRS still tears down the publisher — **no retry, no signal**. Anything our unpublish handler
must not lose (session-close bookkeeping, cleanup) cannot rely on the callback firing successfully.

## What to change
- Add a gotcha to the `srs-v6` skill: `on_unpublish` callback errors are silently ignored by SRS
  (no retry, no signal); `on_publish` errors are fatal and disconnect the publisher. Don't rely on
  `on_unpublish` for must-not-be-lost work — make it idempotent / reconcilable from another signal.

Our `streaming.routes.ts` `on_unpublish` handler already returns `{code:0}` correctly; the
best-effort semantics are inherited from SRS, not a choice we made. Skill-doc-correctness item.

## Research grounding

**Source**: `.research/analysis/briefs/stack-library-gap-audit-landscape.md` (slug: `stack-library-gap-audit`); attestation `.research/attestation/srs-src-v6.md`.

Source-confirmed against SRS v6.0.48: on_unpublish callback errors are swallowed while on_publish is fatal — the skill should carry this asymmetry as a gotcha so future work doesn't trust on_unpublish for durable signals.
