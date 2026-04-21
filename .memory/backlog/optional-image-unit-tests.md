---
tags: [testing, design-system]
release_binding: null
created: 2026-04-20
---

# OptionalImage unit tests

The `responsive-images` feature upgraded [apps/web/src/components/ui/optional-image.tsx](../../apps/web/src/components/ui/optional-image.tsx) with `srcSet`/`sizes` props without the accompanying unit test file. Spec AC called for `apps/web/tests/components/ui/optional-image.test.tsx` covering:

- Renders `<img>` with `srcSet` and `sizes` attributes when provided
- Omits `srcSet` and `sizes` attributes when null (conditional spread doesn't leak empty strings)
- Renders the placeholder `<div>` when `src` is null (srcSet/sizes ignored in that branch)

Test scaffold is in the feature spec (`responsive-images.md § Testing`). Uses `@testing-library/react` + `container.querySelector` for attribute presence assertions.

Deferred during review (2026-04-20) because the user verified the rendered DOM by inspecting actual `<img>` tags on `/creators` — full DPR srcSet and correct fallback confirmed live. Unit tests protect against regression but didn't block sign-off.

## Verification when picked up

- [ ] Test file created at `apps/web/tests/components/ui/optional-image.test.tsx`
- [ ] All three test cases pass
- [ ] `bun run --filter @snc/web test` count increases by the expected number
