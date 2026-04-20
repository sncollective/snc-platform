---
id: feature-performance-fixes
kind: feature
stage: done
tags: [admin-console, streaming, design-system]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Performance Fixes — Playout Admin + Team Section

Two unrelated performance regressions surfaced during prior review cycles.

## Tasks

- [x] Playout admin — batch queue status query (`getMultiChannelQueueStatus`)
- [x] Playout admin — parallel external calls (`Promise.allSettled`)
- [x] Playout admin — defer queue to client
- [x] Team section — shared role selector
- [x] Team section — memoize form selects

---

## Design

### Fix 1: Playout admin page slow to load

**Root cause:** The route loader blocks on `GET /api/streaming/status`, which does sequential work per channel:

1. **DB query** — fetch all channels (fast)
2. **SRS API call** — `GET ${SRS_API_URL}/api/v1/streams/` with 5s timeout (external, unreliable)
3. **Per-channel orchestrator calls** — for each playout channel, `getChannelQueueStatus()` runs 3 DB queries (channel lookup, queue entries with join, pool count)
4. **Liquidsoap now-playing** — for broadcast channels, another external HTTP call

With 3+ playout channels: 9+ DB queries + 2 external HTTP calls, all serial in the loader.

**Key files:**
- `apps/web/src/routes/admin/playout.tsx` — loader
- `apps/api/src/services/srs.ts` — `getChannelList()`
- `apps/api/src/services/playout-orchestrator.ts` — `getChannelQueueStatus()`

**Unit 1: Batch queue status query**

**Files:** `apps/api/src/services/playout-orchestrator.ts`

Replace per-channel `getChannelQueueStatus()` calls with a single batch query:

- New `getMultiChannelQueueStatus(channelIds: string[])` method
- Single query: select from `playout_queue` joined with `playout_items` where `channelId IN (...)`, grouped by channel
- Single count query: select from `channel_content` where `channelId IN (...)`, grouped by channel
- Returns `Map<string, QueueStatus>` — same shape, 2 queries instead of 3×N

**Unit 2: Parallel external calls**

**Files:** `apps/api/src/services/srs.ts`

In `getChannelList()`, restructure the data assembly:

- Run SRS streams fetch and Liquidsoap now-playing in `Promise.allSettled()` (not serial)
- Reduce SRS timeout from 5s to 2s — it's best-effort status enrichment, not critical data
- If SRS is unreachable, return channels with `streamStatus: "unknown"` instead of blocking

**Unit 3: Defer queue polling to client**

**Files:** `apps/web/src/routes/admin/playout.tsx`

- Remove queue status from the loader response — page renders immediately with channel list
- Existing `useChannelQueue()` hook already polls queue data client-side (3s interval)
- Show skeleton/spinner in the queue section while first poll loads
- Net effect: page shell renders in <500ms, queue data fills in within 3s

**Expected impact:** Before: 3-10s loader block (depends on channel count + SRS responsiveness). After: <500ms loader (DB channels only), queue data fills async.

---

### Fix 2: Team section slow render

**Root cause:** `team-section.tsx` renders one `<SelectRoot>` per team member in the member list, plus 2 more for the add/invite forms. For a 10-member team: 12 SelectRoot instances, each with full Ark UI machinery (Zag state machine, floating-ui positioning, event listeners). The cost scales linearly with member count.

**Key file:** `apps/web/src/components/creator/team-section.tsx`

**Design decision:** Replace the per-member inline Select dropdowns with a single shared role-change interaction. Member list shows role as a text badge (clickable for owners). Clicking the badge opens a lightweight popover positioned at the click target. Role change commits on selection, popover closes. Result: 1 Select instance regardless of team size. Matches the pattern used by `kebab-menu.tsx`.

**Unit 4: Extract role badge + shared selector**

**Files:** `components/creator/team-section.tsx`, `team-section.module.css`

- Replace the `members.map()` loop's inline SelectRoot with a role badge `<button>`:
  ```tsx
  <button 
    className={styles.roleBadge} 
    onClick={() => openRoleChange(member)}
    disabled={!canManageMembers || isSoleOwner(member)}
  >
    {member.role}
  </button>
  ```
- Add single `<SelectRoot>` outside the loop, controlled by `activeEditMember` state
- Position the select relative to the clicked badge using a ref or Ark Popover with manual anchor
- On value change: call existing `handleRoleChange(member, newRole)`, clear `activeEditMember`

**Unit 5: Memoize add/invite form selects**

**Files:** `components/creator/team-section.tsx`

- Wrap the add-member and invite forms in `React.memo()` wrapper components
- These selects are static (always 3 role options) and don't depend on member list state
- Prevents re-render when member list changes

**Expected impact:** Before: 12+ SelectRoot instances for 10-member team, noticeable lag on mount. After: 3 SelectRoot instances max (1 shared for role changes + 2 in forms), sub-100ms render.
