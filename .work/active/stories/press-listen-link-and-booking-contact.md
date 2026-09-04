---
id: press-listen-link-and-booking-contact
kind: story
stage: done
tags: [press, creators, schema]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Clickable listen URL + booking contact field

Two operator asks routed from the campaign taste loop:

1. **Listen URL as a real link** — the `.url` (linktree destination) rendered
   as plain bold text while the bandsintown URL was a live anchor; operator
   wants a clickable link in the PDF. Wrapped in `<a class="url" href=...>`
   in both orientations; `display:block` + `text-decoration:none` added to
   `.url` (anchor must not inherit the page-global prose-link underline or
   change layout).
2. **Booking contact** — `bookingContactEmail` on PressContent (optional,
   email-validated, mirrors `pressContactEmail`), rendered as a second
   "Booking contact" line in the one-sheet contact block (both orientations)
   and in the web PressFooter ("Press · a · Booking · b"). Release one-sheet
   footer deliberately NOT extended: release sheet is release-scoped, the
   press contact already covers outreach, and the minimal footer is a design
   feature (judgment; revisit if an operator asks).

## Implementation notes
- Files changed: `packages/shared/src/press.ts` (5 schema/default sites), `apps/api/src/services/press-pdf.ts` (contact const + booking lines both orientations, `.url` anchor + CSS, `.contact span+span` rhythm), `apps/web/src/components/press/press-sections.tsx` (PressFooter `bookingEmail` prop), `press-template-a/b.tsx` (pass `bookingEmail`), manage `-press-editor-model.ts` (content mapping, patch mapping, email validation with `booking-contact-email` fieldId), `-press-editor.tsx` (field + preview line).
- Tests: API unit (vertical render carries the listen anchor with exact href + booking line markup, ladder still single-attempt at fixture weight), web unit (PressFooter renders booking mailto alongside press mailto).
- Verification: shared/api/web typechecks + suites green; live dark vertical render carries BOTH URI annotations (bandsintown + linktree) in the PDF link dictionary — clickable confirmed at the artifact level; no-booking config renders unchanged (unit-asserted absence).
- Booking has no fallback constant (renders only when set); campaign seeds it once field exists (their lane).
- Adjacent issues parked: none.
