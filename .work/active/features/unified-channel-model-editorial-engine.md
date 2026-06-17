---
id: unified-channel-model-editorial-engine
kind: feature
stage: review
tags: [streaming, playout]
parent: unified-channel-model
depends_on: [unified-channel-model-identity-lifecycle]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-17
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

## Design decisions (design pass, 2026-06-16; editorial model revised 2026-06-17)

Three forks are resolved here (user-confirmed across the design pass; "surface evidence, user decides"):

- **Editorial model: one continuous program source per channel, NOT separate queue/pool tiers**
  (revised 2026-06-17). Queue and pool are not sibling tiers you switch between — they are one
  **program** source: an operator-editable queue that **auto-fills from a pool** when not curated. So the
  source taxonomy is `live` (own stream key) · `queue` (operator queue + pool auto-fill) ·
  `channel-as-source` (carry another channel) — **`pool` is folded into `queue`, not its own tier**. Three
  editorial layers: platform-admin owns channel CRUD; the channel editor sets **mode** (`manual` = pin one
  source · `auto` = readiness fallback over the **enabled** sources) or turns the channel **off**
  (= existing `channels.isActive=false`); the operator curates the queue (reorder/remove/add). **Auto = the
  line-192 generalization** (`fallback([live, queue, channel-as-source, blank])`), self-running by
  readiness — NOT an operator-set priority index. *(Rejected: queue & pool as separate switch tiers driven
  by a live `priority` ref — conflates "auto" with manual selection, isn't self-running, needs an external
  driver. The unified-program model dissolves the auto-semantics ambiguity that the first cut created.)*
  **Per-channel constraints:** creator channels = own source only (their key + their queue, no carry);
  admin channels = stream key **XOR** channel-as-source (mutually exclusive, a config-time choice applied
  via regenerate-and-restart) + their queue. **Pool scope — MVP reality (revised at control-service, 2026-06-17):**
the pool draws from the channel's **curated `channel_content` rows** (LRP rotation, `channelId`-bounded), NOT
yet the ownership-scoped library auto-draw (creator → own; admin → all creators) the model intends. The
`poolContentScope` resolver exists but is unused at query time. The ownership-scoped auto-draw is **deferred
with the admin-content/hidden-creator work** (set aside per the design discussion) — once admin content lives
under a hidden/system creator, the all-creators scope falls out for free. Scheduled tier deferred.
- **Control plane: bespoke harbor endpoints (extend the landed pattern), NOT `interactive.harbor`.**
  The control traffic is three kinds — scalar state sets (mode / arm-take / manual-pin), operations
  (queue push, skip), and introspection (`switch.selected()` now-selected). `interactive.harbor`
  only expresses the scalar subset, so ops + introspection stay bespoke regardless; adopting it splits the
  plane (two mechanisms, two auth stories, generic key/value wire shape). Bespoke handlers (the landed
  pattern in `liquidsoap-render.ts` + the typed `liquidsoap-client.ts`) cover all three uniformly, keep the
  `Result`/`AppError` shape, and reuse the per-handler `?secret=` guard the `/admin/shutdown` endpoint uses.
- **Editorial-config storage: normalized relational + FKs, NOT a JSONB blob.** Real FKs on the
  channel-as-source edges give DB-level cycle/cascade integrity (the carry model is the epic's core),
  reverse-lookup queryability, and typed Drizzle contracts (platform SSOT). Joins cleanly to the existing
  `channel_content` (pool) / `playout_queue` tables. JSONB rejected: no DB FK on carry edges (cycle/cascade
  become app-only), not queryable, validation only in app Zod.

## Architectural choice

Generalize the degenerate per-channel `fallback(track_sensitive=false, [queue, mksafe(blank())])`
(`liquidsoap-render.ts:24`) into a per-channel **readiness fallback over the channel's enabled editorial
sources**, driven by relational config, executed through the landed pure render seam (`playout-topology.ts`
→ `liquidsoap-render.ts`), controlled via **bespoke harbor endpoints**.

- **`${vid}_source` (auto)** = `switch(track_sensitive=false, [ …enabled sources in config order…,
  ({true}, mksafe(blank())) ])` with all-true (readiness) predicates — i.e. a `fallback`: the
  highest-priority *ready* source wins automatically (live if connected → queue if it has content → carry →
  blank). **Manual mode** pins one source via a `${vid}_manual` ref. The only live refs are `${vid}_mode`
  (auto|manual) and `${vid}_manual` (pinned source index) — **no live `priority` ref**; source *order* is
  config (reorder = regenerate-and-restart, a rare structural edit).
- **The `queue` source itself** = `fallback(track_sensitive=true, [ ${vid}_queue, ${vid}_pool ])`: the
  operator queue plays track-by-track; when empty it falls to the pool; a freshly-queued item is taken at
  the next track boundary ("switch over when ready"). `${vid}_queue` = `request.queue` (operator
  push/reorder/skip); `${vid}_pool` = the auto-fill — **least-recently-played** `request.dynamic` rotation
  over the channel's **ownership-scoped** `channel_content` (creator channel → that creator's content;
  admin channel → all creators'). The **arm/take** verb gates whether the queue participates as the
  channel's active source in auto, so you can build it while the pool (or another source) airs, then take.
- **High-frequency verbs** (mode, arm/take, manual-pin) mutate live refs, no restart. **Structural** edits
  (enable/disable a source, reorder, add/remove a carry edge, channel CRUD, switch key↔carry) persist then
  regenerate-and-restart. Restart-agnostic control plane (seam constraint 3).

**Scope boundary:** builds the general engine for playout/creator channels. Does **NOT** re-express the
static S/NC TV broadcast block (`snc_tv = fallback(...)`, `liquidsoap-render.ts:154`) — `snctv-composition`
migrates it later; S/NC TV is just an always-exists admin channel under this model. No editorial UI
(playout-admin-redesign owns it). Schedule deferred. **Admin-uploaded content out of scope** — a later
hidden/system-creator story; its content flows into admin pools for free via the all-creators scope, so
this feature implements only the pool-scope query.

## Implementation Units

### Unit 1 — Editorial config data model + cycle detection
**Files**: `apps/api/src/db/schema/editorial.schema.ts`, `apps/api/src/services/editorial-config.ts`,
`apps/api/src/services/editorial-graph.ts` (all new) · **Story**: `…-config-schema`

Two changes from the first cut: `tierType` drops `pool` (folded into `queue`), and each tier gains an
**`enabled`** flag (which sources are in the auto readiness fallback). `mode` stays `"manual" | "auto"`
(off = `channels.isActive`); `manualTierId` = the pinned source in manual mode.

```ts
export const channelEditorialTiers = pgTable("channel_editorial_tiers", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  tierType: text("tier_type").notNull(),                   // "live" | "queue" | "channel-as-source"
  priority: integer("priority").notNull(),                 // config order in the fallback; 0 = highest
  enabled: boolean("enabled").notNull().default(true),     // included in the auto readiness fallback
  sourceChannelId: text("source_channel_id").references(() => channels.id, { onDelete: "cascade" }),
}, (t) => [
  uniqueIndex("channel_editorial_tiers_channel_priority_idx").on(t.channelId, t.priority),
  index("channel_editorial_tiers_source_idx").on(t.sourceChannelId),
]);
```
- `sourceChannelId` non-null **iff** `tierType="channel-as-source"`; **`onDelete: "cascade"`** (carried-channel
  deletion drops the carry tier from carriers, which regenerate-and-restart). Rejected `restrict`/`set null`.
  Migration via `drizzle-kit generate` (never hand-written).
- **Ownership validation (new):** creator channels may have only `live`(own key) + `queue` (no carry); admin
  channels may have `live` **XOR** `channel-as-source` + `queue`. Enforced on `editorial-config.ts` writes.
- `editorial-config.ts`: typed CRUD + `getEditorialConfig` + `getAllEditorialConfigs` (topology-shaped) +
  a **pool-scope resolver** (`poolContentScope(channel) → { creatorId } | { allCreators: true }` by
  ownership, for the pool query). `editorial-graph.ts`: pure cycle detection (unchanged from the prior cut).

**Acceptance**: tables + generated migration apply; `tierType` has no `pool`; `enabled` defaults true;
ownership validation (creator own-source-only; admin key-XOR-carry); cycle-detection matrix; pool-scope
resolver returns creator vs all-creators by ownership.

### Unit 2 — Topology model extension
**File**: `apps/api/src/services/playout-topology.ts` · **Story**: `…-topology`

```ts
export type EditorialTier =
  | { readonly type: "live" }
  | { readonly type: "queue"; readonly queueId: string; readonly poolScope: PoolScope } // queue carries its pool feed
  | { readonly type: "channel-as-source"; readonly sourceLiqVar: string };               // resolved _source var
// (no `pool` variant — the queue tier owns the pool feed)

export interface PlayoutChannelTopology { /* …existing… */
  readonly mode: "manual" | "auto";
  readonly manualTierIndex: number | null;
  readonly tiers: readonly EditorialTier[];          // ENABLED sources, config order (0 = highest)
}
```
- The `queue` tier carries the resolved `poolScope` (from `poolContentScope`) so the render can build the
  pool source. Drop disabled tiers (they're not in the fallback). Resolve `channel-as-source` → the
  referenced channel's `_source`; **emit channel blocks in topological order**; defensive cycle check.
  Pure — caller passes config in.

**Acceptance**: pure unit tests — tier mapping (no `pool` type; queue carries poolScope); disabled tiers
excluded; channel-as-source resolves; topological order; cycle reject; mode/manualTier carried through.

### Unit 3 — Render extension (the readiness fallback + control endpoints)
**File**: `apps/api/src/services/liquidsoap-render.ts` · **Story**: `…-render`

`renderChannelBlock` emits per channel:
- tier source vars: `live` → `input.rtmp`; `channel-as-source` → the referenced `_source`; **`queue` →
  `fallback(track_sensitive=true, [ ${vid}_queue, ${vid}_pool ])`** where `${vid}_queue` is a
  `request.queue` and `${vid}_pool` is a **least-recently-played `request.dynamic`** over the
  poolScope-filtered `channel_content`;
- control refs `${vid}_mode = ref("…")`, `${vid}_manual = ref(…)`, `${vid}_armed = ref(false)` — **no
  `priority` ref** — initialized from persisted config (restart-agnostic);
- **`${vid}_source`** = in **auto** a readiness fallback over the enabled sources in config order
  (`switch(track_sensitive=false, [ …({true}, src)… , ({true}, mksafe(blank())) ])`, with the queue source
  participating per `${vid}_armed`); in **manual** the `${vid}_manual`-pinned source; always the
  `mksafe(blank())` tail. Keep the `${vid}_source` var name (broadcast block references it);
- now-playing reads **`switch.selected()`** and returns a **serializable selected-source label** (id/name)
  **plus `elapsed`/`remaining`** (the UI needs progress — do NOT drop them);
- bespoke endpoints: POST `…/queue`, POST `…/skip`, GET `…/now-playing`, **plus** POST `…/mode`, POST
  `…/arm`, POST `…/manual` (**no `…/priority`**) — each `?secret=`-guarded.

Render stays **pure + byte-deterministic**. The S/NC TV broadcast block is untouched. **Goldens regenerate**
(render output changes) — verify the queue-only-default channel stays behaviorally equivalent to today.

**Acceptance**: regenerated goldens are correct (readiness-fallback shape, queue=fallback(queue,pool), refs,
selected-based now-playing with elapsed/remaining, mksafe tail, `${vid}_source` preserved, broadcast block
unchanged); queue-only default behaviorally equivalent; tests green.

### Unit 4 — Control client extension (API → harbor)
**File**: `apps/api/src/services/liquidsoap-client.ts` + `playout-topology.ts` (`harborChannelPaths`) ·
**Story**: `…-control-client`

Extend `LiquidsoapClient` with `setMode(channelId, mode)`, `armQueue(channelId, armed)` /
`takeQueue(channelId)`, `setManualTier(channelId, tierIndex)` (**drop `setPriority`**), all
`Promise<Result<void, AppError>>`, `?secret=`-guarded; **fix `getNowPlaying`** to the new shape (selected
label + elapsed/remaining). Extend `harborChannelPaths` with `mode`/`arm`/`manual`. Stub parity.

**Acceptance**: adapter tests per verb incl. failure/timeout → `AppError`; getNowPlaying parses the new
shape; stub parity.

### Unit 5 — Editorial control service + routes + restart wiring
**Files**: `apps/api/src/services/editorial-control.ts` (new), `apps/api/src/routes/playout.routes.ts`
· **Story**: `…-control-service`

- `editorial-control.ts`: live verbs (mode, arm/take, manual-pin) **persist + live-mutate** via the client;
  **structural** edits (enable/disable a source, reorder, carry add/remove, key↔carry switch, channel CRUD)
  persist then **regenerate-and-restart**; `isActive` toggles the channel off/on. The pool-scope query
  feeds the render. Validates role/ownership (creator own-source-only; admin key-XOR-carry).
- Routes: thin role-scoped handlers — happy-path + auth-failure tests each. Editorial UI out of scope.

**Acceptance**: route happy-path + auth-failure; live verbs persist + call client; structural edit triggers
regenerate-and-restart; the workshop scenarios ("build a queue while the pool rotates, take when ready" =
arm/take; "choose the event over the live creator" = manual-pin) are expressible without a playout reset.

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
  for the track-event webhook. **Serialization gotcha** (caught in the first render cut): `res.json` cannot
  serialize a raw `source` — return a selected-source **label** (id/name) derived from `.selected()`, and
  **keep `elapsed`/`remaining`** (the UI needs progress).
- **Editorial model revised 2026-06-17** (queue/pool unified into one program source; auto = readiness
  fallback). This reopened `config-schema` → `topology` → `render` (re-walked from the prior cut). Lower
  risk than greenfield — the prior code is the revision base — but the taxonomy change (`tierType` drops
  `pool`, gains `enabled`) and the render's pool/`request.dynamic` are net-new vs the first cut.

## Implementation summary (2026-06-17) — all 5 children done; feature → review

Built on the unified program-source model. All children reviewed + done:
- **config-schema** — `channel_editorial_config` + `channel_editorial_tiers` (`tierType` live/queue/channel-as-source,
  `enabled`, FKs); ownership validation (creator own-source / admin key-XOR-carry); `poolContentScope` resolver;
  cycle detection. Migrations 0029–0031.
- **topology** — `EditorialTier` (queue carries `poolScope`); enabled-tier filtering; channel-as-source resolution
  + topological order; edge-list-driven cycle check; typed errors.
- **render** — per-channel readiness-fallback `switch` (auto), `${vid}_manual` pin (manual), queue =
  `fallback(track_sensitive=true, [operator_queue, pool])`, pool = LRP `request.dynamic` → `pool/next`;
  `switch.selected()` now-playing (serializable label + elapsed/remaining); mode/arm/manual endpoints.
  **Validated against real Liquidsoap** (`liquidsoap --check`, exit 0).
- **control-client** — typed `setMode`/`armQueue`/`setManualTier` (`?secret=`-guarded); `selected` in now-playing.
- **control-service** — editorial-control verbs (persist + live-mutate; structural → regenerate-and-restart);
  the `pool/next` LRP callback endpoint; admin editorial routes.

**Verification**: unit suite 1777 pass; render typechecks on real Liquidsoap. **Pending (feature-level): an
end-to-end staging walk on a real running pipeline** (pool LRP rotation, multi-tier readiness fallback,
arm/take + manual-pin live, regenerate-and-restart) — runtime behavior unit tests + `--check` can't cover.

**Follow-ups (backlog, none blocking):** `editorial-render-followups` (multi-tier render untested; wire
`liquidsoap --check` into the suite; pool scope `channelId`-bounded vs ownership-scoped; `null()`→`null`;
`PoolScope` SSOT dup). Structural-edit routes + creator-scoped access deferred to playout-admin-redesign /
creator-enablement. S/NC TV broadcast block still static — `snctv-composition` migrates it.
- **Live mutation lost on restart** if not persisted: control verbs persist to DB AND mutate live; rendered
  refs init from persisted config. Designed-for, not incidental.
- **v2.4.5 soft-dep**: design targets 2.4.5 primitives but is latent-safe on 2.4.2 for v1 (no
  crossfade/runtime-detach). Upgrade story should land first as hygiene.
