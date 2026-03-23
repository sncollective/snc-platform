# Performance: Bundle Awareness

> Keep client bundles lean by using lighter imports and avoiding unnecessary dependencies.

## What to Flag

- `import { z } from "zod"` in `apps/web/` — should be `zod/mini` per project convention (full zod is ~14kB larger)
- Barrel imports (`import { ... } from "@some/lib"`) when only one export is needed and the library supports deep imports
- Dependencies over 50kB (minified) that have lightweight alternatives for the specific use case

## What NOT to Flag

- `zod` imports in `packages/shared/` or `apps/api/` — full zod is correct outside the web bundle
- Tree-shakeable imports where the bundler handles dead code elimination
- Dev dependencies (only runtime client bundle matters)
- Imports from `@snc/shared` — this is the project's own shared package and is already managed

## From This Codebase

**Not flaggable**: `components/booking/booking-form.tsx` line 5 — `import { z, minLength, maxLength, safeParse } from "zod/mini"` (correct).

**Not flaggable**: `components/content/content-form.tsx` line 4 — `import { z, safeParse } from "zod/mini"` (correct).

**Not flaggable**: `components/calendar/event-form.tsx` line 7 — `import { z, minLength, maxLength, safeParse } from "zod/mini"` (correct).

**Not flaggable**: `packages/shared/` uses full `zod` — correct, the shared package compiles separately.

**Flaggable pattern** (synthetic):
```typescript
// BAD: full zod in web app
import { z } from "zod";
const schema = z.object({ name: z.string() });

// GOOD: zod/mini in web app
import { z } from "zod/mini";
const schema = z.object({ name: z.string() });
```

## Confidence

- `zod` instead of `zod/mini` in web app → **high** (Fix lane — direct swap, no API difference for common usage)
- Heavy dependency with lightweight alternative → **low** (Backlog lane — needs research)
