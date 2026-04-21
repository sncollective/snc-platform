---
id: story-refactor-json-ld-typed-interfaces
kind: story
stage: implementing
tags: [refactor, quality]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

Replace `Record<string, unknown>` return types on all exported functions in `json-ld.ts` with typed Schema.org interfaces, recovering type safety on structured data outputs.

## Scope

- `apps/web/src/lib/json-ld.ts` — lines 22, 77, and 91 are the three export sites returning `Record<string, unknown>`. Define typed interfaces (`VideoObjectJsonLd`, `AudioObjectJsonLd`, `ArticleJsonLd`, or equivalent) that match the shape each function constructs. Replace the return type annotations. The existing `buildMediaObjectJsonLd` helper (already landed) is a reference for the shared media shape.

## Tasks

- [ ] Define typed JSON-LD interfaces in `json-ld.ts` (or a co-located `json-ld.types.ts` if the file grows large) covering VideoObject, AudioObject, and the written-content (Article/CreativeWork) shapes.
- [ ] Update each of the three export functions to return its specific typed interface rather than `Record<string, unknown>`.
- [ ] Verify `bun --cwd=./platform run typecheck` passes with no new errors; call sites should continue to compile without casts.

## Notes

The exhaustive switch fix on `buildContentJsonLd` (line 22) already landed per the Fix lane — this story's scope is the return-type strengthening, not the dispatch logic. The Schema.org types don't need to be exhaustive against the full spec; match exactly the fields each function currently builds so the types serve as a contract, not aspirational documentation. If a Schema.org type package (e.g. `schema-dts`) is already a dependency, use it; otherwise define local interfaces rather than adding a new dep for this scope.
