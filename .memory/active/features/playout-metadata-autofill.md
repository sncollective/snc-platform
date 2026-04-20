---
id: feature-playout-metadata-autofill
kind: feature
stage: done
tags: [streaming, media-pipeline]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Playout Metadata Auto-Fill from MKV Tags

## Sub-units (all done)

- [x] Extend `ProbeResult` in shared package
- [x] Parse `format.tags` in `probeMedia()`
- [x] Auto-populate fields in ingest job handler
- [x] Unit tests — `probeMedia()` tag extraction
- [x] Unit tests — ingest job auto-fill

## Overview

When a playout media file is ingested, `probeMedia()` extracts codec and dimension data but discards `format.tags` from ffprobe's JSON output. Admins must manually enter title, year, and director for every item. This feature extends `probeMedia()` to extract those tags and auto-populates item fields during the ingest job — the admin form continues to pre-fill with what was typed at creation time and remains fully editable.

The change is additive and non-breaking: fields are only written from probe tags when the playout item's corresponding field is null. `title` is always provided by the admin at creation time (`CreatePlayoutItemSchema` requires `min(1)`) so it is never overwritten. `year` and `director` default to null — if the admin left them blank, probe tags fill them in. Items where the admin already set a value are never overwritten.

## Tag Naming Conventions

ffprobe's `format.tags` uses container-native key names. MKV (Matroska) uppercases tag keys; MP4/MOV uses mixed case; some encoders lower-case them. The mapping to handle:

| DB field  | Accepted tag keys (checked in order)           |
|-----------|------------------------------------------------|
| `title`   | `TITLE`, `title`                               |
| `year`    | `DATE`, `date`, `YEAR`, `year`                 |
| `director`| `DIRECTOR`, `director`, `ARTIST`, `artist`     |

`DATE`/`date` often contains a full ISO date (`2021-03-15`) or just a year (`2021`). Extract the four-digit year by parsing the first four characters.

## Implementation Units

### Unit 1: Extend `ProbeResult` in Shared Package

**File**: `platform/packages/shared/src/media-processing.ts`

```typescript
export const ProbeTagsSchema = z.object({
  title: z.string().nullable(),
  year: z.number().int().nullable(),
  director: z.string().nullable(),
});

export type ProbeTags = z.infer<typeof ProbeTagsSchema>;

export const ProbeResultSchema = z.object({
  videoCodec: z.string().nullable(),
  audioCodec: z.string().nullable(),
  subtitleCodec: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  duration: z.number().nullable(),
  bitrate: z.number().int().nullable(),
  dataStreamCount: z.number().int(),
  tags: ProbeTagsSchema,   // always present, fields nullable
});

export type ProbeResult = z.infer<typeof ProbeResultSchema>;
```

**Acceptance Criteria**:

- [ ] `ProbeResultSchema` includes `tags: ProbeTagsSchema`
- [ ] `ProbeTagsSchema` exported from `@snc/shared`
- [ ] `ProbeTags` type exported from `@snc/shared`
- [ ] All three tag fields are nullable (no required string)
- [ ] `bun run --filter @snc/shared build` passes

---

### Unit 2: Parse `format.tags` in `probeMedia()`

**File**: `platform/apps/api/src/services/media-processing.ts`

Add `tags?: Record<string, string>` to the ffprobe JSON parse inline type, then add a private `extractProbeTags` helper:

```typescript
const extractProbeTags = (
  raw: Record<string, string> | undefined,
): { title: string | null; year: number | null; director: string | null } => {
  if (!raw) return { title: null, year: null, director: null };

  const get = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = raw[k];
      if (v && v.trim()) return v.trim();
    }
    return null;
  };

  const title = get("TITLE", "title");

  const rawYear = get("DATE", "date", "YEAR", "year");
  let year: number | null = null;
  if (rawYear) {
    const parsed = parseInt(rawYear.slice(0, 4), 10);
    if (!isNaN(parsed) && parsed >= 1888 && parsed <= 2100) year = parsed;
  }

  const director = get("DIRECTOR", "director", "ARTIST", "artist");

  return { title, year, director };
};
```

Update the `return ok({...})` statement to include `tags: extractProbeTags(data.format?.tags)`.

**Acceptance Criteria**:

- [ ] `probeMedia()` return value includes `tags.title`, `tags.year`, `tags.director`
- [ ] Case variants (TITLE/title, DATE/date, YEAR/year, DIRECTOR/director, ARTIST/artist) all handled
- [ ] Full ISO date strings (`"2019-06-21"`) parse to year integer
- [ ] Year outside 1888–2100 range returns `tags.year = null`
- [ ] Missing `format.tags` returns all nulls

---

### Unit 3: Auto-Populate Fields in Ingest Job Handler

**File**: `platform/apps/api/src/jobs/handlers/playout-ingest.ts`

After the probe succeeds, build a `metadataUpdate` object and spread it into the DB update:

```typescript
const metadataUpdate: { year?: number | null; director?: string | null } = {};

if (item.year === null && probe.tags.year !== null) {
  metadataUpdate.year = probe.tags.year;
}
if (item.director === null && probe.tags.director) {
  metadataUpdate.director = probe.tags.director;
}

// Merge into existing DB update with spread
```

`title` is intentionally excluded from auto-fill.

**Acceptance Criteria**:

- [ ] `title` is never auto-filled
- [ ] When `item.year === null` and probe returns a year tag, year is updated
- [ ] When `item.year` is already set, year is NOT overwritten
- [ ] Same pattern for `director`
- [ ] Log line emitted when any field is auto-filled

---

### Units 4–5: Unit Tests

- `tests/services/media-processing.test.ts` — tag extraction test cases
- `tests/jobs/handlers/playout-ingest.test.ts` — auto-fill behavior test cases

---

## Implementation Order

1. **Unit 1** — extend `ProbeResultSchema` in shared (unblocks everything)
2. **Unit 2** — parse tags in `probeMedia()` (depends on Unit 1 for type)
3. **Unit 3** — auto-fill in ingest handler (depends on Unit 2)
4. **Unit 4** — tests for `probeMedia` tag extraction (alongside Unit 2)
5. **Unit 5** — tests for ingest auto-fill (alongside Unit 3)

## Design Principles Compliance

**Ports & Adapters**: Tag parsing logic (`extractProbeTags`) lives in `media-processing.ts` alongside the ffprobe adapter.

**Single Source of Truth**: The tag key lookup order is defined once in `extractProbeTags`. The year range bounds (1888–2100) are already defined in `packages/shared/src/playout.ts` — the implementation guard should reference these constants.

**Generated Contracts**: `ProbeResult` is inferred from `ProbeResultSchema` (Zod → TypeScript).

**Fail Fast**: `extractProbeTags` rejects bad values immediately at the parsing boundary.

## No Schema Migration Needed

`title`, `year`, and `director` columns already exist in `playout_items`. The ingest job now writes values that were previously left as defaults.

## Verification Checklist

```bash
bun run --filter @snc/shared build
bun run --filter @snc/api build
bun run --filter @snc/api test:unit
```
