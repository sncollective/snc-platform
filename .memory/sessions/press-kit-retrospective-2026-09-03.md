# Press-kit platform retrospective — campaign/press-support arc (2026-09-02/03)

Session record for the animal-future press cycle that built the press-kit
family on `campaign/press-support` (76 implementation rounds (28 substrate stories + 3 features), 164 commits including
campaign content rounds). Written at the operator's debrief call.

## What was built (the instantiation as it stands)

Four PDF products + their web twin, one grammar:
- **Band one-sheet** (vertical + horizontal orientations, pinned deterministic
  templates — vertical compact, horizontal normal)
- **Release one-sheet** (release-scoped facts/credits ledger)
- **Release EPK companion** (half-Letter 5.5×8.5, story-led, triptych or solo
  hero, pre-save callout)
- **One-pager** (prints the live web page)
- Shared: dark/light themes, pressQuotes, photographyCredits, bookingContact,
  IG handles (label constant + creator socialLinks), streaming links as URI
  annotations, QR on light patch, viewer-proof construction (no luminosity
  soft-masks), WYSIWYG image geometry end to end.

## Operator theses, validated by the session's evidence

### 1. Web reactive, print fixed — and reactive never means content loss
The session proved this the hard way, twice:
- **The density ladder** (auto normal→compact→tight retiering) was "reactive
  print" — and it made review rounds chase moving targets (the tier silently
  flipped ≥5 times as content changed). The fix — pinned deterministic
  templates with loud 400 overflow — was the operator's ruling, and it
  converged the artifact. **Print is fixed geometry; the content adapts to
  the template, never the reverse.**
- **The web hero** at aspect 2294/1163 with viewport-scaled height is
  properly reactive: the box flexes, the image never disappears. Contrast
  with the print hero: fixed 320→372px box, measured placement, luminance-
  mapped title position.
- The refinement: reactive layout should flex *spacing and proportion*,
  never *presence*. Every section survives at every width; slack
  distributes (space-between), sections bound (fixed-height rows with
  centered content), content caps self-bound (bio truncation, member caps).

### 2. Image specs: a target to hit
The dominant defect class of the session (10+ rounds) was image geometry:
- Stale specs at every layer (the 3:1 banner stowaways: EPK spec, web
  delivery, oneSheetHtml lead — three separate fix rounds)
- Aspect mismatches between upload, print spec, and CSS box (the 0.895 vs
  4:5 crown-shave; the 64-vs-72 inline mismatch)
- Resolution shortfalls (2250px spec for a 2294px+ need = 1.39× upscale)
**The endpoint — aspect-derived windows** (probe the upload's true
dimensions, size the window from its aspect within clamps, match the print
spec) — generalizes "match the standard" to "match whatever is uploaded."
But the operator's instinct is right as the user-facing contract: **the
platform should publish per-slot targets** (ratio + minimum pixels), so a
user uploading a 2400×3600 portrait knows it renders full-frame in a 4:6
window at 300ppi. Targets + aspect-derived tolerance underneath.

## Takeaways the operator didn't name (from the conversation)

### 3. Verification culture: measurement is the claim
Both lanes were burned exactly once by confident-unverified claims (their
blessed type-size bug; my seam-centering and unasserted replaces) and both
hardened the same way. The methods that earned permanent status:
- **Extract-embedded-raster-and-compare** (pdfimages) — the only image-
  geometry verification that can't be fooled by which-layer reasoning.
  Caught the banner stowaway and the member-width discrepancy.
- **Luminance mapping before placement** (the footroom crop, the title-on-
  dark positioning) — sample the photo's zones, then place text.
- **Pixel probes over vision-model impressions** for positions/sizes; vision
  passes carry measurement instructions when hierarchy is in question.
- **Grep over vision** for exact strings (the snc.org/s-nc.org class).
- The gates that caught real bugs: typecheck (bracket slip), the hardened
  fit check (runaway aspect-ratio feedback loop 400'd mid-flight), the
  padding-floor check (chrome-exemption gap).

### 4. The latent-race class
Three probabilistic failures invisible to deterministic tests: restart
races (4×, mesh render/commit crossings), spawn deadlocks (undrained gs
stderr), hydration race (web app re-rendering over the injected sheet,
~50% failure when it surfaced). All killed structurally: script-blocking
routes, node:child_process under the real runtime, helper-free
page.evaluate callbacks (the keepNames trap). **Test spawn/serialize
plumbing under the actual runtime, not the interactive one.**

### 5. Loud failure over silent adaptation
Every silent-adaptive mechanism eventually generated a "why does it look
different" round: the density ladder, the page-buffer slack pool, the
stretch-to-text figures chasing line boxes. Every deterministic mechanism
(fixed squares, bounded sections, space-between distribution, pinned tiers)
converged review rounds instead. **When something can't fit, say so with
guidance; never quietly become something else.**

### 6. The collaboration model
The mesh split (campaign: content/staging/proofs; platform: code) held with
zero boundary incidents across ~60 crossings. What made it work:
- Taste calls routed, never picked silently ("flag the options back
  through us")
- Every landing verified by both lanes with measurements
- Provenance discipline enforced twice by the operator (FoCoMA quote,
  Melchior credit) — "provenance renders or it doesn't exist"
- Overlap discipline: content commits by the campaign even when the
  platform seeded to verify (the overlap noted, ownership restored)

### 7. Template architecture direction (for platform users)
What "choose a template + bounded adjustments" looks like from this build:
- **Templates as products**: the four PDFs are genuinely different
  templates (not one template with knobs) — each with its own pinned
  geometry, its own grammar instance.
- **Bounded adjustments as content fields**: theme, orientation, template
  A/B, photo slots (2-4), quotes, credits, contacts, IG, pre-save URL —
  every "adjustment" built this session is a content-model field, not a
  code change. That's the right user surface.
- **The print/web twin**: same tokens, same grammar, different layout
  philosophies (fixed vs flexes). The web press page IS the reactive
  twin; the PDFs are the fixed twins.
- **Missing for platform users**: the template picker (which template +
  which slots), the per-slot image spec sheet (ratio + min px per slot),
  and pre-upload validation against those specs.

## Numbers for the record
- 76 implementation rounds (conversational count; substrate items: 28 stories + 3 features); 164 commits; ~60 mesh crossings; 2 provenance
  catches; 3 latent races killed; 4 restart races survived; 10+ image-
  geometry rounds converging to aspect-derived WYSIWYG; 2 usage-limit
  model swaps; 1 branch (merge-not-rebase pending).

## Additions at the debrief call (platform-lane thoughts)

Process/velocity takeaways beyond the operator's named theses:
1. **Render provenance stamp** — embed the build identity (git commit) in
   PDF metadata; "is this render current?" becomes a one-line check. Would
   have killed 3-4 stale-render false-defect rounds.
2. **Shared measurement harness** — a `press-measure <pdf>` script both
   lanes run identically (embedded dims, page geometry, glyph positions).
   Same numbers, no cross-lane disputes, no tiebreaker rounds.
3. **Specs computed from geometry** — derive the per-slot image spec sheet
   from the template's actual slot code (the aspect-derivation can emit
   its own targets). Hand-written spec docs drifted stale within one day
   this cycle; computed specs can't.
4. **Density as visible template parameter** — the pin, productized: an
   explicit user choice with surfaced fit guidance, not auto-adaptation
   and not a hidden pin.
5. **PressContent fixture factory** — schema churn touched 7+ test files
   per new field, six times this session. One defaults-factory kills the
   tax.
6. **Agent-parallel paths** — every interactive-only surface needs a
   script/API twin (press-asset.ts is the exemplar; config-edit PATCH/
   publish auth is the parked instance).
7. **Render-stability test** — render each template twice, diff with
   normalized timestamps; the hydration race would have failed it on day
   one.
8. **Style grammar cards** — one page of human-terms layout rules per
   template; precise taste vocabulary from round one.

### Variant model (operator refinement at debrief)
Template = style/theme identity guiding capacity; variant = tested content
configuration within it (density, orientation, mode, sections). Variants
deserve creation-time rigor: measured capacity (what fits at the 400
boundary), derived image specs (slots + ratios + minimums), determinism
verification. The session built proto-variants (density tiers, orientations,
EPK hero modes) whose capacities were learned empirically; the platform
productizes them as menu entries carrying published contracts.

## Campaign-lane debrief input (2026-09-03, agent experience)

Their durable record: records/animal-future/.memory/sessions/2026-09-03-
agent-experience-debrief.md (commit 26f206a6). Core finding, accepted:
**the machinery was excellent but served the web app over HTTP, not
programmatic consumers** — nearly every friction traces to missing
structured I/O. The complement to this retrospective's verification-
culture theme: ours made measurement reliable; theirs eliminates the
need to measure (a renderer that returns the truth about what it did).

Platform-lane disposition: Tier 1 accepted in full (render API with
metadata, intelligent ingestion, content API with dry-run fit); Tier 2
accepted as variant parameters + render diffing; Tier 3 accepted
(decoupled render worker, schema discoverability). Scoped as
press-kit-programmatic-surface feature. Faces/grades parked as later
phases. Transport: contracts first (REST/MCP agnostic).

Their closing line carries: "the cheapest verification is a renderer
that tells the truth about what it did."
