# Style: Readonly at Boundaries

> `readonly` on React props, shared package types, and object/array function parameters.

## Motivation

Marking properties `readonly` at trust boundaries — where different parts of the system hand
data to each other — catches accidental mutation at compile time. This matters most for React
props (consumers shouldn't mutate parent state), shared types (cross-package contracts), and
function parameters (callers don't expect their objects modified). Internal locals don't need
it — `const` and TypeScript strict mode handle reassignment already.

## Before / After

### From this codebase: upload context types

**Before:** (actual code from `apps/web/src/contexts/upload-context.tsx`)
```typescript
export interface ActiveUpload {
  readonly id: string;
  readonly filename: string;
  readonly progress: number;
  readonly status: "uploading" | "completing" | "complete" | "error";
  readonly error?: string;
}

export interface UploadState {
  readonly activeUploads: readonly ActiveUpload[];
  readonly isUploading: boolean;
  readonly isExpanded: boolean;
}
```
This already follows the pattern — every property is `readonly`, and the array uses
`readonly ActiveUpload[]` to prevent push/pop.

### Synthetic example: missing readonly on shared type

**Before:**
```typescript
// packages/shared/src/booking.ts
export interface BookingSlot {
  startTime: string;
  endTime: string;
  serviceId: string;
  notes?: string;
}

export function validateSlot(slot: BookingSlot): Result<void, AppError> {
  // slot.startTime could be accidentally mutated here
}
```

**After:**
```typescript
// packages/shared/src/booking.ts
export interface BookingSlot {
  readonly startTime: string;
  readonly endTime: string;
  readonly serviceId: string;
  readonly notes?: string;
}

export function validateSlot(slot: Readonly<BookingSlot>): Result<void, AppError> {
  // slot properties are now protected from accidental mutation
}
```

## Exceptions

- **Builder/accumulator patterns** — objects that are intentionally built up step-by-step (e.g., constructing a Map in a `for...of` loop) don't need readonly on their intermediate shape.
- **Internal function locals** — `const row = { id, name }` inside a function body doesn't need readonly properties. `const` prevents reassignment; readonly on every local object is noise.
- **Test fixtures** — `makeMockUser(overrides?)` factories use spread to merge overrides; readonly on the factory's internal shape adds friction without catching real bugs.
- **Drizzle schema definitions** — Drizzle's `pgTable` definitions have their own type system; don't add readonly to column definitions.

## Scope

- Applies to: React component props, exported interfaces in `packages/shared/src/`, function parameters that accept objects or arrays
- Does NOT apply to: internal locals, test fixtures, Drizzle schema definitions, reducer action construction (the union type itself should be readonly, but the `dispatch({ type: "X" })` call site doesn't need it)
