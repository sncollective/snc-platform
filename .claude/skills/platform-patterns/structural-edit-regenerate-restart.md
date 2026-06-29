# structural-edit-regenerate-restart

Persist render-time-static playout/editorial changes, then regenerate Liquidsoap config and restart.

## When to use
Use when an operation changes rendered `.liq` topology/config rather than live mutable state.

## Instances
- `apps/api/src/services/editorial-control.ts:75` — `setMode` persists mode, then returns `regenerateAndRestart()` at line 85.
- `apps/api/src/services/editorial-control.ts:180` — `setManualTier` validates/persists manual pin, then restarts at line 215.
- `apps/api/src/services/editorial-control.ts:230` — `setTierEnabled` persists enabled flag, then restarts at line 237.
- `apps/api/src/services/editorial-control.ts:268` — `addCarryEdge` creates a tier, then restarts at line 281.

## Canonical sketch
```ts
export const structuralEdit = async (input): Promise<Result<void, AppError>> => {
  const result = await persistRenderedState(input);
  if (!result.ok) return result;
  return regenerateAndRestart();
};
```

## Anti-patterns
Don't use for live-only mutations (`armQueue`) that Liquidsoap can apply without regenerating; don't restart before the persisted config write succeeds.
