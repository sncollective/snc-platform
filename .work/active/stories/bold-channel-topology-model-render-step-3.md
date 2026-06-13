---
id: bold-channel-topology-model-render-step-3
kind: story
stage: review
tags: [refactor, streaming, playout]
release_binding: null
depends_on: [bold-channel-topology-model-render-step-2]
gate_origin: refactor-design
created: 2026-06-13
updated: 2026-06-13
parent: bold-channel-topology-model-render
---

# Step 3: Pure render + rewire generateLiquidsoapConfig (the swap)

Extract the template literal into a pure render function over the topology and make `generateLiquidsoapConfig` a thin composition. The step-1 goldens must pass **byte-identical, snapshot files unchanged** — that is the entire review bar.

**Files:** new `apps/api/src/services/liquidsoap-render.ts`; `apps/api/src/services/liquidsoap-config.ts` (shrinks to IO orchestration).

**Current state:** `generateLiquidsoapConfig` = DB query + fallback policy + 110-line template literal (`liquidsoap-config.ts:107-218`).

**Target state:**

```ts
// liquidsoap-render.ts — pure; no imports beyond topology types
export const renderPlayoutLiq = (t: PlayoutTopology): string => { /* the template, fed only by t */ };

// liquidsoap-config.ts
export const generateLiquidsoapConfig = async (): Promise<string> => {
  const rows = await db.select({...}).from(channels).where(...);  // unchanged query
  logger.info({ channelCount: rows.length }, "Generating Liquidsoap config");
  return renderPlayoutLiq(buildPlayoutTopology(rows));
};
```

`getLiquidsoapConfigPath`, `regenerateAndRestart`, `writeConfigOnly`, `waitForHealth` keep their exact signatures and bodies — consumers (`register-workers.ts`, `playout-channels.routes.ts`, tests) see zero change.

**Implementation notes:**
- Move `escLiq` into the render module (it's a render concern); `liqId` logic lives in the topology builder (step 2) — render only consumes `liqVar`.
- Migrate the template mechanically: replace each inline expression with the topology field carrying the same value. Resist reformatting — whitespace is contract under the goldens.
- The `environment.get("X", default="Y")` lines render from `EnvRef`s; assert no topology env value is interpolated as a resolved value.
- Existing `liquidsoap-config.test.ts` `toContain` tests and the module-source portability test (`not.toContain("/workspaces/")`) must keep passing; the portability pin extends naturally to the new render module — add the same source check for `liquidsoap-render.ts`.

**Acceptance criteria:**
- [ ] Build + API unit suite pass
- [ ] All four step-1 golden snapshot files pass with **zero diff** (verify `git status` shows no snapshot changes)
- [ ] `renderPlayoutLiq` and `buildPlayoutTopology` are pure (no db/fs/config imports in either module beyond topology's `SNC_TV_BROADCAST` constant import)
- [ ] Public surface of `liquidsoap-config.ts` unchanged (same five exports, same signatures)

**Risk:** Medium — this is the production streaming path; mitigated entirely by the byte-identity goldens.
**Rollback:** `git revert` the commit — restores the string-builder; consumers never changed, so revert is clean.

## Implementation record (2026-06-13)

`liquidsoap-render.ts` landed (pure `renderPlayoutLiq`; `escLiq` + `envGet` moved in; imports topology types only). `liquidsoap-config.ts` shrank to IO orchestration — `generateLiquidsoapConfig` = query → `buildPlayoutTopology` → `renderPlayoutLiq`; the other four exports untouched. All four goldens pass with zero snapshot diff (`git status` clean on `__snapshots__/`); typecheck green; full API suite 1512/1512. Portability source pin extended to all three modules.
