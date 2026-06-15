---
campaign: sse-client-pattern
role: adversarial-read
stage: verification
verification_rigor: standard
reviewed: 2026-06-15
verdict: APPROVED
---

# Verification checklist — sse-client-pattern (adversarial-read)

Fresh-context skeptical pass over the position, parent synthesis, three specialist
briefs, and all 18 attestations. Verdict: **APPROVED** (no blocking findings; three
minor cosmetic notes a revision pass *may* address but none of which undermine a
load-bearing claim).

Artifacts read in full: `positions/sse-client-pattern.md`, `campaigns/.../parent.md`,
`specialists/{transport,react-integration,testing}.md`, and attestations
whatwg-sse-eventsource, mdn-eventsource, microsoft-fetch-event-source,
mdn-fetch-credentials, react-docs-{usesyncexternalstore, useeffect, strictmode,
synchronizing-with-effects, usecontext}, remix-utils-use-event-source,
epicreact-usesyncexternalstore-demystified, oneuptime-sse-react-guide,
jsdom-readme-unimplemented, vitest-vi-stubglobal, vitest-fake-timers,
rtl-renderhook-act, eventsourcemock-readme, eventsource-npm-readme. Codebase
spot-check: `apps/web/vitest.config.ts` + `apps/web/tests/setup.ts`.

---

## Job (a) — semantic citation-chain walk (does each cited attestation support the claim *as stated*?)

PASS on all load-bearing chains. The three transport claims the engagement-params
flagged were walked individually:

1. **"no `id:` → no Last-Event-ID"** (position §2; transport Q2). Attestation
   whatwg-sse-eventsource §"Last-Event-ID is conditional" carries the verbatim spec
   passage: the header is set "If the EventSource object's last event ID string is not
   the empty string," and the buffer is populated *only* by an `id:` field. The brief's
   inference (no `id:` ever ⇒ empty buffer ⇒ no header) is the spec's own conditional
   read in contrapositive, **not an over-read**. Semantically supported.

2. **"clean-close → reestablish, not fail"** (position §2; transport Q3). Attestation
   carries two distinct spec passages: network-error → "reestablish the connection,
   unless the user agent knows that to be futile," and the *terminal* fail path reserved
   for "non-200 status or wrong content-type." The brief correctly classifies a
   server-ended HTTP-200 stream as a network-level close routed to *reestablish*. This
   is the one chain worth scrutiny because the spec passage describes "network error,"
   and a graceful server FIN is being read as a "network error" for routing purposes —
   but the attestation's framing ("A server closing the TCP stream ... is a
   network-level connection drop from the client's view") makes that bridge explicit and
   the spec's terminal-case enumeration (non-200 / wrong-content-type / close()) is
   exhaustive enough that a *completed* 200 stream cannot land on the fail path.
   Supported, with the bridge reasoning visible rather than smoothed. Good.

3. **"`withCredentials` is cross-origin only"** (position §1; transport Q1 + disconfirming).
   Attestation mdn-eventsource: withCredentials is "whether the `EventSource` object was
   instantiated with cross-origin (CORS) credentials set ... (`false`, the default)."
   The claim that a same-origin EventSource sends cookies *without* withCredentials is a
   correct read of "cross-origin (CORS) credentials" — withCredentials governs the CORS
   credentials mode, which is a cross-origin concept. Semantically supported. (The
   parallel fetch-credentials claim chains cleanly to mdn-fetch-credentials "Defaults to
   `same-origin`.")

React-shape chains also walked: useSyncExternalStore subscribe-stability,
getSnapshot-caching, getServerSnapshot-or-throw all carry verbatim support in
react-docs-usesyncexternalstore. StrictMode setup→cleanup→setup and the
"connections jump to 2" stress-test chain to react-docs-strictmode /
react-docs-synchronizing-with-effects verbatim. The "don't use refs to suppress"
anti-pattern chains to react-docs-synchronizing-with-effects's explicit "Don't use
refs to prevent Effects from firing" header. All supported.

## Job (b) — claim-shapes the mechanical lint missed (uncited attributions, over-extended cite-throughs, comparatives-as-description)

PASS. Checked specifically for composed-claim violations (the discipline's §6):

- No composed effort estimates anywhere (no dev-day / LoC figures presented as
  research findings). The testing brief's "~30 lines" / "comparable in size to the
  existing ResizeObserver polyfill" is a *sizing analogy to an observed codebase
  artifact* (the real `tests/setup.ts` polyfills, which I verified exist), not a
  composed estimate of unwritten work — it stays on the right side of the fence.
- The testing brief's `FakeEventSource` code sketch is explicitly labeled "illustrative,
  composed from the cited APIs — not a verbatim source quote," correctly NOT carrying a
  `[handle]{N}` citation on the code block itself (the API facts it composes from are
  cited around it). Correct discipline.
- One **near-miss, not a violation**: position §3 calls useSyncExternalStore "the
  correct React primitive for an external mutable event source." "Correct" reads as
  near-superlative, but it is a direct paraphrase of epicreact's "the correct, robust
  solution" for "syncing with state outside React" — a cited source's own framing, not
  an agent-composed superlative. Acceptable; it inherits the source's word.
- "native EventSource cannot do any of those" (transport revisit-if, re POST/headers/
  method) is cited to microsoft-fetch-event-source, whose README enumerates exactly
  those EventSource limitations verbatim. Supported, not an uncited named-feature claim.

## Job (c) — coherence-read for smoothed contradictions

PASS. The parent's contradiction ledger is honest: it explicitly records that NO hard
contradiction was met and downgrades two items to `tension` (per-URL keying vs
single-URL-partial-grant; native-vs-fetch held-open-then-closed). Both tensions are
presented as *scoping differences*, not paraphrased away. The remix-utils per-URL
keying tension is the one that could have been smoothed — the parent and the
react-integration brief both surface it side-by-side (remix-utils keys per-URL;
the spine collapses to one key) rather than merging them under a single claim. This
is the §5 "named positions side-by-side, no resolution-by-paraphrase" discipline done
correctly.

## Job (d) — noise-domination (less-relevant citation where a more-relevant attestation went uncited)

PASS. Per major claim I checked whether a stronger attestation was available and
under-deployed:

- Transport claims correctly privilege whatwg-sse-eventsource (the normative authority)
  over mdn-eventsource (explicitly demoted to "developer-facing restatement" in the
  attestation's own structural metadata, and the attestation honestly flags that the
  fetched MDN page "did not carry the reconnection-timing prose — that detail is taken
  from the WHATWG spec"). The right source is load-bearing where it should be; MDN is
  used only for the constructor/withCredentials surface it actually covers. No inversion.
- React architecture claims privilege the official react-docs over the community
  sources (epicreact/oneuptime/remix-utils), using community sources for *corroboration
  of the idiom* ("an established community implementation reaches for the same
  structure") rather than as primary authority for the primitive's contract. Correct
  layering — see job (f).

## Job (e) — quote-context walk (verbatim quotes stripped of a source qualifier)

PASS. Spot-checked the highest-risk quotes:

- transport's "implementation-defined value, probably in the region of a few seconds"
  is quoted *with* its qualifier intact and used to support the negative claim ("the
  spec fixes no numeric default"), which is the quote's actual import. Not stripped.
- The "reestablish the connection, unless the user agent knows that to be futile" quote
  keeps the "unless ... futile" clause, which matters (it is the hook for the terminal
  case). Not truncated to overstate auto-reconnect reliability.
- testing's jsdom "has many missing APIs" / "haven't gotten to yet" quotes preserve the
  negative-finding framing (EventSource is absent-by-omission, not absent-by-explicit-
  exclusion — only Navigation + Layout are explicitly scoped out). The brief does not
  overclaim jsdom "explicitly excludes EventSource"; it correctly says EventSource falls
  in the broad unimplemented bucket. Faithful.

## Job (f) — analytical-tier-inheritance (synthesis inheriting prior-artifact framing as source-attested)

PASS — and this was the engagement's explicit watch-item. Confirmed correct lens-use:

- **parent.md cites the specialist briefs as `[facet]` lens, NOT as `[handle]{N}`.**
  Verified by reading: parent uses `[transport-facet]`, `[react-integration-facet]`,
  `[testing-facet]` inline, and its "Citation note" section states the rule explicitly
  ("cites the *briefs* as lens ... not as `[handle]{N}` source citations — the
  lens-not-substrate guard"). No specialist brief is ever a `[handle]{N}` target. This
  is the discipline's §1 lens-not-substrate guard observed exactly. **Not laundered.**
- The testing brief's codebase observations (`vitest.config.ts` flags, `tests/setup.ts`
  polyfills) are explicitly marked "lens, not citation" and carry NO `[handle]{N}` — the
  codebase is deployment substrate, correctly not source-attested. I verified these
  observations against the real files (job h / spot-check): `environment: "jsdom"`,
  `restoreMocks: true`, `unstubGlobals: true`, and the `typeof globalThis.X ===
  "undefined"` guard-then-assign for ResizeObserver + Element.prototype.scrollTo are all
  present as described. Accurate lens, correctly uncited.
- The position inherits the briefs' framing (it is the lifted recommendation) — that is
  the position tier's *job*, and it does not dress facet reasoning as source-attestation;
  its source-grounded claims carry their own through-line to attestations via the briefs.

## Job (g) — line/section-reference walk (cited ranges exist and support the claim)

PASS. The attestations anchor by spec section (§9.2.2, §9.2.3, §9.2.6, processResponse)
and by named README/doc subsection rather than by line number, and each anchor's quoted
passage is present in the attestation body and matches the brief's use. Spot-checked
§9.2.3 reestablish (Last-Event-ID conditional + reconnect-wait), §9.2.6 (`retry:` digit
parsing), processResponse (200 + content-type validation) — all present and on-point.
The 204-stops-reconnection claim (transport Q3) chains to the attestation's
"HTTP 204 stops reconnection (non-normative note)" line. Supported.

## Job (h) — thin-attestation semantic check (attestations too thin to support per-claim citation)

PASS. Every attestation carries `## Key passages` with `>`-equivalent blockquoted source
text or fenced verbatim code, clearing the GR.5 thin-attestation fence. The two
community blog sources (epicreact, oneuptime) are paraphrase-plus-quoted-passage and are
used only for *corroboration*, not as sole support for any load-bearing contract — the
load-bearing contracts (spec semantics, React primitive contracts) all rest on
normative/official attestations. The lint's two `[low] unreachable-source` flags
(oneuptime-sse-react-guide, rtl-renderhook-act) are URL-liveness false-negatives on real
pages per the engagement params, not resolution failures — confirmed both handles
resolve to substantive attestation bodies. No thin attestation is doing load-bearing
work.

---

## Architecture-recommendation grounding check (engagement watch-item #3)

The position's two architecture pillars are correctly grounded, not over-extended onto
community sources:

- **single provider / one EventSource per tab**: grounded primarily in the
  *constraint* (server maxConnections cap + 3 planned consumers, from the seed) and in
  react-docs-usecontext's "single shared resource to a subtree" use case
  [react-docs-usecontext]; community sources (remix-utils reference-counted connection
  map, oneuptime "single connection with event routing") *corroborate the idiom* but are
  not the sole warrant. Correctly layered.
- **useSyncExternalStore bridge**: grounded in the official react-docs-usesyncexternalstore
  contract (subscribe/getSnapshot/getServerSnapshot, tearing under concurrent rendering)
  with epicreact as practitioner corroboration. The tearing-guarantee claim — the
  load-bearing reason to prefer it over useEffect+useState — traces to both the official
  docs (the primitive's stated purpose) and epicreact's explicit tearing passage. Not an
  over-extension of community sources.

The position is also appropriately hedged: §"Confidence + boundaries" names the
useSyncExternalStore-vs-memoized-context choice as "the softest point" and the
`revisit_if` frontmatter encodes the event-volume trigger. Honest confidence calibration
for `standard` rigor.

---

## Minor / cosmetic notes (non-blocking; revision optional)

1. **`{N}` ordinal inconsistency across briefs.** Per CONVENTIONS §Citation rule, with
   no reference corpus maintained, `{N}` is "used as a plain ordinal" — so it is
   artifact-local and does not break resolution (the *handle* resolves, and all handles
   are correct). But the ordinals are internally inconsistent: e.g. transport.md cites
   `[mdn-fetch-credentials]{1}` though that source is the 4th in its frontmatter
   `attestations:` list (and `{4}` would be the natural per-source index), while
   `[microsoft-fetch-event-source]{3}` *does* match its frontmatter position. The lint
   passes because handles resolve regardless of `{N}`. Purely cosmetic; a revision pass
   *could* normalize `{N}` to frontmatter order for tidiness, but nothing is broken.

2. **transport "clean-close → network error" bridge** (job a, claim 2) is the single
   thinnest piece of reasoning — a graceful server stream-end being routed through the
   spec's "network error → reestablish" branch. It IS correct (the terminal fail-cases
   are exhaustively non-200/wrong-content-type/close(), so a completed 200 stream cannot
   be terminal), and the attestation makes the bridge explicit. No change needed, flagged
   only as the place a future reader should look first if this claim is ever challenged.

3. **eventsourcemock npm version**: testing brief §4 prose says "npm `2.0.0`" in one
   place and the attestation frontmatter agrees (2.0.0); consistent. (Checked because the
   brief also references "gcedo/tamlyn lineage" — lineage attribution is in the
   attestation, internally consistent.) No issue.

---

## Verdict: APPROVED

All three load-bearing transport claims (no-`id:`→no-Last-Event-ID; clean-close→
reestablish; withCredentials-cross-origin-only) are semantically supported by the
whatwg/mdn attestations, not over-read. The parent's `[facet]`-as-lens citation is
correct lens-use, not laundered source-attestation. The architecture recommendation
(single provider + useSyncExternalStore) is grounded in official react-docs with
community corroboration appropriately subordinated. Contradiction-handling is honest
(tensions surfaced side-by-side, not smoothed), disconfirming analysis is documented at
both facet and cross-synthesis level, no composed-claim violations, no thin attestations
doing load-bearing work, and the codebase lens-claims verify against the real files. The
three notes above are cosmetic and do not require a revision pass to ship the position.
