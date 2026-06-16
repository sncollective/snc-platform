---
id: unified-channel-model-editorial-engine
kind: feature
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model
depends_on: [unified-channel-model-identity-lifecycle]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-16
---

# Editorial engine — source tiers, manual/auto mode, live switching

## Brief
Give every channel an editorial config and make the playout engine execute it. Source
tiers per channel: live input, queue, pool, and **channel-as-source** (another channel
referenced with priority — the generalization of the hardcoded S/NC TV fallback at what
was `liquidsoap-config.ts:192`, now the broadcast block in `liquidsoap-render.ts`).
Channel-as-source needs cycle detection; the graph is shallow in practice (epic carry-model
decision). Control plane: **manual | auto** mode per channel — the architectural
commitment; specific control verbs (staged queue with arm/take, event pinning) are derived
from the workshop scenarios during this feature's design pass ("build a queue while the
pool rotates, switch over when ready"; "choose the scheduled event over the live creator"
— both expressible without a playout reset).

**The design pass MUST open with the no-restart switching spike** (epic risk, named): can
editorial changes (mode flips, source priority changes, queue arm/take) apply via live
mechanisms — Liquidsoap interactive variables / harbor-driven predicates inside a
persistent pipeline — versus supervised start/stop of per-channel pipelines
(airs-when-programmed lifecycle)? The spike settles the mechanism before any
implementation units are cut; the topology module + pure render (landed) is the seam the
chosen mechanism renders through. Fallback posture if the spike disappoints: retain
regenerate-and-restart for channel CRUD, scope live switching to within-pipeline source
changes — degraded but shippable, recorded as an explicit behavior decision.

Does NOT cover: re-programming S/NC TV onto this engine (sibling `snctv-composition` is
the first consumer and the output-equivalence gate); any editorial UI (the shared surface
is `playout-admin-redesign`'s, per its reframe); schedule/calendar tier (deferred by epic
decision — the model leaves room as a future source type).

## Epic context
- Parent epic: `unified-channel-model`
- Position in epic: the engine and the riskiest child — `snctv-composition` and
  `creator-enablement` consume it. Builds on `identity-lifecycle`'s schema for editorial
  config storage and on the landed topology/render seam.

## Foundation references
- `docs/streaming.md` — current engine architecture, harbor control API
- `.claude/skills/liquidsoap-v2/SKILL.md` — Liquidsoap capability reference; see reference.md
  §Dynamic Topology (added 2026-06-16 from the spike — `source.dynamic`, ref-driven `switch()`,
  `switch.selected()`, `interactive.*`, runtime attach/detach)
- Epic body `## Decisions` — carry model, control model, airing model (locked at workshop)

## Spike outcome (2026-06-16) — the no-restart switching spike is SETTLED

The mandated opening spike ran against the live Liquidsoap 2.4.2 container (throwaway off the
prod image; prod untouched, 0 restarts) and was extended into a source-dive against the
tag-pinned 2.4.2 tree. **Result: live editorial switching works.** Full findings + file:line
evidence are in the durable position `.research/analysis/positions/editorial-engine-switching-mechanism.md`.
Read it before designing. Headlines:

- **Editorial control (mode, priority, arm/take): live, no restart** — ref()-backed `switch()`
  predicates re-evaluate every frame at `track_sensitive=false`; harbor mutates the ref.
- **Per-channel content swap: live** via `source.dynamic` (getter returns `null`=keep / source=swap;
  child need not pre-exist).
- **Channel CRUD (add/remove whole channel): runtime attach/detach IS possible**, with one hard
  constraint — if the *last* output detaches the clock thread exits and won't auto-restart.
  Resolution: keep an always-present sentinel output (the always-on S/NC TV broadcast output
  already serves this). The epic's "fallback if spike disappoints" does NOT activate.
- **Observe via `switch.selected()`, never `on_metadata`/`on_track`** (the latter are blind to
  mid-track re-selection — cost spike time).

### Design-pass forks the spike surfaced (decide in this design, with the user)

1. **CRUD mechanism — SETTLED (2026-06-16): regenerate-and-restart now, runtime-ready later.**
   Channel CRUD uses regenerate-and-restart (re-render `.liq` + restart); runtime attach/detach is
   NOT adopted in v1 but the seam is kept ready for it. Rationale + the three seam constraints
   (broadcast output = documented sentinel; pure render; restart-agnostic control plane) are in the
   position `.research/analysis/positions/editorial-engine-switching-mechanism.md` §CRUD mechanism.
   The design pass implements this, it does not re-decide it. (Spike proved runtime CRUD *possible*;
   the editorial UX is live in both, so runtime CRUD bought only gapless structural add/remove — not
   worth the standing clock-exit invariant + least-tested paths for a rare admin action now.)
2. **Control plane (OPEN):** bespoke per-channel harbor endpoints (status quo pattern in
   `liquidsoap-render.ts`) **vs** the built-in `interactive.harbor` control surface. Must be
   restart-agnostic (seam constraint 3 above) regardless of which. Decide in the design pass.
3. **Airs-when-programmed × clock-exit — SETTLED via #1.** Under regenerate-and-restart the
   zero-output clock-exit constraint does not bind; the broadcast output is the documented sentinel
   that keeps the runtime-CRUD path available later. No open question remains here.
4. **Version dependency — RESOLVED by the audit + upgrade story.** The Liquidsoap version/gap audit
   ran (campaign `liquidsoap-version-capability-audit`); recommendation is upgrade 2.4.2 → 2.4.5
   (story `research-handoff-liquidsoap-version-capability-audit-1`, filed). 2.4.2's bugs
   (skip-from-harbor crossfade crash #5194, clock-detach-while-running #5051, `harbor.remove_http_handler`)
   are **latent** for the chosen regenerate-and-restart design — none is on a path v1 exercises — so
   this is a **soft dependency**: the upgrade should land first as good hygiene, but does not block
   the v1 design. It becomes a hard dependency only if a later iteration adopts runtime CRUD or
   crossfades.

## Design decisions (design pass, 2026-06-16)

The two forks the spike left open are resolved here (user-confirmed; "surface evidence, user decides"):

- **Control plane: bespoke harbor endpoints (extend the landed pattern), NOT `interactive.harbor`.**
  The editorial control traffic is three kinds — scalar state sets (mode/priority/arm), operations
  (queue push, skip), and introspection (`switch.selected()` now-selected). `interactive.harbor`
  only expresses the scalar subset, so ops + introspection stay bespoke regardless; adopting it would
  create a **split** control plane (two mechanisms, two auth stories, generic key/value wire shape,
  manual global-var namespacing per channel). Bespoke harbor handlers (already the landed pattern in
  `liquidsoap-render.ts` + the typed `liquidsoap-client.ts`) cover all three kinds uniformly, keep the
  `Result`/`AppError` REST shape, and let us add the per-handler `?secret=` guard the `/admin/shutdown`
  endpoint already uses. Rejected `interactive.harbor`'s only wins (skip ~3-line scalar setters; a free
  debug webpage) are minor at this variable count; a debug GET can be bespoke if ever wanted.
- **Editorial-config storage: normalized relational + FKs, NOT a JSONB blob.** Real FKs on the
  channel-as-source edges give DB-level integrity for cycle detection + cascade-on-delete (the carry
  model is the epic's core), reverse-lookup queryability ("who carries channel X"), and a typed Drizzle
  schema → generated contracts (platform SSOT). It joins cleanly to the existing `channel_content`
  (pool) / `playout_queue` tables. JSONB rejected: no DB FK on carry edges (cycle/cascade become
  app-only), not queryable, validation only in app Zod.

## Architectural choice

Generalize the current degenerate per-channel block — `fallback(track_sensitive=false, [queue, mksafe(blank())])`
(`liquidsoap-render.ts:24`) — into a **ref-driven `switch()` over editorial tiers**, driven by per-channel
editorial config stored relationally, executed through the **landed pure render seam** (`playout-topology.ts`
→ `liquidsoap-render.ts`), and controlled via **bespoke harbor endpoints**. The high-frequency editorial
verbs (mode/priority/arm/take, content swap) mutate live `ref()` cells with no restart (settled spike);
**structural** changes (add/remove a tier, add/remove a channel-as-source edge, channel CRUD) go through the
existing **regenerate-and-restart** path (re-render `.liq` + restart — the path already invoked on channel
create/delete per the render header). This is the restart-agnostic control plane the position's seam
constraint 3 requires.

**Scope boundary (carried from the brief):** this feature builds the general engine and applies it to
playout/creator channels. It does **NOT** re-express the static S/NC TV broadcast block — that hardcoded
carry (`snc_tv = fallback([live_source, snc_tv_queue, fallbackSourceVar, blank()])`,
`liquidsoap-render.ts:154`) stays as-is; sibling `snctv-composition` migrates it later as the
output-equivalence gate. No editorial UI (playout-admin-redesign owns the surface). Schedule tier deferred.

## Implementation Units

### Unit 1 — Editorial config data model + cycle detection
**Files**: `apps/api/src/db/schema/editorial.schema.ts` (new), `apps/api/src/services/editorial-config.ts`
(new), `apps/api/src/services/editorial-graph.ts` (new) · **Story**: `…-config-schema`

```ts
// editorial.schema.ts — text ids + channels.id FK cascade, consistent with channel_content/playout_queue
export const channelEditorialConfig = pgTable("channel_editorial_config", {
  channelId: text("channel_id").primaryKey().references(() => channels.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("auto"),            // "manual" | "auto"
  manualTierId: text("manual_tier_id"),                    // FK → channelEditorialTiers.id, onDelete set null
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const channelEditorialTiers = pgTable("channel_editorial_tiers", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  tierType: text("tier_type").notNull(),                   // "live" | "queue" | "pool" | "channel-as-source"
  priority: integer("priority").notNull(),                 // ordering in the switch; 0 = highest
  sourceChannelId: text("source_channel_id").references(() => channels.id, { onDelete: "cascade" }),
}, (t) => [
  uniqueIndex("channel_editorial_tiers_channel_priority_idx").on(t.channelId, t.priority),
  index("channel_editorial_tiers_source_idx").on(t.sourceChannelId),  // reverse lookup "who carries X"
]);
```
- `sourceChannelId` non-null **iff** `tierType = "channel-as-source"` (app-validated; a CHECK is a
  follow-up if drift appears). **`onDelete: "cascade"`** on `sourceChannelId` is deliberate: deleting a
  carried channel removes the carry tier from its carriers (the carry is meaningless without its source;
  the switch keeps its lower tiers + the `mksafe` tail, so carriers stay valid) — and the carriers
  regenerate-and-restart. Rejected `restrict` (blocks carried-channel deletion on an unrelated config)
  and `set null` (orphans the tier into an invalid no-source channel-as-source).
- **Migration via `drizzle-kit generate`** (never hand-written — `drizzle-migrations.md`).
- `editorial-config.ts`: typed CRUD + `getEditorialConfig(channelId)` and `getAllEditorialConfigs()`
  (for topology build), returning `Result<…, AppError>`.
- `editorial-graph.ts`: pure `detectChannelSourceCycles(edges): Result<void, AppError>` — DFS/topo-sort
  over channel-as-source edges; on a cycle returns the path. Run at config-write time (reject) and again
  defensively at topology build. Graph is shallow (epic carry-model decision).

**Acceptance**: tables + migration generated and applied; config CRUD round-trips; cycle detection rejects
self-loop / 2-cycle / 3-cycle and passes DAGs (returns the offending path).

### Unit 2 — Topology model extension
**File**: `apps/api/src/services/playout-topology.ts` · **Story**: `…-topology`

Extend `PlayoutChannelTopology` with the editorial config and grow `buildPlayoutTopology` to take editorial
config alongside channel rows. **Trickiest unit** — it resolves channel-as-source into render-ready data:

```ts
export type EditorialTier =
  | { readonly type: "live" }
  | { readonly type: "queue"; readonly queueId: string }
  | { readonly type: "pool"; readonly poolQueueId: string }     // pool fed via request.dynamic from channel_content
  | { readonly type: "channel-as-source"; readonly sourceLiqVar: string };  // resolved to the referenced channel's _source var

export interface PlayoutChannelTopology { /* …existing… */
  readonly mode: "manual" | "auto";
  readonly manualTierIndex: number | null;          // index into tiers when mode = manual
  readonly tiers: readonly EditorialTier[];          // priority order (0 = highest)
}
```
- Resolve `channel-as-source` tiers to the referenced channel's `liqVar`-derived `_source`, and **emit
  channel blocks in topological order** so a referenced channel's `_source` is defined before any block
  that references it. Run `detectChannelSourceCycles` first; a cycle is a hard build error (a valid topo
  order can't exist with one). Pure — no DB/fs/config reads (caller passes config in).

**Acceptance**: pure unit tests — tiers map to typed union; channel-as-source resolves to the right
`_source` var; blocks are topologically ordered; cycle input is rejected; mode/manualTier carried through.

### Unit 3 — Render extension (the `switch()` + control endpoints)
**File**: `apps/api/src/services/liquidsoap-render.ts` · **Story**: `…-render`

`renderChannelBlock` emits, per channel, in place of today's `fallback`:
- tier sources (`request.queue` for queue, `request.dynamic`/`playlist` for pool, `input.rtmp` for live,
  the referenced channel's `_source` for channel-as-source);
- control refs: `${vid}_mode = ref("…")`, `${vid}_priority = ref(…)`, `${vid}_armed = ref(false)`,
  initialized from persisted config (restart-agnostic — a restart restores state);
- the ref-driven `switch(track_sensitive=false, [...])`: in **auto**, priority-ordered tier predicates;
  in **manual**, a predicate pinning `manualTierIndex`; always an `mksafe(blank())` ready tail (infallible);
- now-playing read from **`switch.selected()`** (NOT `on_metadata` — position gotcha #1);
- bespoke harbor endpoints — existing POST `…/queue`, POST `…/skip`, GET `…/now-playing` (now reading
  selected), **plus** POST `…/mode`, POST `…/priority`, POST `…/arm` — each with the `?secret=` guard.

Render stays **pure + byte-deterministic**. The S/NC TV broadcast block is untouched (scope boundary).

**Acceptance**: golden `.liq` tests (byte-identical for identical topology); switch/refs/endpoints/selected
shapes present; existing channel/broadcast goldens for unchanged paths still pass.

### Unit 4 — Control client extension (API → harbor)
**File**: `apps/api/src/services/liquidsoap-client.ts` + `playout-topology.ts` (`harborChannelPaths`) ·
**Story**: `…-control-client`

Extend `LiquidsoapClient` with `setMode(channelId, mode)`, `setPriority(channelId, tier)`,
`armQueue(channelId, armed)`, all `Promise<Result<void, AppError>>`, calling the new bespoke endpoints with
the `?secret=` query; extend `harborChannelPaths` with `mode`/`priority`/`arm`; mirror in the stub client.

**Acceptance**: adapter tests (mock fetch) for each verb incl. failure/timeout → `AppError`; stub parity.

### Unit 5 — Editorial control service + routes + restart wiring
**Files**: `apps/api/src/services/editorial-control.ts` (new), `apps/api/src/routes/playout.routes.ts`
· **Story**: `…-control-service`

- `editorial-control.ts`: each live verb **persists to DB and live-mutates** via the client (durable +
  immediate; restart-agnostic). **Structural** edits (tier add/remove, carry-edge add/remove, channel
  CRUD) persist then trigger the **existing regenerate-and-restart** path. Validates against config +
  role/ownership.
- Routes: thin role-scoped handlers delegating to the service — **happy-path + auth-failure tests each**
  (AGENTS testing convention). The editorial UI is out of scope; these are the verbs it will consume.

**Acceptance**: route happy-path + auth-failure; service persists + calls client for live verbs; structural
edit triggers regenerate-and-restart; manual/auto + arm/take scenarios from the workshop are expressible
without a playout reset.

## Implementation Order
1. `…-config-schema`  (deps: none)
2. `…-topology`       (deps: config-schema)
3. `…-render`         (deps: topology)
4. `…-control-client` (deps: render)
5. `…-control-service`(deps: control-client, config-schema)

A deliberate chain on the production streaming path (epic decision: each link gates the next; beats
artificial parallelism here). Soft-precede with the landed `…-version-capability-audit-1` (2.4.5) upgrade.

## Testing
- **config-schema**: cycle-detection unit matrix (self/2/3-cycle reject, DAG pass, path returned); config
  CRUD round-trip; generated migration applies.
- **topology**: pure unit — tier mapping, channel-as-source resolution, topological ordering, cycle reject.
- **render**: golden `.liq` (byte-identical); switch/ref/endpoint/selected presence; unchanged goldens hold.
- **control-client**: harbor adapter (mock fetch), Result/AppError/timeout, stub parity.
- **control-service**: route happy-path + auth-failure; persist+mutate; structural→restart. The live-mutate
  round-trip against a real pipeline is an integration/staging check (no container in unit).

## Risks
- **Channel-as-source resolution + topo ordering** (riskiest): a referenced `_source` must be defined before
  use; cycle detection guarantees a valid order exists. Mitigated by Unit 2's pure tests + cycle reject.
- **Intermediate-tier downward "take glitch"** (position gotcha #2): a bare non-holding source can resolve
  to the `mksafe` tail on a downward switch. Real sources (armed `request.queue`, connected `input.rtmp`)
  hold readiness; **validate against real sources at integration/staging** before relying on intermediate
  downward switches (position `revisit_if`).
- **Now-playing must read `switch.selected()`**, not `on_metadata` (blind to mid-track re-selection). The
  render change moves now-playing onto selected state; the current `on_metadata` uri/title refs stay only
  for the track-event webhook.
- **Live mutation lost on restart** if not persisted: control verbs persist to DB AND mutate live; rendered
  refs init from persisted config. Designed-for, not incidental.
- **v2.4.5 soft-dep**: design targets 2.4.5 primitives but is latent-safe on 2.4.2 for v1 (no
  crossfade/runtime-detach). Upgrade story should land first as hygiene.
