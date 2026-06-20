---
status: held
authored: 2026-06-20
provenance: agent-synthesis
revisit_if:
  - A third org role is genuinely needed (the 5→2 collapse is reconsidered) — at that point weigh a role hierarchy (admin > stakeholder > …) against the current flat OR-semantics model
  - The per-request uncached role fetch (getUserRoles) shows up as a measured latency/DB-load problem — add a request-scoped or short-TTL cache, or move roles into the session/JWT
  - A fourth ad-hoc authorization tier appears (beyond org-role, creator-permission, and the content-access free-access tier) — the "two orthogonal systems" framing is leaking; reconcile before it sprawls further
  - better-auth ships a stable roles/admin plugin that subsumes the hand-rolled user_roles table without losing multi-role support
---

# Position: Authorization model — two orthogonal systems (org roles + per-creator permissions)

**Status: held.** The two-system architecture is sound and kept. What is *not* settled is its
**completeness**: a multi-month migration off coarse org-role route gating onto fine-grained
per-creator permissions is still in progress, and `manageStreaming` is only half-adopted. Those
are tracked cleanup, not an architecture change.

## The stance

**Authorization is two independent layers, by design:**

1. **Org roles** (`stakeholder`, `admin`) — platform-wide standing. *Who you are on the
   cooperative.* `admin` = platform operator; `stakeholder` = co-op governance member.
2. **Creator-team permissions** (`owner` / `editor` / `viewer` → a 6-key permission matrix) —
   per-creator-entity standing. *What you can do within one creator's page.*

This split is intentional and documented (`docs/auth.md`: "'Creator' is an entity type, not a
role"; `docs/creators.md`: "Team roles are orthogonal to platform roles"). It mirrors the
standard org/repo model (GitHub, GitLab). **It is not the thing to redesign.** A ground-up
rebuild or a collapse-into-one-system was considered and rejected — see below.

### The two systems, concretely

| | Org roles | Creator-team permissions |
|---|---|---|
| Defined | `packages/shared/src/auth.ts` (`ROLES`) | `packages/shared/src/creator.ts` (`CREATOR_ROLE_PERMISSIONS`) |
| Values | `stakeholder`, `admin` | roles `owner`/`editor`/`viewer`; perms `editProfile`, `manageContent`, `manageScheduling`, `manageMembers`, `viewPrivate`, `manageStreaming` |
| Storage | `user_roles` join table (`userId, role`), many-to-many | `creator_members` join table (`creatorId, userId, role`), one role per user per creator |
| Enforcement | `requireRole(...)` Hono **middleware** (~44 sites; OR semantics) | `requireCreatorPermission(...)` **service function** (~32 sites) |
| Resolution | `requireAuth` → `getUserRoles` (fresh DB query, **no cache**) → `c.set("roles")` | per-call DB query in `checkCreatorPermission` (**no cache**) |
| Auth library | better-auth handles users/sessions/OAuth; roles are a **hand-rolled table alongside** it, not a better-auth plugin | n/a |

The matrix (`CREATOR_ROLE_PERMISSIONS`) lives in `@snc/shared` and is read by **both** API
(authorization) and web (conditional nav) — single source of truth, no client/server
duplication of the matrix itself.

### Where the two intersect (the seams)

- **The `admin` bypass.** `checkCreatorPermission` returns `true` immediately if org roles
  include `admin` (`creator-team.ts:38`). Platform admins get implicit owner-level access to
  every creator. `stakeholder` does **not** bypass. This is correct and intended — but it is
  **silent** (no audit log, unlike the `ForbiddenError` path that logs denials).
- **A third, ad-hoc access tier.** `content-access.ts:81` grants free content access to
  stakeholders *and* creator members — a separate path from both systems above. Conceptually
  this is a third authorization surface; flagged as a watch item (a fourth would mean the
  "two orthogonal systems" framing is leaking).

## How it got here (why it's incomplete, not wrong)

The model **accreted, then was rationalized** — the docs declaring it "deliberate" were written
*after* the split already existed:

- **2026-03-04** — better-auth + a **5-role** org system (`subscriber, creator,
  cooperative-member, service-client, admin`); creators 1:1 with users.
- **2026-03-16** — creator-team permission matrix bolted on; re-architected creators into
  many-to-many teams.
- **2026-03-17** — the defining move: org roles **collapse 5 → 2** (`stakeholder, admin`), no
  rationale in the commit. "creator" stops being a role, becomes an entity.
- **2026-03-24** — `docs/auth.md` / `docs/creators.md` codify the split as intentional.
- **2026-04-18 (0.3.0)** — `access-model` feature: explicit redesign repositioning
  `stakeholder` from "page-management gate" to "governance role"; creator-manage switches to
  membership-OR-admin.
- **2026-06-20** — calendar checkbox fix removed the last `requireRole("stakeholder")` blanket
  guard from `creator-events.routes.ts` (a creator member without an org role was 403'd before
  their creator permission was checked). This was a symptom of the half-finished migration.

The throughline: the platform has been **incrementally shedding coarse `requireRole` route
gating on creator-scoped operations in favor of fine-grained `requireCreatorPermission`** since
March. It is not done.

## Open gaps (verified 2026-06-20, in code — not yet fixed)

These are the concrete, grounded smells. They are *cleanup within the model*, scoped as a work
item, not reasons to redesign:

1. **One remaining live dual-gate (latent 403 bug).** `project.routes.ts:82` applies a
   router-wide `requireRole("stakeholder")` over a per-handler
   `requireCreatorPermission("manageScheduling")` (`:219`). A creator member with
   `manageScheduling` but no `stakeholder` role is 403'd creating a project — the exact bug
   class fixed in creator-events today. (creator-events is now clean.)
2. **`manageStreaming` is half-adopted.** The permission exists in the matrix (added 2026-04-24,
   owner-only) and is used correctly in `stream-keys.ts:41` + `simulcast.ts:61`, but:
   - `streaming-connect.routes.ts:60,141` gates OAuth connect/disconnect on **`manageMembers`**
     — the wrong permission (should be `manageStreaming`).
   - `manage.tsx:114` hard-codes the Streaming nav as `memberRole !== "owner"` with a **stale
     comment** ("not in permission matrix") — it *is* in the matrix; the client ignores the
     matrix it imports.
3. **No caching** on either `getUserRoles` (per request) or `checkCreatorPermission` (per call)
   — N+1 risk in loops (feed pin, bulk ops). Perf, not correctness.
4. **Silent admin bypass** — no audit trail when an org admin acts via the creator-permission
   bypass.

## Rejected alternatives (load-bearing)

- **Collapse into one permission system.** Rejected — org standing and per-entity standing are
  genuinely different axes (a co-op governance member is not automatically a member of any
  creator's team, and vice versa). Folding them loses that orthogonality and forces every
  creator-team role to also be an org role or vice versa. The standard org/repo two-layer model
  is correct here.
- **Ground-up rebuild.** Rejected — the architecture is fine; the cost is in *finishing* the
  existing migration and fixing three or four named inconsistencies. A rebuild would re-derive
  the same two-system design at far higher risk.
- **Role hierarchy (`admin` > `stakeholder` > member).** Not adopted now — current enforcement
  is flat OR-semantics (`requireRole` checks membership in a set). A hierarchy is only worth it
  if a third org role lands; tracked in `revisit_if`.
- **better-auth admin/roles plugin instead of the hand-rolled `user_roles` table.** Not
  adopted — the hand-rolled table predates a stable plugin and supports multi-role per user
  cleanly; revisit only if the plugin subsumes it without regressions.
