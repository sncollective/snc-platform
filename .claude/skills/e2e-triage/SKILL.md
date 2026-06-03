---
name: e2e-triage
description: "Triage e2e test coverage gaps. Primary mode: release-gate operation — inspect all items bound to a release and produce gate findings for coverage gaps. Secondary mode: ad-hoc processing of backlog items tagged `testing`. Outcomes: delete (already covered), inline implement (simple spec update/new), or write active feature (complex). Use at release-gate time (testing gate after security), or on parked `testing` backlog items. Trigger on 'e2e triage', 'test coverage gate', 'process testing items'."
argument-hint: "[--release=<version>] [item-path-or-slug] or omit for ad-hoc listing"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
model: opus
---

# e2e-triage — E2E Coverage Gate + Ad-Hoc Triage

Two modes:

- **Release-gate mode** (primary): inspect all items bound to `<version>`, investigate collective e2e coverage, produce gate findings for real gaps. Invoked by the release gate sequence (runs after security gate, before docs gate).
- **Ad-hoc mode** (secondary): process a single `testing`-tagged backlog item. For manually-parked items or when processing outside a release cycle.

See:
- `.claude/rules/item-pipelines.md` — `§Quality gates live on releases` (gate sequence), `§Release binding lifecycle` (gate-finding binding).
- `.claude/rules/item-convention.md` — item structure.
- `.claude/rules/tag-taxonomy.md` — `testing` tag charter.

## Step 0: Parse Arguments

`$ARGUMENTS` may contain:
- **`--release=<version>`** — release-gate mode. Inspect all items with `release_binding: <version>`.
- **Item path or slug** — ad-hoc mode for a single `testing`-tagged backlog item.
- **No args** — ad-hoc listing mode: glob `testing`-tagged backlog items, present for user to pick.

## Step 1: Resolve Mode

**Release-gate mode:** read `.work/releases/<version>.md` + all items with `release_binding: <version>`.

**Ad-hoc mode:** read the target backlog item.

Load `AGENTS.md §Agent Commands` for the e2e test runner.

## Step 2: Collect Inspection Surface

**Gate mode:** for each item bound to the release, collect:
- Changed files (from item's design matter + commits associated with the item).
- User-visible surface changes (routes added/modified, components added/changed, API endpoint behavior).
- Production-enabled vs feature-flagged (check `packages/shared/src/features.ts` — `FEATURE_FLAGS` array names active/unshipped flags; routes NOT behind these are production-enabled).

Build a bundle-wide change set. Collapse overlaps — if two items touched the same auth flow, inspect once.

**Ad-hoc mode:** read the backlog item's matter to understand what was flagged.

## Step 3: Investigate Coverage

Domain-specific logic:

1. **Read existing specs** — glob `apps/e2e/tests/*.spec.ts` and read each file. Build a coverage map: which spec covers which user journeys and routes.
2. **Cross-reference changes** — for each user-visible change in Step 2's surface, check if an existing spec covers it.
3. **Identify gaps** — changes with no matching spec coverage.

## Step 4: Classify Each Gap

| Status | Meaning |
|---|---|
| **COVERED** | Existing spec already tests this journey; no behavioral change the spec doesn't already assert. |
| **NEEDS UPDATE** | Existing spec covers the area but assertions need updating for new behavior. |
| **NEEDS NEW (simple)** | No spec covers this; single journey, follows existing patterns, single auth state. |
| **NEEDS NEW (complex)** | No spec covers this; multiple journeys, new fixtures, new auth roles, or seed-data complexity. |
| **NOT TESTABLE** | Change is internal-only with no user-visible effect. |

## Step 5: Route Outcomes

**Gate mode:**

- **COVERED / NOT TESTABLE** → no gate finding. Nothing to do.
- **NEEDS UPDATE / NEEDS NEW (simple)** → create a gate finding as a story at `stage: implementing`, tagged `testing` + domain co-tag, with `release_binding: <version>`. Matter describes what spec to update/create.
- **NEEDS NEW (complex)** → create a feature at `stage: drafting`, tagged `testing`, with `release_binding: <version>`. Matter names user journeys, auth/fixture needs, seed-data dependencies. `/design` extends.

All gate findings bind to the release and block it from shipping until resolved.

**Ad-hoc mode:**

- **COVERED / NOT TESTABLE** → delete the backlog item. Git preserves history. Report the rationale inline.
- **NEEDS UPDATE / NEEDS NEW (simple)** → implement inline (read existing spec patterns, update/create spec file, run e2e tests). Delete the backlog item after verification.
- **NEEDS NEW (complex)** → write a feature at `.work/active/<slug>/feature.md` at `stage: drafting`, tagged `testing`. Delete the backlog item. User can run `/design` next.

## Step 6: E2E Pattern Discipline (Applied in Any Implement Path)

When implementing specs (simple path) or writing feature matter for complex:
- **Selectors:** `getByRole`, `getByText`, `getByLabel` — never CSS selectors or `data-testid`.
- **Auth:** `test.use({ storageState: "auth/{role}.json" })` — roles: `admin`, `stakeholder`, `subscriber`.
- **Structure:** `test("description", async ({ page }) => { navigate → interact → assert })`.
- **Assertions:** user-visible outcomes only (headings, text, URLs, element visibility).

## Step 7: Report

**Gate mode:**
> *"E2E gate for release `{version}`: {N} items inspected, {G} gaps surfaced. {C} COVERED, {U} NEEDS UPDATE, {N1} NEEDS NEW (simple), {N2} NEEDS NEW (complex), {NT} NOT TESTABLE. Created {S} stories at `stage: implementing` and {F} features at `stage: drafting`, all bound to {version}. Release blocked until gate findings resolve."*

**Ad-hoc mode:**
> *"Triaged `{item}`. Outcome: {status}. {action taken}. {M} `testing`-tagged backlog items remaining."*

## Anti-Patterns

- **Don't skip reading existing specs.** Coverage understanding is the whole point of triage.
- **Don't use CSS selectors or `data-testid`.** Semantic selectors only.
- **Don't write tests that depend on implementation details** (component names, class names, internal state).
- **Don't create a feature.md for simple updates.** Single-spec update/addition implements inline.
- **Don't modify `playwright.config.ts` without asking.** Feature flag changes affect the entire suite.
- **Don't auto-fix test failures.** Report and ask the user.
- **Don't create gate findings for covered changes.** If the existing spec already covers a change, no finding needed.
- **Don't process gate items one at a time.** Inspect the bundle collectively — multiple items may touch the same surface; triage once.
- **Don't forward from `/review`.** `/review` doesn't create `testing` backlog items. Gate mode inspects the release bundle directly; ad-hoc mode processes user-parked items only.
