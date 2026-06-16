---
id: research-garage-vendored-source
tags: [research, content]
release_binding: null
research_origin: vendored-source-research-mode
created: 2026-06-16
---

# [research] Vendored-source acquire + orient: Garage v2.2.0

Apply vendored-source research mode to Garage (object storage) — clone at our pinned version,
source-orient the `garage-v2` tech-reference skill with source-grounded internals. **Engagement
entry:** `/agentic-research:research-orchestrator`.

## Acquire
- **Pin:** `dxflrs/garage:v2.2.0` (docker-compose) — precise tag ✓. Clone Garage at `v2.2.0` from
  its source (git.deuxfleurs.fr/Deuxfleurs/garage; mirror on github). Rust.

## Orient (source-grounded internals worth pinning)
- **Consistency / durability model** — our `garage-object-storage.md` position records "sufficient
  S3 compatibility," not complete. Source-confirm the *exact* consistency guarantees (read-after-
  write, replication mode, layout/quorum) we rely on for content + playout reads.
- **S3-compatibility gaps** — which S3 operations Garage does / doesn't implement (multipart,
  presigned URLs, conditional ops) — the "sufficient not complete" boundary, from source not blog.
- **Layout / partition behavior** — relevant if we scale nodes; the `init-garage.sh` layout assumes
  single-node dev.

## Grounding
- Existing position: `.research/analysis/positions/garage-object-storage.md`.
- Method: the **vendored-source research mode** (clone-at-pinned-version; source = `source-direct`
  tier, docs = portal tier; the two-pronged applicability gate). Carried in the
  `research_origin: vendored-source-research-mode` frontmatter; the orchestrator reads it at kickoff.

## Applicability check (the gate)
Source-available ✓ (OSS). Behavior/version-internals load-bearing ✓ (consistency/durability is
load-bearing for content+playout; the "sufficient" S3-compat boundary is exactly a behavior
question docs answer poorly). Passes.
