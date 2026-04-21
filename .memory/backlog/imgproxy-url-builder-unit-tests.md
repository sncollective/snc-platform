---
tags: [testing, design-system]
release_binding: null
created: 2026-04-20
---

# imgproxy URL builder unit tests

The `responsive-images` feature shipped [apps/api/src/lib/imgproxy.ts](../../apps/api/src/lib/imgproxy.ts) without the accompanying unit test file. Spec AC called for `apps/api/tests/lib/imgproxy.test.ts` covering:

- `buildImgproxyUrl` unsigned (unsafe prefix) when `IMGPROXY_KEY`/`IMGPROXY_SALT` absent
- `buildImgproxyUrl` signed when key/salt present (signature computed, not "unsafe")
- Custom `resizeType` + `gravity` options applied to path
- `quality` option included when specified
- `buildSrcSet` generates four width-descriptor entries for `THUMBNAIL_WIDTHS`
- `buildDprSrcSet` generates three 1x/2x/3x entries with width+height in path

Test scaffold is in the feature spec (`responsive-images.md § Testing`). Uses `vi.doMock` pattern for config singleton + `_resetConfigCache()` between tests.

Deferred during review (2026-04-20) because the user-visible pipeline was verified working end-to-end; unit tests protect against regression but didn't block sign-off.

## Verification when picked up

- [ ] Test file created at `apps/api/tests/lib/imgproxy.test.ts`
- [ ] All six test cases pass
- [ ] `bun run --filter @snc/api test:unit` count increases by the expected number
