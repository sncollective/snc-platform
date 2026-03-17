# Platform Documentation — Discovery

> Evaluated 2026-03-17. Covers format and structure decisions, not external tooling.

## Context

The platform has 12 undocumented feature domains (see BACKLOG.md). Two audiences need coverage: human contributors/operators and AI agents. The existing agent documentation system (CLAUDE.md, 31 pattern files, framework references) is mature but covers conventions — not domain knowledge.

## Evaluation Criteria

From org values and charter commitments:
- **Open by default** — docs accessible to external contributors
- **Clarity over elegance** — plain language, no filler
- **No duplication** — each doc has one audience and one purpose
- **Traceability** — link to source code, rationale, and decisions
- **Agent context efficiency** — short, modular files that auto-load without bloating context

## Candidates Evaluated

| Approach | Human | Agent | Verdict |
|----------|-------|-------|---------|
| **A. Plain markdown guides** in `platform/docs/` | ✓ | — | **Selected** |
| **B. `.claude/rules/` domain files** | — | ✓ | **Selected** |
| **C. Skill-per-domain** in `.claude/skills/` | — | ✓ | Future option — promote rules files if needed |
| **D. Extend CLAUDE.md** with domain sections | — | ✓ | Rejected — already 229 lines, risks bloat |
| **E. Generated docs from code** | ✓ | ~ | Rejected — premature, needs human judgment |

## Recommendation: A + B

### Human docs (`platform/docs/`)

One markdown file per domain. Structure follows existing platform conventions:
- Direct, technical tone (matches README.md)
- Tables for lookup (data models, config, endpoints)
- Code blocks for commands and examples
- Links to source files with paths
- No duplication of OpenAPI auto-generated endpoint docs

### Agent docs (`platform/.claude/rules/`)

One markdown file per domain that needs agent context. Structure follows pattern file conventions:
- Short: 60–100 lines
- Structured: schemas, relationships, key flows, decision rationale
- Supplements existing CLAUDE.md and pattern files — never restates them
- Auto-loaded when agents work in the codebase

### Per-Domain Audience Decision

Each backlog item gets assigned to one or both audiences:

| Domain | Human guide | Agent context | Notes |
|--------|:-----------:|:-------------:|-------|
| Getting Started | ✓ | — | Onboarding is human-only |
| Federation (ActivityPub) | ✓ | ✓ | Agents need federation model for implementation |
| Calendar System | ✓ | ✓ | Agents need event model and iCal integration details |
| Emissions Tracking | ✓ | ✓ | Agents need calculation methodology and data sources |
| Admin System | ✓ | ✓ | Agents need role/permission model |
| OIDC / Auth Architecture | ✓ | ✓ | Agents need session model and auth flow |
| Feature Flags | ✓ | ✓ | Agents need flag list and gating mechanism |
| Email Service | ✓ | — | Small surface area, human guide sufficient |
| Creator Teams | ✓ | ✓ | Agents need team model and permissions |
| Rate Limiting | ✓ | ✓ | Agents need limits and config for route work |
| Database Schema Reference | ✓ | — | Agents already have schema files in CLAUDE.md |
| Seeding Scripts | ✓ | — | Operational guide for humans |

**Totals:** 12 human guides, 8 agent context files.
