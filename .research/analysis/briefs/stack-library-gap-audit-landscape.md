---
status: complete
authored: 2026-06-18
provenance: agent-synthesis
related:
  - to: ../positions/srs-streaming-server.md
    type: cites
    note: SRS selection position; this audit closes open Qs it left and corrects skill drift
  - to: ../positions/route-handler-ceremony.md
    type: cites
    note: the deliberate 6-step ceremony; audit confirms it's grounded, finds vestigial casts
  - to: ../positions/api-source-of-truth.md
    type: cites
    note: the hand-written three-layer / RPC-deferral; audit confirms the deferral is source-grounded
---

# Stack-library gap audit — tusd / SRS / Hono against our codebase

**Engagement:** `stack-library-gap-audit` (`[research]`, vendored-source mode). Source-confirmed
library behavior cross-checked against *our actual code*, the Liquidsoap-audit pattern applied to
the next-highest-signal subset. Three libraries cloned at their pinned versions, each behavior
verified at file:line on both sides, the load-bearing findings adversarially refuted.

**Sources (cloned, attested):**
- tusd **v2.9.2** (`@1215a10`) — `.research/attestation/tusd-src-2-9-2.md`
- SRS **v6.0.48** (`@1d878c2`) — `.research/attestation/srs-src-v6.md` — *version caveat below*
- Hono **v4.12.12** (`@c37ba26`) — `.research/attestation/hono-src-4-12-8.md`

## Headline

Our code **understands these libraries well** — across three libraries and 30+ checked behaviors,
the adversarial pass overturned exactly one specialist finding, and it overturned it in our
*favour* (a "misunderstanding" that turned out to be removable cruft, not a bug). No high-severity
*behavioral* misunderstanding survived verification. The real yield is in three buckets:

1. **One unpinned image** on a load-bearing path (tusd) — the clearest actionable.
2. **Skill drift** — three skills carry claims that are correct-but-incomplete or (one case)
   actively misleading about a failure mode. These are the highest-value fixes: a wrong skill
   misleads the *next* engagement.
3. **Vestigial over-engineering** — 122 redundant type-casts in our routes that the framework
   doesn't need (confirmed by stripping them and re-running `tsc`).

## Findings by severity

### HIGH

**[srs-on-forward-rejects-publish] — skill correction (confirmed).** Our `srs-v6` skill says
returning `code:1` from the `on_forward` hook "does not reject the publish itself." **Source
contradicts this:** a non-zero `code` (or any HTTP status other than 200/201) from
`on_forward_backend` propagates as a hard error through `create_backend_forwarders`
(srs_app_source.cpp:1533) → `SrsOriginHub::on_publish` (:1120) → `acquire_publish`
(srs_app_rtmp_conn.cpp:1137) → the publish never starts (`publishing()` gates on
`acquire_publish == success`, :950). Verified end-to-end with no swallow in the path (SRS uses
`srs_error_t` return propagation, not exceptions). **Our production code is safe** —
`streaming.routes.ts` returns `{code:0, data:{urls:[]}}` in all three branches, so it never trips
this. The hazard is forward-looking: a future change that returns `code:1` to "skip forwarding"
would silently kill the publish. {confidence: high — but cited at v6.0.48 line numbers; running
container is v6.0.184, see caveat}
→ *direction: correct the skill (and reference.md) — a non-2xx / non-zero-code on_forward response
rejects the entire publish; return `{code:0, data:{urls:[]}}` to publish with no destinations.*

**[tusd-unpinned-latest] — fix (confirmed).** `docker-compose.yml:130` runs
`tusproject/tusd:latest` — unpinned, no digest, on the load-bearing upload path. `:latest` floats;
upstream has moved to **v2.10.0** while our orient/clone work is against v2.9.2, so a rebuild can
silently change the upload server's behavior. (Careful framing: the git clone tag is not proof the
registry `:latest` *currently* resolves to v2.9.2 — those are independent tag spaces. The actionable
fact is that `:latest` is unpinned and upstream has advanced.)
→ *direction: pin `tusproject/tusd:v2.9.2` (the tracked `pin-docker-compose-image-versions` story
is the home; this is the same class as the SRS `:6` and other floating tags).*

### MEDIUM

**[tusd-post-finish-fire-and-forget] — skill correction (confirmed, reworded).** tusd's
`post-finish` hook is dispatched async (`invokeHookAsync` spawns a goroutine and discards its
return, pkg/hooks/hooks.go:206-211); the PATCH-finish path writes the client's 204
(unrouted_handler.go:797) and the response is **not gated on the hook result**. So our
`handlePostFinish` doing S3 copy + delete + DB write is correct *as best-effort async work*, but a
500 we return is discarded — the client never learns whether that work succeeded. (Reworded from
the specialist's "client has already received its 204": the exact interleave is a goroutine race,
so the guarantee is "not gated on the hook," not strict ordering.)
→ *direction: correct the skill — post-finish errors are logged by tusd and discarded; the client
is unaffected; if post-finish work must be durable, hand it to pg-boss rather than relying on the
hook response. (Ties to the pg-boss orient: durable follow-up work is exactly pg-boss's job.)*

**[srs-on-unpublish-swallows-errors] — skill correction (confirmed).** `on_unpublish` returns
`void` and on a callback failure does `srs_freep(err); srs_warn(...); return` (srs_app_http_hooks.cpp:200-206)
— silently swallowed; `on_publish` returns `srs_error_t` and is fatal (:156-159). So if our
unpublish endpoint errors or is unreachable, SRS still tears down the publisher with no retry and
no signal. Our handler returns `{code:0}` correctly, but the best-effort semantics are inherited
from SRS, not our choice.
→ *direction: add a gotcha to the skill — on_unpublish callback errors are silently ignored by
SRS (no retry, no signal); on_publish errors are fatal. Don't rely on on_unpublish for anything
that must not be lost.*

### LOW / CONFIRMED-CORRECT (no action, or skill polish)

- **[hono-vestigial-casts] — cleanup opportunity (specialist finding overturned → reframed).** The
  `hono-gap` specialist claimed our 122 `c.req.valid("param" as never) as T` casts are *required*
  because our routes use bare `new Hono<AuthEnv>()`. **Adversarial verification refuted this**:
  stripping every cast from `content-media.routes.ts` and `playout.routes.ts` and running
  `tsc --noEmit` on `@snc/api` passed clean (exit 0); seven route files already use `valid()` with
  no cast. The inline `validator()` propagates the `Input` type via the method-chain overload, not
  the instance `S` generic — so the casts are **vestigial, not a Hono limitation**. The
  `hono-src` attestation's observation 4 was corrected accordingly.
  → *direction: optional `[refactor]`/cleanup — remove the redundant casts (mechanical, ~122 sites
  across the route files). Not a misunderstanding; not urgent. NOT a skill change — the skill's
  cast-free examples are correct.*
- **[hono-error-handler], [hono-require-role], [hono-rpc-deferral] — confirmed correct.** Our
  `app.onError` AppError mapping correctly supplements Hono's default (which only handles
  `HTTPException`); `requireRole` doesn't duplicate any shipped middleware; the Hono-RPC deferral
  in `api-source-of-truth.md` is correctly grounded in how `hc<typeof app>()` accumulates schema
  types. The deliberate 6-step ceremony and three-layer pattern hold up — no over-engineering
  beyond the cast cleanup.
- **[hono skill drift, low] — 3 under-explained gotchas.** The `hono-v4` skill's anti-pattern
  notes (validators-must-be-inline, no-controller-split, wildcard-path-middleware) are *directionally
  correct* but under-explain the mechanism. Optional skill polish.
- **[tusd confirmed-correct] —** `.info` sidecar deletion, pre-create rejection status propagation,
  enabled-hooks subset, metadata field mapping, Content-Type-on-all-responses: all verified correct.
  Any future "cleanup stale uploads" job is *complementary* to tusd (tusd only cleans on explicit
  Terminate), and should call tusd's `DELETE` endpoint, not raw S3.
- **[srs confirmed-correct] —** callback query-param auth (SRS adds no signing; query param is the
  only mechanism — our `timingSafeEqual` is correct), `on_forward` response shape, on_publish →
  on_forward ordering, vcodec is an FFmpeg passthrough string. **Open questions from the Liquidsoap
  audit, now closed:** `max_connections` (default 1000, ours 100) is the *only* global connection
  limit in config — no separate `max_streams`/`max_vhosts` cap; `on_forward` fires after
  `on_publish` as a distinct mechanism from `http_hooks`; `vcodec` accepts any string.
- **[srs schema omissions, low] —** `SrsOnPublishSchema` omits `stream_url`/`stream_id`/`server_id`/
  `service_id` that SRS sends; Zod strips them, no bug. Add only if future routing needs them.

## Disconfirming analysis

The over-engineering bucket is where taste masquerades as a finding, so it got the hardest
disconfirming pass: the hono ceremony findings were checked against the *deliberate* status-quo
positions (`route-handler-ceremony.md`, `api-source-of-truth.md`), and the one concrete
over-engineering claim (required casts) was empirically falsified by stripping the casts and
recompiling — which flipped it from "misunderstanding" to "removable cruft." The SRS callback-auth
"over-engineering" candidate was also dropped: `timingSafeEqual` on a static secret is correct by
default, not over-built. Net: no over-engineering finding survived as a behavioral problem; the
only real cleanup is the vestigial casts.

## Version caveat (SRS)

The running SRS container reports **v6.0.184** (via `srs -v`), but no `v6.0.184` git tag exists on
GitHub; the clone used **v6.0.48** as the nearest tagged stable release. The hook/config
architecture is stable across the v6 minor line and nothing in the cited paths looks version-fragile,
but the SRS file:line anchors are v6.0.48-relative. {confidence: medium for exact line numbers;
high for the behaviors}. If a v6.0.184-exact re-verification is ever needed, it is a bounded re-check
of the same paths.

## Suggested triage (operator decides — no items emitted by this engagement)

| Finding | Kind | Severity | Direction |
|---|---|---|---|
| tusd `:latest` unpinned | fix | high | pin `v2.9.2` (→ `pin-docker-compose-image-versions`) |
| srs on_forward rejects publish | correct-skill | high | rewrite skill + reference.md on_forward semantics |
| tusd post-finish fire-and-forget | correct-skill | medium | document discard + pg-boss-for-durability |
| srs on_unpublish swallows errors | correct-skill | medium | add gotcha |
| hono vestigial `as never` casts | simplify | low | optional `[refactor]`, ~122 sites |
| hono skill gotcha depth (×3) | correct-skill | low | optional polish |

Run `/agentic-research:research-handoff stack-library-gap-audit` to emit operator-confirmed `.work/`
items from these. Deferred from this pass: garage, imgproxy (lower-urgency per their backlog items).
