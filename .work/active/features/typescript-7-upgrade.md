---
id: typescript-7-upgrade
kind: feature
stage: drafting
tags: [developer-experience]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-07-08
parent: null
updated: 2026-07-08
---

# TypeScript 7.0 upgrade — native Go compiler

## Brief

TypeScript 7.0 shipped 2026-07-08. It is the native Go-compiler port of the
TypeScript codebase (Project Corsa) — roughly 10x faster type-checking, with
type-checking semantics preserved (a port, not a rewrite). Microsoft positions
it as a drop-in upgrade: code that compiles cleanly on TS 6 compiles
identically on 7.0.

The platform currently pins `typescript: ^5.9.3` across all four workspaces
(`@snc/api`, `@snc/web`, `@snc/shared`, `@snc/e2e`) and has never adopted TS
6.0. That is the single real risk vector in this jump: TS 6.0 was the
deliberate "bridge release" that deprecated a set of behaviors; TS 7.0 turns
those deprecations into hard errors with no-op behavior. Because the platform
skipped 6.0, it never ran `"ignoreDeprecations": "6.0"` to surface them — they
will arrive all at once as errors when we bump straight to 7.

### What TS 7 changes that is load-bearing for this repo

- **New hardcoded defaults** — `strict: true` (already on), `module: esnext`
  (already set), `noUncheckedSideEffectImports: true` (new), `libReplacement:
  false` (new), `stableTypeOrdering: true` (new, cannot be turned off). Since
  the tsconfigs declare `target`/`module` explicitly, the behavior-changing
  defaults are the side-effect-imports flag and the type-ordering change.
- **TS 6 deprecations → hard errors** — the whole risk surface. The 7.0
  announcement enumerates which deprecated behaviors now error with no-op
  behavior; `tsc --noEmit` against the bump will enumerate the repo-specific
  occurrences.
- **Programmatic compiler API** — the 7.0 blog explicitly says to hold off on
  programmatic-API consumers until 7.1. The platform has no such consumers
  (no `ts-node`/`typescript-eslint`/`ts-api-utils`; runtime is `tsx`, which is
  unaffected). Clean dependency surface.

### Dependency surface (verified)

- `typescript: ^5.9.3` in `apps/api`, `apps/web`, `apps/e2e`, `packages/shared`
  (root hoist).
- `tsx: ^4.21.0` (runtime — unaffected by the compiler bump).
- No `ts-node`, no `typescript-eslint`, no programmatic `ts.*` API consumers.
- tsconfigs are conservative: `target: ES2022`, `module: ESNext`,
  `moduleResolution: bundler`, no `ignoreDeprecations`, no exotic flags.

### Approach

Brief-first, then bump-then-diagnose:

1. Write a short migration brief at
   `platform/.research/analysis/briefs/typescript-7-migration.md` capturing the
   migration-relevant facts (deprecation→hard-error list, new hardcoded
   defaults, 7.1 programmatic-API caveat) from the official release notes —
   grounded in the announcement, not paraphrased from memory. This is a
   lightweight brief, not an ARD research engagement (the source is a single
   published announcement; no fan-out, no attestation cohort).
2. Bump one workspace at a time — `@snc/shared` first (smallest, most
   depended-upon) → `@snc/api` → `@snc/web` → `@snc/e2e` — running
   `tsc --noEmit` + that workspace's test script at each step.
3. Let the compiler self-diagnose the TS6-deprecation surface; fix or
   rewrite each surfaced occurrence. The compiler output *is* the inventory.

The 10x type-check speedup shows up in editor responsiveness and any
`tsc --noEmit` gates; no runtime behavior change is expected (semantics
preserved).

## Strategic decisions

(to be set during feature-design — see Design questions below)

## Design questions for feature-design

- **Bridge via TS 6.0 first, or jump straight to 7.0?** TS 6.0 was the
  deliberate bridge release: installing 6.x with `"ignoreDeprecations": "6.0"`
  surfaces the deprecation set as *warnings* before they become hard errors,
  giving a preview runway. Going 5.9 → 7.0 directly means every deprecation
  lands as a hard error at once. The direct jump is viable (the compiler
  enumerates them either way) but a 6.0 interim pass is the lower-risk path if
  the deprecation surface turns out large. Decide based on the size of the
  surfaced set, not on habit.

- **Single stride or decompose?** Unknown until the bump is attempted. If the
  deprecation surface is small (the usual suspects — a handful of deprecated
  syntax patterns), this collapses to one implementing stride across the four
  workspaces. If it surfaces a cluster of deprecated patterns needing rewrites,
  decompose into per-workspace or per-pattern child stories with `depends_on`
  chains (`@snc/shared` first since the others depend on its types).

- **Skill promotion?** No TS7 skill at scope time — the substantive changes
  are migration-time knowledge (deprecation list, new defaults), not
  daily-API-surface knowledge that earns a perpetually-auto-loaded skill. If
  the migration reveals *durable recurring* TS7 patterns (e.g.,
  `stableTypeOrdering` breaking a type pattern used everywhere, or CSS
  side-effect imports needing rework), promote those to a
  `.claude/skills/typescript-v7/SKILL.md` then. Brief-first, skill only if
  earned.

- **Baseline capture?** Run a `tsc --noEmit` on current 5.9.3 before bumping
  so there is a "before" to diff against — confirms the tree is clean on the
  current compiler and isolates the bump as the sole variable.

## Testing

Per-workspace verification at each step of the bump:

- `bun run --filter @snc/shared build && bun run --filter @snc/shared test`
- `bun run --filter @snc/api test:unit` (and `test:integration` if the
  surfaced surface touches runtime-typed code paths)
- `bun run --filter @snc/web test`
- `bun run --filter @snc/e2e test` (golden path; only if e2e surfaces anything)

Close condition: green suite on all four workspaces under TS 7.0. A green
suite for the machine-provable surface is a valid close (fix-verify loopback:
no human residual expected — this is a toolchain swap with preserved
semantics, not a behavior change).

## Risks

- **Deprecation surface size unknown.** Mitigation: the brief + `tsc --noEmit`
  enumerate it before any fix work. If large, the 6.0-bridge option (above)
  becomes attractive.
- **`stableTypeOrdering: true` (cannot be disabled).** Changes type-display
  ordering in error messages and potentially conditional-type behavior that
  relied on declaration order. Low likelihood of runtime impact but worth a
  careful read of any surfaced type errors.
- **No programmatic-API exposure here**, so the 7.1 caveat does not block —
  recorded for completeness.
