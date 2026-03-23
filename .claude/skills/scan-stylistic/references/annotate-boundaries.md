# Style: Annotate Boundaries Only

> Type-annotate function return types and exports; let inference handle locals.

## Motivation

Explicit return types on exported functions serve as documentation and catch accidental type
widening — if the implementation changes, the return type forces you to notice. But annotating
every local variable (e.g., `const x: string = "hello"`) adds noise without catching real bugs.
TypeScript's inference is excellent for locals; fight it only at boundaries where the contract
matters.

## Before / After

### From this codebase: route handler with inferred locals

**Before:** (actual code from `apps/api/src/routes/dashboard.routes.ts`)
```typescript
async (c) => {
  const result = await getMonthlyRevenue(12);
  if (!result.ok) {
    throw result.error;
  }

  const monthly = result.value;          // inferred as MonthlyRevenue[]
  const now = new Date();                // inferred as Date
  const currentMonthKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`;
  const currentEntry = monthly.find(
    (m: MonthlyRevenue) => `${m.year}-${m.month}` === currentMonthKey,
  );
  const currentMonth = currentEntry?.amount ?? 0;

  return c.json({ currentMonth, monthly });
};
```
Locals are inferred — no redundant annotations. The function boundary (Hono handler) provides
the contract via `describeRoute` + Zod schema.

### From this codebase: over-annotated useState

**Before:** (actual code from `apps/web/src/components/content/content-form.tsx`)
```typescript
const [type, setType] = useState<ContentType>("audio");
const [visibility, setVisibility] = useState<Visibility>("public");
const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
```

**After:**
```typescript
const [type, setType] = useState<ContentType>("audio");      // ✓ keeps — ContentType narrows the union
const [visibility, setVisibility] = useState<Visibility>("public");  // ✓ keeps — Visibility narrows
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});  // simplified
```
Note: `useState<ContentType>` is *not* over-annotation — without it, TypeScript infers
`"audio"` (literal type) instead of `ContentType` (union). The annotation is necessary to
allow `setType("video")`. The real over-annotation is the `Partial<Record<...>>` which
could be simplified.

### Synthetic example: over-annotated locals

**Before:**
```typescript
export async function fetchCreator(id: string) {
  const response: Response = await fetch(`/api/creators/${id}`);
  const data: CreatorProfile = await response.json();
  const name: string = data.displayName;
  const isActive: boolean = data.deletedAt === null;
  return { name, isActive };
}
```

**After:**
```typescript
export async function fetchCreator(id: string): Promise<{ name: string; isActive: boolean }> {
  const response = await fetch(`/api/creators/${id}`);
  const data: CreatorProfile = await response.json();  // ✓ keeps — .json() returns unknown/any
  const name = data.displayName;
  const isActive = data.deletedAt === null;
  return { name, isActive };
}
```
Return type annotated (export boundary). `data` annotated (narrows `any` from `.json()`).
Other locals inferred.

## Exceptions

- **`any`/`unknown` narrowing** — when a value comes from an untyped source (JSON.parse, .json(), external library), annotate to establish the type. This is a boundary, not a local.
- **Complex generics** — if TypeScript infers `Map<string, { id: string; name: string; roles: Role[] }[]>`, an explicit annotation may be clearer. Use judgment.
- **useState with union types** — `useState<ContentType>("audio")` is necessary to get the full union, not the literal. This is not over-annotation.

## Scope

- Applies to: all TypeScript files — `apps/api/src/`, `apps/web/src/`, `packages/shared/src/`
- Does NOT apply to: test files (test assertions often benefit from explicit types for readability)
