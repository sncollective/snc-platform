# 2026-07-15..17 — Forgejo CI ingestion loop + run 97/98 triage → dep + e2e fixes → deploy parity

## Outcome

Built the agent→Forgejo-CI ingestion loop (token + `ci-result-summary` artifact) end-to-end, and
triaged a long CI failure streak down to root causes across **`platform-test-and-build` runs
97–109** and **`platform-deploy-demo` run 544**. Cleared every code-level failure: the
`streaming-callbacks.ts` untracked-file bug, all 20 `bun audit` advisories (1 critical → 0 high),
the typecheck errors (e2e vitest, web fixture), the e2e Playwright crash, and the vite-8 force.
Demo deploy is now **live and healthy** (`demo.s-nc.org/health` → 200); the one remaining CI red
is the **e2e suite's pre-existing SSR "fetch failed"** (never passed in recorded history), plus
the **deploy health-check false positive** (3s `sleep` too short — fix drafted, not yet landed).

**Key forward investment landed:** the `ci-result-summary` workflow job (one-fetch triage topology)
+ a Forgejo API token (`read:repository`, owner-gated). **Key limitation discovered:** the
Actions logs/jobs/artifacts REST endpoints don't exist on v15.0.5 (PR #12666 merged post-release)
— so the autonomous *log fetch* loop is blocked until a Forgejo upgrade; today the agent reads run
status via API but still needs the operator to drop job logs into `.CILogs/`.

## How we got here (the session arc)

### 1. The ingestion-loop design (token + ci-result-summary)
Started from "what's the best way to feed you forgejo action results." Discovered Actions weren't
on `snc-platform` (public) — workflows live in the private **parent** `sncollective/SNC`, checking
out the platform submodule via `PLATFORM_READ_TOKEN`. Designed a token + artifact loop:
operator dispatches → agent monitors run status → reads `ci-result.json` → fetches only failing
job logs. Drafted the `ci-result-summary` job (writes per-job status JSON, `if: always()`, no
checkout) as a parent-`.work/` story.

### 2. The token + sandbox saga (three wrong guesses, then the truth)
- **Wrong:** told the user to create a token with scope `read:action` — **no such scope exists**
  in Forgejo; Actions routes fall under `repository`. User caught it in the UI.
- **Wrong:** said repo-specific tokens were available — that's a **v15.0 feature**, user was on
  v14.0.2. Upgraded Forgejo to v15.0.5 (LTS, v14 EOL'd April).
- **Wrong:** pointed the user at `.claude/settings.local.json` for the `allowRead` carve-out —
  **that's Claude Code's config, not pi's.** The user is on pi/glm, not Claude. Chased into the
  pi-sandbox extension source: reads `~/.pi/agent/extensions/sandbox.json`, and **`allowRead`
  isn't a field** (adding it fail-closed bash + file tools). Eventually proved the token file is
  just readable by default (`denyRead` is a denylist; `.forgejo-ci-token` matches no glob) — the
  entire `allowRead` detour was unnecessary.
- **Fixed:** the platform `AGENTS.md` "Running tests from the agent sandbox" section documented
  the Claude Code carve-out as if universal. Rewrote it pi-first (pi-sandbox, `denyRead` denylist,
  host-netns `mode: open`), demoted the Claude Code forwarder+carve-out to a historical note
  since that runtime is no longer used on this machine. Committed in platform submodule.

### 3. Triage of runs 97/98 — three real root causes
Operator dropped CI logs into `.CILogs/`. Found:
- **`streaming-callbacks.ts` untracked** — `streaming.routes.ts` imports 6 symbols from it; CI
  checkout got a broken module ref → 43/43 streaming test failures + TS2307. One-liner fix (track
  the file). **This was the root cause of the whole failure streak.**
- **`bun audit` 20 vulns (1 critical better-auth CVE + 19 high)** — bumped better-auth
  `^1.5.4` → `~1.6.23` (clears the critical + associated highs).
- **typecheck errors** — e2e `determinism.test.ts` imported vitest without the dep; web
  `use-polling.test.ts` had a `as const` narrowing bug.
Filed three stories in `platform/.work/active/stories/`. Committed `f620e6c`.

### 4. The audit cleanup — `bun update` + resolutions
Cleared the remaining 8 highs via direct pin bumps (hono `^4.12.30`, vite, @fedify/fedify `^2.1.15`,
nodemailer `^9.0.3` — the one major/breaking) + root `resolutions` overrides for transitive copies
(undici, ws, fast-xml-builder). **Audit: 20 → 0 high.** The `resolutions.vite: "^8.1.5"` I added
was a mistake (forced vite 8 onto a vite-7 app) — reverted to `^7.3.5` after it surfaced as the
e2e failure candidate (though it turned out *not* to be the e2e cause — see lesson 2). Committed
`04593ce`, `11dc43f`.

### 5. The e2e determinism file — three attempts, finally correct
The `determinism.test.ts` fix took three tries:
1. Added `vitest` as e2e devDep → cleared typecheck, but **crashed Playwright at runtime** (vitest's
   `describe`/`it` need a vitest runner; Playwright tried to load the file).
2. Removed the devDep → stopped the crash, but **reintroduced TS2307 on CI's clean install** (my
   local typecheck passed falsely — stale `apps/e2e/node_modules/vitest` masked it).
3. **Final:** keep `vitest` as devDep (so tsc resolves) AND `testIgnore` in playwright.config (so
   Playwright skips it). Both constraints must hold. Lesson: for dep-resolution changes, the only
   faithful repro is `rm -rf node_modules && bun install --frozen-lockfile`, not a warm cache.
Committed `21358fc`, `c5a0af4`.

### 6. The e2e SSR "fetch failed" — UNRESOLVED (pre-existing)
When e2e finally ran (after upstream jobs cleared), every test failed "element not found" because
the page serves a vite error overlay (`"message":"fetch failed"`). **This is pre-existing** — every
`platform-test-and-build` run in visible history (80–109) is `failure`; e2e was always skipped
before. I made **three wrong hypotheses** from changelog research (vite 8 force, then
`API_INTERNAL_URL` missing, then better-auth `requirePKCE`) — none verified, none correct. The
error is `[vite] Internal server error: fetch failed` (a vite SSR internal error, *not* the app's
API fetch). Couldn't reproduce fully (no Postgres in sandbox). **Deferred** — needs the full e2e
log's vite SSR stack trace, not more guessing.

### 7. The deploy health-check false positive — the real demo blocker
`platform-deploy-demo` run 544 failed, but the `journalctl -u snc-api` log proved the **API is
healthy** (Server started, pg-boss, workers, no errors; `demo.s-nc.org/health` → 200). The
deploy step does `sleep 3 && curl` but the API takes ~5s to boot → the check fires before the
port listens → false-positive failure (and prod's version triggers a spurious rollback). **Fix
drafted:** retry loop (up to 30s) for both `platform-deploy-demo.yml` and `platform-deploy-prod.yml`.
Not yet committed (parent workflow, read-only to agent sandbox) — handed to operator.

### 8. The 58k-file scratchpad mess (my mess)
My `BUN_TMPDIR=.work/scratchpad/buntmp` workaround accumulated 58k cached files across the
dep-bump iterations, and `.work/scratchpad/` wasn't gitignored (only `.memory/scratchpad/` was).
Cleaned up + gitignored `.work/scratchpad/` and `.CILogs/`. Committed `739de4e`.

### 9. Release verification + the email-egress question
Demo deploy live. Walked through prod-verification checklist (auth/session, email, CORS, streaming,
join-route SEO). Confirmed login/logout/signup work; OTP flow identified (join-page capture +
`/api/auth/email-otp`).
On "switch demo to Mailpit": discovered demo's SMTP points at **Proton** — which is the
**intentional interim state**. `feature-email-migadu-cutover` (`implementing`) migrates org
mailboxes to Migadu but explicitly **holds Proton alive until
`feature-email-transactional-sender-repick` (`drafting`) moves the platform's transactional relay
off Proton**. So egress stays on Proton by design; demo-on-Proton actually exercises nodemailer 9's
TLS strictness (the one breaking change worth verifying), better than Mailpit would.

## What's outstanding (handoff)

1. **Deploy health-check fix** (parent workflow) — retry loop drafted in conversation, not landed.
   Operator to apply to both `platform-deploy-{demo,prod}.yml`. Unblocks clean deploys.
2. **e2e SSR "fetch failed"** (pre-existing) — needs the full e2e log's vite SSR stack trace to
   diagnose. Stop guessing from changelogs; wait for the error text. May relate to the
   `devProxy` / Nitro SSR env propagation, but unverified.
3. **Forgejo upgrade** for Actions logs/jobs/artifacts REST API (PR #12666) — unlocks full
   autonomous log-fetch; currently operator must drop logs. `user-station`.
4. **`feature-email-transactional-sender-repick`** (`drafting`) — the feature that moves platform
   egress off Proton. Until it lands, Proton stays paid and DNS stays in the interim merged state
   (SPF softfail with both, Proton DKIM kept).
5. **Demo submodule pointer** — platform has 7 commits (`f620e6c`…`739de4e`); parent needs the
   pointer bumped + push for any re-dispatch. (The deploy that's live is at platform `911cac7`.)
6. **Three stories in `platform/.work/`** marked `done` but the e2e-determinism one's body has the
   corrected resolution trail; the other two are accurate as committed.

## Lessons (honest self-assessment)

1. **Stop guessing from changelogs before seeing the error text.** Three wrong e2e hypotheses +
   the better-auth `requirePKCE` chase were all research-driven speculation presented as likely.
   The service log (`journalctl`) cracked the deploy issue in one shot. When I don't have the
   error, say so and ask for it.
2. **Warm caches lie about dependency resolution.** The vitest flip-flop and the vite-8 force
   both passed locally on stale `node_modules` and failed in CI. For dep changes, always repro
   with `rm -rf node_modules && bun install --frozen-lockfile`.
3. **Resolutions that cross a major version are aggressive.** Forcing vite 8 onto a vite-7 app
   was wrong even though it "cleared the audit." Check the consuming workspace's declared range
   before overriding.
4. **The Claude↔pi config conflation** cost real time. The platform AGENTS.md documented a
   Claude-Code-specific carve-out as universal. Any non-Claude agent walking in would hit the
   same trap. Doc-scoping matters.
5. **`BUN_TMPDIR` inside the repo** was a workaround that compounded into a 58k-file mess.
   Point temp dirs outside the working tree, or use the session temp pi-sandbox provides.
