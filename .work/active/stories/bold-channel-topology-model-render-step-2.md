---
id: bold-channel-topology-model-render-step-2
kind: story
stage: review
tags: [refactor, streaming, playout]
release_binding: null
depends_on: [bold-channel-topology-model-render-step-1]
gate_origin: refactor-design
created: 2026-06-13
updated: 2026-06-13
parent: bold-channel-topology-model-render
---

# Step 2: Typed topology module (pure, additive)

Introduce `apps/api/src/services/playout-topology.ts` — the typed document describing the full playout topology. Pure data assembly: DB rows in, topology value out. No DB, no filesystem, no render strings.

**Files:** new `apps/api/src/services/playout-topology.ts`, new `apps/api/tests/services/playout-topology.test.ts`. No existing file changes (additive — nothing consumes it yet).

**Target state (shape, not verbatim):**

```ts
/** A value Liquidsoap resolves at .liq runtime via environment.get — never resolved at render time. */
export interface EnvRef { readonly envVar: string; readonly default: string; }

export interface PlayoutChannelTopology {
  readonly id: string;                 // DB UUID — harbor URL paths use this verbatim
  readonly name: string;
  readonly srsStreamName: string;
  readonly liqVar: string;             // "ch_<uuid with - → _>" (current liqId scheme)
  readonly queueId: string;            // "channel-<uuid>"
  readonly harborPaths: { readonly queue: string; readonly skip: string; readonly nowPlaying: string };
  readonly trackEventPath: string;     // "/api/playout/channels/<uuid>/track-event"
}

export interface PlayoutTopology {
  readonly harborPort: 8888;
  readonly srsRtmpPort: 1935;
  readonly broadcastInputPort: 1936;
  readonly env: {                      // liq-runtime references, render emits environment.get
    readonly playoutKey: EnvRef; readonly srsHost: EnvRef; readonly apiHost: EnvRef;
    readonly apiPort: EnvRef; readonly callbackSecret: EnvRef;
    readonly sncTvStream: EnvRef;      // CHANNEL_SNCTV_STREAM, default = SNC_TV_BROADCAST.srsStreamName
  };
  readonly channels: readonly PlayoutChannelTopology[];
  readonly broadcast: {
    readonly queueId: "snc-tv-queue";
    readonly fallbackSourceVar: string; // "<first channel liqVar>_source" | "mksafe(blank())"
  };
}

export const buildPlayoutTopology = (rows: readonly PlayoutChannelRow[]): PlayoutTopology => ...
```

**Implementation notes:**
- `SNC_TV_BROADCAST` stays in `services/channels.ts` (landed by refactor-playout-stream-names-dedup); the topology **imports** it for the `sncTvStream` default. Don't churn the fresh seam — ownership moves only when the unified-channel-model epic re-shapes it.
- `broadcast.queueId` is its **own datum**, not derived from the stream name. Deriving `"<stream>-queue"` would assert a coupling that doesn't exist: `CHANNEL_SNCTV_STREAM` overrides the stream name at .liq runtime, but the queue id is baked at render time and doesn't follow.
- The env block models *references* (`environment.get(var, default)`), never resolved values — render-time resolution would change behavior under container env.
- Unit-test the pure builder directly: liqVar/queueId/path construction, fallback selection for 0/1/N rows, env defaults.

**Acceptance criteria:**
- [ ] Build + API unit suite pass (including step-1 goldens, untouched)
- [ ] `buildPlayoutTopology` has direct unit tests with no mocks
- [ ] No existing module imports the new file yet

**Risk:** Low — additive only.
**Rollback:** delete the two new files.

## Implementation record (2026-06-13)

`playout-topology.ts` landed with `EnvRef` / `PlayoutChannelRow` / `PlayoutChannelTopology` / `PlayoutTopology` types, `harborChannelPaths` (exported early — step 4 consumes it), and pure `buildPlayoutTopology`. Only import is `SNC_TV_BROADCAST` from `channels.ts` per the design decision. 7 direct unit tests, no mocks; typecheck green. Nothing imports the module yet.
