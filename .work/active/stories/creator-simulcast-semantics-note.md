---
id: creator-simulcast-semantics-note
kind: story
stage: review
tags: [streaming, creators]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# State when simulcast changes take effect (creator surface)

UX-review finding (creator audit C3, severity 3, code-confirmed): creator simulcast
changes apply on the NEXT publish (`on_forward` fires at stream start), but the UI copy
("Destinations stay active across all your streams until you toggle them off") implies
immediacy. A creator editing destinations mid-stream believes the change is live.
Add explicit copy near the destination list: "Changes apply the next time you start
streaming." Scope: creator surface only — the admin side's semantics (immediate via
publisher kick) belong to the `playout-admin-redesign` epic.

## Acceptance
- [x] Creator simulcast section states next-publish semantics where destinations are edited
- [x] Copy reviewed against the actual `on_forward` behavior in code (cite file:line in notes)

## Implementation notes

**Changed files:**

- `apps/web/src/routes/creators/$creatorId/manage/streaming.tsx` — appended "Changes apply the next time you start streaming." to the Simulcast Destinations section `<p className={styles.description}>` (lines 302-306). Scope: creator surface only. The admin side (simulcast.tsx) was not touched.
- `apps/web/tests/unit/routes/creators/manage/streaming.test.tsx` — added `"renders next-publish semantics copy in simulcast section"` test asserting the text is present after render.

**Semantics ground-truth:** `apps/api/src/services/simulcast.ts:203-204` — "Creator forward changes apply on next stream — no SRS restart needed. SRS on_forward fires per-publish, and kicking a creator's OBS would be disruptive." Confirmed the `on_forward` hook fires per-publish (stream start), not immediately. The admin surface uses a different code path (publisher kick) and is out of scope for this item.

## Review (2026-06-12)

**Verdict**: Approve — held at review on fix-verify loopback (platform convention:
user re-confirms the fix in the running app before close). Fast lane: implementation
record green (full suite: 671 shared + 1501 api + 1607 web, typecheck clean); diff
spot-checked against the story brief at feature-level review.
