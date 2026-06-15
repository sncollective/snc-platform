---
id: docs-streaming-simulcast-drift
kind: backlog
tags: [documentation, streaming]
created: 2026-06-12
---

# Docs drift: streaming.md §Simulcast omits the creator-scoped destination tier

## Description

`docs/streaming.md:64` asserts "Simulcast sits on the playout output, not on
individual creator streams" — but the system has a creator-scoped simulcast tier
the doc doesn't acknowledge:

- `apps/web/src/components/simulcast/simulcast-destination-manager.tsx` is mounted
  on the creator manage surface (walked in the streaming-playout-ux-review creator
  audit, journey C3).
- `apps/api/src/services/simulcast.ts` carries a `creatorId` column with creator
  CRUD (~lines 146–169) and creator-forward semantics ("Creator forward changes
  apply on next stream — no SRS restart needed", ~line 203).

The doc also doesn't state the reload-semantics split the audit code-confirmed:
admin (playout-output) destination changes apply immediately; creator destination
changes apply on next publish.

## Fix

Roll `docs/streaming.md` §Simulcast forward: name both destination tiers
(playout-output/admin-managed vs creator-scoped) and the immediate vs
next-publish reload split. A few sentences; no code change.

## Origin

Review of `streaming-playout-ux-review` (2026-06-12): the audit had both halves
of the contradiction in hand (quoted the doc in admin finding A5 and the service
comment in creator finding C3) but no drift item was filed. Related active story
`creator-simulcast-semantics-note` fixes the UI communication; this item fixes
the foundation doc.

## Absorbs documentation-simulcast-destinations-coverage (2026-06-15)

`documentation-simulcast-destinations-coverage` (2026-04-20) archived into this item — same
per-creator simulcast doc gap; this is the sharper code-confirmed version (streaming.md:64 vs
simulcast.ts creatorId tier).
