---
updated: 2026-04-16
---

# Inline Documentation Conventions Research — 2026-03-24

Research grounding for the inline documentation convention and `scan-documentation` rule library added to `platform/.claude/skills/`. This doc captures the analysis so the convention is grounded in research, not opinion.

**Decision:** JSDoc syntax, intent-focused content, three-tier coverage requirement, agent-driven enforcement via scan library. No ESLint for now — defer to a separate effort when ESLint is introduced to the platform.

## The Gap

The platform has three documentation/testing layers, but a gap in the middle:

- **Human-facing docs** — maintained by `docs-triage` pipeline, forwarded via golden path
- **E2E tests** — golden-path coverage for production-enabled features
- **Unit tests** — written during implementation, validate individual code units
- **Inline code documentation** — no convention, no enforcement, inconsistent coverage

82 files have JSDoc comments (239+ occurrences), but coverage is uneven. Shared utilities (`result.ts`, `fetch-utils.ts`) and middleware (`require-role.ts`, `error-handler.ts`) are well-documented. Schemas, dashboard helpers, and many client-side lib modules have no doc comments at all.

Without a convention, agents apply documentation inconsistently — some over-document (restating types), others skip entirely.

## What TypeScript Already Handles

TypeScript's type system provides machine-readable documentation:
- Function signatures (parameter types, return types)
- Interface and type alias shapes
- Generic constraints
- Discriminated union branches

Restating this information in doc comments (`@param {string} id - the id`) adds noise without value. The convention must focus on what types **can't** express.

## What Doc Comments Should Add

Types answer "what shape"; comments answer "why" and "when":
- **Intent** — what does this function accomplish, in domain terms?
- **Contracts** — pre-conditions, post-conditions, side effects, dependencies
- **Edge cases** — what happens with null/empty/invalid input?
- **Error behavior** — does it throw or return `Result`? What error types?
- **Non-obvious behavior** — caching, lazy initialization, mutation of arguments

IDE integration is the primary consumption channel: VS Code shows `/** */` comments in hover tooltips and autocomplete. Regular `//` comments are not surfaced.

## JSDoc

The de facto standard for TypeScript inline documentation. The `/** */` syntax is recognized universally by IDEs, documentation generators, and linters.

**Strengths:**
- Zero setup — every TypeScript-aware IDE supports it out of the box
- Broad ecosystem compatibility (TypeDoc, eslint-plugin-jsdoc, VS Code, IntelliJ)
- Well-understood by developers and AI agents alike
- The platform already has 239+ JSDoc comments to build on

**TypeScript interaction:**
- Documentation tags (`@param`, `@returns`, `@deprecated`, `@throws`, `@example`) work fully
- Type-annotation tags (`@type`, `@typedef`) are redundant in `.ts` files — TypeScript handles types
- The `eslint-plugin-jsdoc` `recommended-typescript-error` preset automatically skips type-redundant rules

**Enforcement tooling:**
- `eslint-plugin-jsdoc` — the most comprehensive option; can require docs exist (not just validate syntax), has TypeScript-aware presets that skip redundant type annotations
- `require-jsdoc` (native ESLint rule) — basic presence check, less sophisticated

Sources:
- TypeScript JSDoc reference — typescriptlang.org/docs/handbook/jsdoc-supported-types.html
- eslint-plugin-jsdoc — github.com/gajus/eslint-plugin-jsdoc
- Google TypeScript Style Guide — google.github.io/styleguide/tsguide.html

## TSDoc

Microsoft's standardized specification for TypeScript doc comments. Created to address JSDoc's loosely-defined grammar and ensure consistent behavior across tools.

**Key differences from JSDoc:**
- Formally specified grammar with a reference parser (`@microsoft/tsdoc`)
- Designed for TypeScript from the ground up (no JavaScript type-annotation baggage)
- Additional tags: `@remarks` (extended description), `@defaultValue`, `@sealed`, `@virtual`
- Stricter `@param` syntax (requires `-` separator: `@param name - description`)

**Tooling:**
- `@microsoft/tsdoc` — reference parser, engine component for other tools
- `@microsoft/api-extractor` — build-time API surface extraction, `.d.ts` rollups, documentation generation
- `eslint-plugin-tsdoc` — syntax validation only (does not enforce doc presence)
- `tsdoc.json` — cross-tool configuration

**Assessment for S/NC:**
TSDoc's primary value is for library publishers who need strict, cross-tool documentation standards. The platform is an application, not a published library. API Extractor's `.d.ts` rollup and API surface extraction aren't needed (the API runs via `tsx`, declarations are disabled). The spec is forward-looking but still niche — adopting it would add friction without clear benefit at this scale.

Sources:
- TSDoc specification — tsdoc.org
- API Extractor — api-extractor.com
- eslint-plugin-tsdoc — tsdoc.org/pages/packages/eslint-plugin-tsdoc/
- TSDoc vs JSDoc comparison — plainenglish.io/compare-javascript-jsdoc-with-typescript-tsdoc

## TypeDoc

A documentation generator that converts JSDoc comments into HTML or Markdown output. Orthogonal to the JSDoc vs TSDoc choice — it's the rendering tool, not the comment standard.

**Assessment for S/NC:**
Not needed now. The platform is a private application, not a published API. When public API docs are needed (e.g., for a plugin system or external integrations), TypeDoc is the natural choice — and it will consume the JSDoc comments established by this convention.

Sources:
- TypeDoc — typedoc.org
- Cloudflare TypeDoc usage — blog.cloudflare.com/generating-documentation-for-typescript-projects/

## Enforcement: Agent-Driven vs ESLint

| | Agent-driven scans | ESLint |
|---|---|---|
| **When it runs** | On demand via `/refactor-scan` | Every build, save, CI run |
| **Who enforces** | Claude reads rules + greps code | Deterministic static analysis |
| **Catches drift** | Retroactively (scan cycles) | Proactively (blocks bad code) |
| **Nuance** | Can judge intent, exceptions, context | Binary pass/fail per rule |
| **Setup cost** | Write SKILL.md + references | Install packages, write config, integrate CI |

**Decision:** Start with agent-driven enforcement via `scan-documentation` rule library. It fits the existing infrastructure (five scan libraries already auto-discovered by `/refactor-scan`), requires zero new dependencies, and starts working immediately.

ESLint is deferred as a separate effort. When introduced, `eslint-plugin-jsdoc` with `recommended-typescript-error` preset would complement the scan library — catching obvious violations at write-time while the scan handles nuanced judgment calls. A backlog item is parked on the refactor board for this.

## Documentation Tiering

Not everything needs a doc comment. The convention uses three tiers based on where the code sits relative to module boundaries:

| Tier | Scope | Requirement | Rationale |
|------|-------|-------------|-----------|
| **Always** | Shared package exports, service-layer functions, middleware factories, `Result`-returning functions, hook exports, context providers | Must have `/** */` | These are contracts consumed across module boundaries — IDE tooltips are the primary documentation for consumers |
| **Recommended** | Route handlers (beyond `describeRoute`), complex internal helpers (>20 lines), exported components with complex props, `lib/` utilities | Should have `/** */` | Aids maintainability; agents should add these during implementation but don't need to retrofit |
| **Skip** | Schema declarations, re-exports (`index.ts`), CSS modules, test files, self-documenting constants, trivial private helpers (<10 lines) | No doc needed | Types and names are sufficient; docs would be noise |

This tiering is informed by the codebase's actual documentation patterns. The best-documented files (`content-access.ts`, `fetch-utils.ts`, `require-role.ts`, `result.ts`) all fall in the "Always" tier. The undocumented files (`dashboard.ts` client helpers, schema files) fall in "Recommended" or "Skip."
