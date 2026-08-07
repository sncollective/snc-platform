---
id: creator-press-page-v2-content-model
kind: feature
stage: implementing
tags: [creators, content, ui, schema]
parent: creator-press-page-v2
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-08
---

# Press page v2 — content model

## Brief
The v2 content schema + migration, replacing the v1 flat shape. Adds: `members[]`
(name / role / bio? / photo), images as objects `{ key, alt, credit }` (band
photo, member photos, highlight cover art, gallery), `gallery[]` (carousel
source), merged `highlights[]` (the current single + standout track + optional
extras like the upcoming LP, each with cover art + streams figure), a `template`
selector (A/B), and For-fans-of placement (in About). Includes the Drizzle
migration + backward-compat with the live v1 `creator_press_configs` content
(v1 fields map forward; v1 pages keep rendering until v2 templates ship).

## Epic context
- Parent epic: `creator-press-page-v2`
- Position: **foundation feature** — the shared Zod contract + table shape every
  other v2 feature consumes (image-management, templates, editor, PDF).

## Simplification opportunity
- Retires the bare-key `photos: string[]` (and the scan finding about missing
  alt text) → images become `{ key, alt, credit }`.
- Merges the v1's separate `standoutTrack` + the release one-sheet into the
  unified `highlights[]` (one flexible list instead of two special-cased fields).

## Foundation references
- `packages/shared/src/press.ts` (v1 contract — the v2 supersedes)
- `apps/api/src/db/schema/creator.schema.ts` (`creator_press_configs` table)
- `apps/api/src/services/press.ts` (`getPressConfig` / `upsertPressConfig`)
- `apps/api/src/routes/press.routes.ts` (public + manage routes; ownership guard)
- `.mockups/design-system/tokens.css` (design system the v2 inherits)
- Locked templates: `.mockups/screens/creator-press-page/final-{1,3}.html`

## Architectural choice

**Additive superset evolution of the existing `PressContent` JSONB contract —
no column change, no destructive rewrite.**

The v1 press page is **live** (AF single shipped 2026-08-06). `content` is a
JSONB column; evolving its shape is a Zod-contract change + a one-time data
backfill, **not** a DDL migration. The v2 schema becomes a superset: new fields
(`template`, `tagline`, `banner`, `aboutPhoto`, `members[]`, `highlights[]`,
`gallery[]`, `service` on streaming links) are added with `.default()`/optional;
the v1 fields (`photos`, `standoutTrack`, `releases`) remain as **legacy
optionals** so the live v1 web render + v1 manage editor keep reading/writing
them unchanged until the v2 templates + editor ship and a later cleanup retires
them.

This is the lowest-risk way to evolve a live JSONB contract: the public v1
route returns the superset (v1 web ignores unknown fields), the v1 PATCH
read-modify-write merge (`{...current, ...patch}`) preserves new fields, and a
backfill migration populates the new fields from the old so a creator's page is
v2-ready the moment the templates feature flips the render over.

**Rejected alternatives:**
- *Versioned `PressContentV2` in a new column / `version` discriminator* —
  cleaner long-term, but forces the v1 read path to handle two shapes during
  transition and doubles the migration risk on live data. Not worth it for a
  transitional period that ends when templates ship.
- *Drop v1 fields immediately* — breaks the live v1 render. Ruled out.

## Design decisions

- **Images are objects `{ key, alt, credit? }`** (`PressImage`). `alt` is
  **required** — this directly retires the alt-text scan finding on the v1
  bare-key `photos[]`. `key` is an opaque storage key: a library asset key (once
  `content-library-core` lands) or a legacy `creators/{id}/press/...` key. The
  content model does not enforce which; ownership validation evolves in
  `creator-press-page-v2-image-management` (depends on both this feature and
  `content-library-core`) to accept `isLibraryAssetKey` alongside
  `isOwnedPressKey`.
- **`highlights[]` is the page-surface list; `releases[]` stays.** The brief says
  highlights "merge standout + release" — interpreted as the **rendered page
  surface** merges them, not that the release one-sheet *data* is deleted.
  `releases[]` (personnel, ISRC, catalog, the one-sheet PDF source) remains for
  the release-specific PDFs; `highlights[]` is the flexible, orderable list the
  press page actually renders (eyebrow / title / description / metric / coverArt).
  The editor (later feature) lets a creator compose highlights, optionally from
  releases + the standout track. Flagged: this keeps more fields than a strict
  "merge" reading would, but preserves the one-sheet capability.
- **Streaming links gain a `service` enum** so the locked-design icon buttons can
  render. The icon catalog (spotify / apple-music / amazon-music / youtube /
  bandcamp, + soundcloud/tidal for headroom) is owned by the **templates** feature
  (rendering); the content model only carries `service`. `label` stays as an
  optional override (derived from the service otherwise). Backfill infers
  `service` from the URL host where unambiguous (spotify.com → spotify, etc.),
  falling back to a `website` catch-all so no v1 data is lost.
- **`members[]` are display-only** (name/role/photo/bio), stored in the press
  JSONB — **not** the `creator_members` table (that table is team/permissions:
  userId + role). Press "band members" are named people who may have no account.
- **Hero `tagline`** is a new one-line genre/descriptor (the hero-facts second
  line in the locked templates, e.g. "Socially conscious punk / alt-rock"),
  distinct from `shortBio` (the About deck). Banner image is a **press-specific**
  3:1 `PressImage`, distinct from the creator profile banner.
- **Lazy migration via read-time normalization, not a stored backfill.** There is
  no DDL (content is JSONB) and the live data is sparse (AF page, photos not yet
  delivered), so a stored jsonb backfill would add risk for little gain — and
  would race with `content-library-core`'s `db:generate` on the shared migration
  journal during the parallel W1 build. Instead the press service normalizes a
  parsed v1 row to the v2 shape **at read time** (`gallery` ← `photos`, the lead
  `highlights[]` ← `standoutTrack` + `releases`, streaming `service` inferred):
  v1 rows map forward lazily, the v2 editor's explicit writes take precedence, and
  no data migration or prod manual step is needed. This is a pure read transform;
  it composes with the contract's streaming-link union preprocessor. (A one-shot
  stored normalization can be folded in later at release time if read cost ever
  matters — it doesn't at this scale.)

## Implementation Units

### Unit 1: Shared contract evolution — `packages/shared/src/press.ts`

**Story**: `creator-press-page-v2-content-model-contract`

```ts
/** A press image: a storage key + required alt + optional photo credit. */
export const PressImageSchema = z.object({
  key: z.string().min(1),
  alt: z.string(),              // required — fixes the v1 alt-text gap
  credit: z.string().nullable().optional(),
});
export type PressImage = z.infer<typeof PressImageSchema>;

/** A named band member shown on the press page (display-only, no account). */
export const PressMemberSchema = z.object({
  name: z.string().min(1),
  role: z.string().nullable().optional(),
  photo: PressImageSchema.nullable().optional(),
  bio: z.string().nullable().optional(),   // rendered by Template A only
});
export type PressMember = z.infer<typeof PressMemberSchema>;

/** A press highlight: the flexible, orderable list the page renders. */
export const PressHighlightSchema = z.object({
  eyebrow: z.string(),                   // e.g. "New release · SNCR-001", "Standout track"
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  metric: z.string().nullable().optional(),  // e.g. "~14.5k streams"
  url: z.string().url().nullable().optional(),
  coverArt: PressImageSchema.nullable().optional(),
});
export type PressHighlight = z.infer<typeof PressHighlightSchema>;

/** Streaming service identifiers (icons owned by the templates feature). */
export const PressStreamingServiceSchema = z.enum([
  "spotify", "apple-music", "amazon-music", "youtube",
  "bandcamp", "soundcloud", "tidal", "website",
]);
export type PressStreamingService = z.infer<typeof PressStreamingServiceSchema>;

export const PressStreamingLinkSchema = z.object({
  service: PressStreamingServiceSchema,
  url: z.string().url(),
  label: z.string().nullable().optional(),   // overrides the service-derived label
});
```

`PressContentSchema` becomes a superset — add (with defaults/optional):
`template` (`z.enum(["A","B"]).default("A")`), `tagline` (nullable), `banner`
(`PressImageSchema.nullable()`), `aboutPhoto` (`PressImageSchema.nullable()`),
`members` (`z.array(PressMemberSchema).default([])`), `highlights`
(`z.array(PressHighlightSchema).default([])`), `gallery`
(`z.array(PressImageSchema).default([])`); evolve `streamingLinks` to the new
`{service,url,label?}` shape. **Keep** `photos`, `standoutTrack`, `releases` as
legacy optionals (the live v1 render + editor still use them). Update
`DEFAULT_PRESS_CONTENT` with the new defaults; update `PressConfigPatchSchema`
to mirror (all optional, no defaults — the patch shape).

**Implementation Notes**:
- Existing v1 rows parse clean against the superset: missing new fields fall to
  `.default()` / `undefined`; `streamingLinks` evolution needs a permissive read
  — see the backfill (Unit 2) and a `.catch`/transform on legacy `{label,url}`
  link rows so reads don't throw before the backfill runs. Concretely: parse
  `streamingLinks` elements through a `z.union([newShape, legacyShape])` preprocessor
  that maps `{label,url}` → `{service: inferService(url), url, label}`.
- `inferService(url)` helper (host → service) lives here (shared) so the backfill
  and the read-preprocessor share it.

**Acceptance Criteria**:
- [ ] A v1-shaped `content` JSON (bare `photos`, `standoutTrack`, legacy
  `{label,url}` links) parses against the evolved `PressContentSchema` without
  throwing, yielding `gallery: []`, `highlights: []`, `members: []`,
  `template: "A"`, and streaming links with an inferred `service`.
- [ ] `DEFAULT_PRESS_CONTENT` satisfies the evolved schema.
- [ ] `PressConfigPatchSchema` accepts partial v2 patches and still accepts v1
  patches (`photos`, `standoutTrack`).

---

### Unit 2: Read-time v1→v2 normalization — `apps/api/src/services/press.ts`

**Story**: `creator-press-page-v2-content-model-normalization` (depends on Unit 1's
contract)

A **pure read transform** applied after `readPressConfig` parses a row through
the evolved schema. It fills v2 surface fields from v1 legacy fields **only when
the v2 field is empty/unset** (so explicit v2 editor writes take precedence):

```ts
/** Lazily normalize a parsed v1-shaped PressContent toward the v2 surface shape. */
export const normalizePressContent = (c: PressContent): PressContent => {
  // gallery ← photos (bare keys → PressImage {key, alt:'', credit:null})
  const gallery = c.gallery.length ? c.gallery
    : c.photos.map((key) => ({ key, alt: "", credit: null }));
  // highlights ← standoutTrack (lead) then releases (coverArt from artKey)
  const highlights = c.highlights.length ? c.highlights : [
    ...(c.standoutTrack ? [{ eyebrow: "Standout track", title: c.standoutTrack.title,
        metric: c.standoutTrack.streamsLabel, url: c.standoutTrack.url }] : []),
    ...c.releases.map((r) => ({ eyebrow: `New release${r.catalogNumber ? ` · ${r.catalogNumber}` : ""}`,
        title: r.title, coverArt: r.artKey ? { key: r.artKey, alt: "", credit: null } : null })),
  ];
  return { ...c, gallery, highlights };
};
```

Wire it into `readPressConfig` so every read (public + manage) returns the
normalized shape. (The streaming-link `service` inference already happens in the
contract's parse-time union preprocessor — no duplicate work here.)

**Implementation Notes**:
- `normalizePressContent` is a pure function — unit-testable with no DB.
- `banner`/`aboutPhoto`/`members`/`tagline` have no v1 analog → stay at their
  defaults (null/empty); not derived.
- `image-management` (later) lets the editor fill empty alts/credits; until then
  backfilled gallery/coverArt carry empty alt strings (the scan finding is about
  the v1 *bare-key* `photos[]`, which this replaces structurally).

**Acceptance Criteria**:
- [ ] A v1 row (bare `photos`, `standoutTrack`, `releases`) read through
  `getPressConfig` yields a `PressContent` with `gallery.length == photos.length`,
  a leading "Standout track" highlight, then release highlights, and inferred
  streaming services.
- [ ] A row where the editor has already set `gallery`/`highlights` is returned
  **as-written** (precedence: explicit v2 writes win).
- [ ] `normalizePressContent` is idempotent (normalize(normalize(x)) == normalize(x)).

---

## Implementation Order
1. `creator-press-page-v2-content-model-contract` — evolve `press.ts`
   (Unit 1). Unblocks `image-management`, `templates`, `editor`, `pdf`.
2. `creator-press-page-v2-content-model-normalization` — the read-time v1→v2
   transform in `services/press.ts` (Unit 2), depending on the contract.

## Simplification
- `PressImage` retires the bare-key `photos[]` and the alt-text scan finding.
- `highlights[]` replaces two special-cased fields (standout + release-as-section)
  with one orderable list on the page surface.
- The legacy fields are intentionally **retained** for the transition (not deleted)
  — a `[cleanup]` task retires them once the v2 editor + templates ship and v1
  data is confirmed migrated. Removing them now would break the live v1 render.

## Testing
- **Unit (contract)**: the v1→v2 parse-superset behavior is the load-bearing
  assertion — a v1 JSON fixture parses to a valid v2 `PressContent` with inferred
  services and defaulted new fields; `DEFAULT_PRESS_CONTENT` round-trips. Also:
  `inferService` host mapping (spotify/apple/bandcamp/youtube + `website` fallback).
- **Unit (normalization)**: `normalizePressContent` pure-function cases — v1 row
  derives gallery/highlights/services; explicit v2 writes take precedence;
  idempotence; empty/`null` `standoutTrack`/`releases` edge.
- **Integration (read path)**: `getPressConfig` on a seeded v1 press config yields
  the normalized v2 shape; an editor-written v2 row is returned as-written.
- **Regression**: the existing v1 public-press + manage-press route tests stay
  green (the superset is backward-compatible) — do **not** weaken them.

## Risks
- **Read-time normalization correctness** — the transform must be idempotent and
  defer to explicit v2 writes; covered by pure-function unit tests + the read-path
  integration test. No stored data is mutated, so there is no data-migration risk
  on the live AF row.
- **v1 editor drift during transition** — the live v1 manage editor writes v1
  fields; if a creator edits via v1, `gallery`/`highlights`
  can drift from `photos`/`standoutTrack`. Acceptable: the v1 editor is replaced
  by the v2 editor in this same epic, and the transition window is short. The v2
  editor becomes the source of truth; v1 fields go read-only-legacy.
