# Vertical Slice Lens — Cross-Layer Analysis Criteria

This lens activates when Step 2 resolves the scope to a **domain** (e.g., `booking`, `content`, `creator`). It adds cross-layer continuity checks that horizontal analysis cannot detect.

## Additional Patterns to Load

When this lens activates, also read these pattern files from `platform-patterns/`:
- `dual-layer-fixtures.md`
- `shared-validation-constants.md`
- `row-to-response-transformer.md`
- `web-fetch-client.md`
- `app-error-hierarchy.md`

## File Mapping Template

For a domain `{d}`, enumerate these files (glob where noted):

| Layer | Files |
|-------|-------|
| Shared schema | `packages/shared/src/{d}.ts` |
| DB schema | `apps/api/src/db/schema/{d}.schema.ts` |
| API routes | `apps/api/src/routes/{d}.routes.ts` |
| API tests | `apps/api/tests/**/*{d}*` |
| API fixtures | `apps/api/tests/helpers/{d}-fixtures.ts` |
| Web lib | `apps/web/src/lib/{d}.ts` |
| Web components | `apps/web/src/components/{d}/**/*` |
| Web routes | `apps/web/src/routes/**/*{d}*` |
| Web tests | `apps/web/tests/**/*{d}*` |
| Web fixtures | `apps/web/tests/helpers/{d}-fixtures.ts` |

Not all layers will exist for every domain. Use Glob to resolve actual files; skip missing layers.

## Section 3v: Vertical Slice Cross-Layer Checks

Perform these checks in addition to the standard 3a–3e analysis.

### 3v-a. Schema-to-Transformer Field Continuity

Compare the shared Zod response schema fields (e.g., `ContentResponseSchema`) against the route transformer output (e.g., `resolveContentUrls`). Flag:
- Fields in the schema missing from the transformer return
- Fields returned by the transformer not in the schema
- Whether the transformer's return type references the shared type (TS-enforced, safe) or uses an inline type (drift risk)

### 3v-b. Validation Rule Alignment

Compare shared input schemas (used via `zValidator` on API routes) against client-side form schemas (`zod/mini` in web routes/components). Flag:
- Constraint mismatches: different `min`/`max`, missing `optional()`, different regex
- Locally re-defined constants that should import from `@snc/shared` (per `shared-validation-constants` pattern)
- Missing client-side validation for fields the API validates (silent rejection risk)

### 3v-c. Error Handling Continuity

For each `AppError` subclass thrown in the domain's routes, trace through `throwIfNotOk` to the consuming web component. Flag:
- Error status codes with no UI treatment (user sees generic "something went wrong")
- Error paths that only have `console.error` without user-visible feedback
- Domain-specific error codes that the web layer doesn't distinguish

### 3v-d. Type Continuity Through the Data Chain

Trace the response type from: shared schema → transformer return → web lib generic (`apiGet<T>`) → component props. Flag:
- `as` casts (except known-safe Drizzle enum casts like `row.status as BookingStatus`)
- `any` types anywhere in the chain
- Manual re-definitions of types that exist in `@snc/shared`
- Generic `apiGet<T>` calls where `T` doesn't match the shared response type

### 3v-e. Fixture Alignment Across Layers

Compare API and web fixture factories for the same entity (`makeMock{Entity}` in both `api/tests/helpers/` and `web/tests/helpers/`). Check:
- Field presence: every field in the shared type should appear in both fixtures (adjusting for Date/string, key/URL format differences)
- Default value consistency: non-format values (IDs, names, booleans, enums) should match across layers
- Inlined vs composed nested objects: web fixtures may inline nested objects that API fixtures compose via separate factories — flag inconsistencies in the nested data

### 3v-f. Dead API Surface Detection

Cross-reference API route response fields against web component/lib usage:
- Fields the API returns but no domain component reads (dead surface — may be used cross-domain)
- Fields a component accesses that the API doesn't provide (runtime error risk)
- Note any cross-domain consumers (e.g., dashboard reading booking fields) — these are not dead surface

## Overlap with Standard Checks (3a–3e)

When the vertical slice lens is active, the standard checks interact as follows:

- **3a (Duplication)** — Defer fixture cross-layer comparison to 3v-e; 3a keeps intra-layer fixture dedup only
- **3b (Pattern Compliance)** — Explicitly verify `dual-layer-fixtures` and `shared-validation-constants` pattern compliance across both layers
- **3d (Security)** — Focuses on validation existence; 3v-b checks whether client-side validation matches server-side
- **3e (Skip List)** — Add known-intentional patterns: Drizzle enum `as` casts, web lib `apiGet<T>` casts with correct shared types

## Priority Classification for Vertical Slice Findings

| Priority | Criteria |
|----------|----------|
| **P0** | Field UI depends on but API no longer returns. Validation mismatch causing silent data loss. |
| **P1** | Manual type drifted from shared source. Multiple validation mismatches. Structurally incompatible fixtures. |
| **P2** | Single validation constant not imported from shared. `string` where union type exists. Dead API surface with no cross-domain consumers. |
| **P3** | Known-safe `as` casts that could be eliminated. Minor fixture default value mismatches. |
| **Skip** | Intentional differences with documented reasoning (e.g., Date vs ISO string in fixtures). |

## Report Format Addition

When this lens is active, add a **Cross-Layer Continuity** section to the report after the standard priority sections:

```markdown
## Cross-Layer Continuity

### Schema-Transformer Alignment

| Shared Schema | Transformer | Status | Notes |
|---------------|-------------|--------|-------|
| `ContentResponseSchema.title` | `resolveContentUrls → title` | Aligned | TS-enforced via return type |
| `ContentResponseSchema.newField` | (missing) | **Drift** | Added to schema but not transformer |

### Validation Sync

| Field | Server Rule | Client Rule | Status |
|-------|-------------|-------------|--------|
| `socialLinks` | `max(10)` + `PLATFORM_CONFIG` regex | Same via `@snc/shared` import | Synced |
| `notes` | `max(500)` | `max(200)` | **Mismatch** |

### Error Path Coverage

| Error | API Route | Web Component | UI Treatment |
|-------|-----------|---------------|--------------|
| `NotFoundError` | `booking.routes:120` | `BookingList` | Shows "not found" message |
| `ForbiddenError` | `booking.routes:95` | (none) | **No UI treatment** |

### Type Chain

| Step | Type | Mechanism | Status |
|------|------|-----------|--------|
| Shared | `BookingWithService` | Zod `.infer` | Source of truth |
| Transformer | `toBookingWithServiceResponse` | Returns `BookingWithService` | TS-enforced |
| Web lib | `apiGet<MyBookingsResponse>` | Generic parameter | Matches shared |
| Component | `BookingList` props | Via loader data | Inferred |

### Fixture Sync

| Entity | API Factory | Web Factory | Status | Notes |
|--------|-------------|-------------|--------|-------|
| Service | `makeMockService` | `makeMockService` | Synced | Date/string formats differ correctly |
| Booking | `makeMockBookingRequest` | `makeMockBookingWithService` | **Check** | Web includes nested service |
```
