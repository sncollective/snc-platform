---
id: research-handoff-stack-library-gap-audit-1
tags: [documentation, content, workflow]
release_binding: null
research_origin: stack-library-gap-audit
created: 2026-06-18
---

# [prose] Correct the tusd-v2 skill: post-finish is fire-and-forget

The `tusd-v2` skill documents the `post-finish` hook's ordering but not its **failure
contract**, which is the operationally load-bearing part. Source-verified (tusd v2.9.2): the hook
is dispatched async (`invokeHookAsync` spawns a goroutine and discards its return), and the tus
client's final 204 is **not gated on the hook result**. So a non-2xx we return from our
`post-finish` handler (e.g. an S3 copy failure) is logged by tusd and discarded — the client never
learns whether the post-finish work (S3 copy + delete + DB write) succeeded.

## What to change
- Add to the `tusd-v2` skill (gotcha + the hook-lifecycle table): pre-* hooks are
  synchronous/blocking on the tus request; post-* hooks are async/fire-and-forget and fire **after**
  the client is already notified. A `post-finish` 500 is discarded; the client is unaffected.
- State the consequence: if post-finish work must be durable, hand it to **pg-boss** rather than
  relying on the hook response. (Our `handlePostFinish` doing the work inline is correct *as
  best-effort async* — the skill should make the best-effort nature explicit so a future reader
  doesn't assume the hook response means anything to the client.)

Our `tusd-hooks.routes.ts` already returns `c.json({})` on the error paths (correct — throwing
wouldn't help since tusd discards it anyway). This is a skill-doc-correctness item, not a code bug.

## Research grounding

**Source**: `.research/analysis/briefs/stack-library-gap-audit-landscape.md` (slug: `stack-library-gap-audit`); attestation `.research/attestation/tusd-src-2-9-2.md`.

Source-confirmed against tusd v2.9.2 + our upload-hook code: post-finish errors are discarded after the client is notified — the skill should document the failure contract and point durable follow-up at pg-boss.
