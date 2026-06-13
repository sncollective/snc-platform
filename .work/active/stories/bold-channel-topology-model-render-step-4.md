---
id: bold-channel-topology-model-render-step-4
kind: story
stage: review
tags: [refactor, streaming, playout]
release_binding: null
depends_on: [bold-channel-topology-model-render-step-3]
gate_origin: refactor-design
created: 2026-06-13
updated: 2026-06-13
parent: bold-channel-topology-model-render
---

# Step 4: Harbor path builders shared with the API client side

Collapse the string-matching contract between the `.liq` harbor registrations and the API callers that hit them. Today `/channels/{id}/queue`, `/channels/{id}/skip`, `/channels/{id}/now-playing` are constructed independently in `liquidsoap-config.ts` (registration, via render after step 3) and `liquidsoap-client.ts:71-85` (calls); `liquidsoap.ts:19` independently knows the legacy `/now-playing`.

**Files:** `apps/api/src/services/playout-topology.ts` (export path builders), `apps/api/src/services/liquidsoap-client.ts`, `apps/api/src/services/liquidsoap.ts`.

**Current state:**
```ts
// liquidsoap-client.ts
return request(`/channels/${channelId}/queue`, {...});
// playout-topology.ts (after step 2) builds the same strings for harborPaths
```

**Target state:**
```ts
// playout-topology.ts
export const harborChannelPaths = (channelId: string) => ({
  queue: `/channels/${channelId}/queue`,
  skip: `/channels/${channelId}/skip`,
  nowPlaying: `/channels/${channelId}/now-playing`,
} as const);
export const HARBOR_LEGACY_NOW_PLAYING = "/now-playing" as const;
// used by buildPlayoutTopology internally AND imported by liquidsoap-client.ts / liquidsoap.ts
```

**Implementation notes:**
- Identical output strings — behavior-preserving by construction; existing client/route tests pin the URLs.
- ⚠ **Lane coordination:** `liquidsoap-client.ts` sits in the module family Lane 2's `bold-lifecycle-transitions-playout-queue` will touch. This step is deliberately last and independently revertible; check Lane 2 state before starting it, and skip/defer if Lane 2 has the file in flight.

**Acceptance criteria:**
- [ ] Build + API unit suite pass (goldens unchanged)
- [ ] `grep -rn "/channels/\${" apps/api/src` shows path construction only in `playout-topology.ts`
- [ ] Client tests (`liquidsoap-client`, `playout`) pass untouched

**Risk:** Low.
**Rollback:** revert the commit; builders remain as unused exports or are deleted with it.

## Implementation record (2026-06-13)

Lane coordination checked first: `bold-lifecycle-transitions-playout-queue` still at `drafting`, shared files clean in the working tree — window open. `harborChannelPaths` (already exported in step 2) now consumed by `liquidsoap-client.ts`; new `HARBOR_LEGACY_NOW_PLAYING` consumed by both the render (broadcast register line) and `liquidsoap.ts`. Identical strings — goldens unchanged (`git status` clean on `__snapshots__/`), typecheck green, full API suite green. `grep '/channels/\${' apps/api/src` confirms path construction only in `playout-topology.ts`.
