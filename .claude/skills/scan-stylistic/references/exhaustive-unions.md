# Style: Exhaustive Unions

> Use exhaustive switch (`never`-default) or `Record<Union, T>` for discriminated union variants.

## Motivation

When you match on a discriminated union, TypeScript can verify you've handled every case — but
only if you ask it to. An exhaustive switch with a `never`-default turns a missing case into a
compile error, not a runtime bug. Similarly, `Record<Union, T>` forces every variant to have
a value. This matters when adding new content types, upload statuses, or booking states — the
compiler tells you everywhere that needs updating.

## Before / After

### From this codebase: upload reducer (exhaustive switch)

**Before:** (actual code from `apps/web/src/contexts/upload-context.tsx`)
```typescript
type UploadAction =
  | { readonly type: "ADD_UPLOAD"; readonly id: string; readonly filename: string }
  | { readonly type: "UPDATE_PROGRESS"; readonly id: string; readonly progress: number }
  | { readonly type: "SET_STATUS"; readonly id: string; readonly status: ActiveUpload["status"] }
  | { readonly type: "REMOVE_UPLOAD"; readonly id: string }
  | { readonly type: "CLEAR_COMPLETED" }
  | { readonly type: "TOGGLE_EXPANDED" };

export function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case "ADD_UPLOAD":      { /* ... */ }
    case "UPDATE_PROGRESS": { /* ... */ }
    case "SET_STATUS":      { /* ... */ }
    case "REMOVE_UPLOAD":   { /* ... */ }
    case "CLEAR_COMPLETED": { /* ... */ }
    case "TOGGLE_EXPANDED": return { ...state, isExpanded: !state.isExpanded };
  }
}
```
TypeScript infers the return type covers all cases (no implicit `undefined`). Adding a new
action type without a case would cause a type error.

### From this codebase: content type badge (Record pattern)

**Before:** (actual code from `apps/web/src/components/content/content-card.tsx`)
```typescript
const TYPE_BADGE_LABELS: Record<FeedItem["type"], string> = {
  video: "VIDEO",
  audio: "AUDIO",
  written: "POST",
};
```
`Record<FeedItem["type"], string>` ensures every content type has a label. If a new type
is added to the union, this line fails to compile until updated.

### Synthetic example: non-exhaustive switch

**Before:**
```typescript
function getStatusColor(status: BookingStatus): string {
  switch (status) {
    case "pending":  return "yellow";
    case "approved": return "green";
    case "denied":   return "red";
    default:         return "gray";  // silently swallows new statuses
  }
}
```

**After:**
```typescript
function getStatusColor(status: BookingStatus): string {
  switch (status) {
    case "pending":  return "yellow";
    case "approved": return "green";
    case "denied":   return "red";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
```
If `BookingStatus` gains a new variant (e.g., `"cancelled"`), TypeScript errors on the
`never` assignment, pointing you to the exact switch that needs updating.

**Alternative — Record lookup:**
```typescript
const STATUS_COLORS: Record<BookingStatus, string> = {
  pending:  "yellow",
  approved: "green",
  denied:   "red",
};

function getStatusColor(status: BookingStatus): string {
  return STATUS_COLORS[status];
}
```

## Exceptions

- **Truly open-ended strings** — if the discriminant is `string` (not a union), exhaustive checking doesn't apply. Use a default case.
- **External API responses** — Stripe webhook event types, Shopify GraphQL responses, etc. may add new variants without warning. Use a `default` that logs a warning rather than crashing.
- **Catch-all with logging** — sometimes a default is intentional for forward compatibility. In that case, log the unhandled variant: `default: { logger.warn({ status }, "Unknown status"); return "gray"; }`

## Scope

- Applies to: switch statements and lookup objects on discriminated union types (`type`, `status`, `kind` discriminants)
- Does NOT apply to: `if/else` chains that check a single variant (not full dispatch), external API event handling where forward compatibility matters
