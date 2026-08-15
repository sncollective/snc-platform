---
name: mockup-review
description: >
  Serve `.mockups/` over the LAN for preview, and run vision-capable validation +
  adversarial design review against rendered mockups. The orchestrator model is
  NOT multimodal — it cannot see rendered HTML/PNG — so every mockup MUST be
  screenshot + visually checked by a vision-capable subagent before it's called
  done. Use whenever mockups are generated or iterated (the ux-ui-design
  screens/flows skills, or any `.mockups/**` work) and before reporting a mockup
  complete. Triggers on "serve the mockups", "validate the mockups", "review the
  mockups", after any mockup generation/iteration pass, and before declaring a
  mockup verified/done.
---

# Mockup review — serve · validate · adversarially review

**Permanent constraint:** the orchestrator model is **not multimodal** — it
cannot see rendered HTML/PNG. Any visual assessment of mockups (`.mockups/**`)
MUST go through a **vision-capable subagent** (`openai-codex/gpt-5.6-sol`, which
is multimodal). Never report a mockup "verified" or "done" without a vision
subagent having screenshot it + looked. Pair every visual check with a
code-level `grep` on exact strings (emails, domains, URLs) — the visual pass
reads rendered text but misses subtle character differences (e.g. `snc.org` vs
`s-nc.org`, which shipped wrong because only the code-check caught it).

This skill encodes three capabilities: **(1) serve** mockups over the LAN for
the operator to view, **(2) validate** them for render correctness, and
**(3) adversarially review** them for design quality.

---

## 1. Serve the mockups over the LAN (preview)

```bash
cd <repo root>
nohup python3 -m http.server <PORT> \
  --directory <ABSOLUTE path to .mockups> --bind 0.0.0.0 \
  > /tmp/mockup-server.log 2>&1 &
SVPID=$!
sleep 1.5
# MANDATORY: confirm MY pid owns the port (not just that the port is listening)
ps -o pid,args -p "$SVPID" && (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep ":<PORT>"
```

Give the operator: `http://<LAN-IP>:<PORT>/screens/<feature>/index.html`.

**Hard-won gotchas — all of these have bitten us:**
- **Absolute `--directory` path.** Relative can resolve to the wrong dir.
- **Verify the port is owned by YOUR pid.** Checking "is the port listening?" is
  a false positive if another process already holds it. On this machine **port
  8080 is taken by the token-commune project's mockup server — use 8090** (or
  pick a free port and confirm the pid is yours).
- Serve the `.mockups/` **root** so relative links like
  `../../design-system/tokens.css` resolve.
- Find the LAN IP with `hostname -I` or `ip -4 addr` (the `ens`/ethernet
  address; ignore docker bridges; `tailscale0` is the tailnet address).
- It's a detached server — tell the operator the pid so they can `kill <pid>`
  when done. Restartable any time with the same command.

---

## 2. Mockup validator — render correctness (run after EVERY generation/iteration)

A vision-capable subagent that **screenshots each mockup, reads the PNGs, and
verifies a checklist.** Dispatch on `openai-codex/gpt-5.6-sol`.

Screenshot recipe — **Playwright** (the repo's e2e install; one screenshot mechanism
repo-wide — see the research record at the bottom of this skill):
```bash
# from apps/e2e — captures recursively under a mockup root, both widths if asked
node scripts/capture-files.mjs --root ../../.mockups --grep <filter> \
  --out /tmp/mockup-shots [--widths 1280,390] [--theme dark]
```
Then the subagent `read`s each PNG and confirms.

**Image-size budget (hard-won):** very tall fullPage captures (>~1MB / >2500px) can exceed
the vision subagent's read budget and fail as "file does not exist". Downscale before
review: `ffmpeg -y -i <tall>.png -vf scale=560:-1 <tall>-small.png`. Verified working
2026-08-15 (1.7MB/3215px failed → 587KB downscale passed).

**Checklist (adapt per mockup):**
- Page width = viewport width — **no horizontal overflow, no images off the left/right edges.**
- Content centered; images constrained to their containers (`max-width:100%`).
- **No duplicated content** (e.g. a track listed twice).
- Interactive bits actually work (bio toggles, tabs, carousels).
- **Responsive** — screenshot a narrow viewport (e.g. 390px) too.
- Headers/wordmarks align to the content column (not stretched viewport-wide).
- No literal typos in rendered text.

**Hard rule:** the validator must NOT report "verified/done" unless it has
visually confirmed every applicable check. If its model can't read images, it
says so explicitly + falls back to conservative CSS safeguards
(`img{max-width:100%;height:auto}`, `minmax(0,1fr)` grids, `min-width:0` on
children, `html,body{overflow-x:hidden}`) and flags "no visual verify." (The
centering/overflow bug shipped because a subagent claimed "verified rendering"
without actually checking — this skill exists to prevent that.)

---

## 3. Mockup adversarial reviewer — design critique (run on locked/candidate mockups)

A vision-capable subagent that **red-teams the DESIGN** — distinct from the
validator. The validator asks "does it render correctly?"; the reviewer asks
"**is this good design, and what would a designer flag?**" Dispatch on
`openai-codex/gpt-5.6-sol`, **xhigh** thinking for design critique.

**Lens:**
- **Hierarchy** — is the hero actually hero? is the most important thing prominent?
- **Spacing/rhythm/alignment** — grid consistency, optical alignment, white space, no awkward gaps/dead zones.
- **Typography** — scale, contrast, line-length, pairing.
- **Color/contrast** — token discipline, WCAG contrast, accent not overused.
- **Composition/balance** — asymmetry intentional, nothing floating/stranded.
- **Responsive behavior** across widths.
- **Design-system consistency** with `.mockups/design-system/tokens.css`.
- **Accessibility** — focus, alt text, semantic structure, motion-reduce.
- **"Would a designer ship this? What's the weakest element?"**

**Output:** specific, prioritized findings — **block / should-fix / nit** — each
with `file:line` and a concrete direction, not vague "looks nice." Adversarial:
surface the weaknesses; don't rubber-stamp.

---

## 4. Orchestrator discipline

- **Never claim visual verification without a vision subagent** having looked.
  "The generator said it verified" is insufficient — mandate the validator on
  every pass.
- **Pair every visual check with a code `grep`** on exact strings (emails,
  domains, URLs) — the visual pass misses subtle character differences; the
  code-check catches what vision slips.
- These two roles (validator = correctness, adversarial reviewer = design
  quality) close the gap the non-multimodal orchestrator cannot see. Use both
  before any mockup is reported done to the operator.

---

## Mechanism & research record (2026-08-15)

**Why Playwright:** the repo's `@snc/e2e` package already installs Playwright + chromium
(`scripts/dev/install-e2e-browsers.sh`); using it means one screenshot mechanism, one
install, and dev/e2e/audit captures share a rendering engine. The previous recipe
(firefox-headless + fresh-profile-per-shot) predated the Playwright browsers being present
on this box.

**Ecosystem check (operator-prompted, 2026-08-15):**
- `@m64/pi-screenshot-tools` (npm, the one real pi screenshot package) captures the
  **physical desktop/terminal** (wayland/sway/hyprland/kitty/tmux) so pi can see what the
  *user* sees — a different job from rendering a URL/file to PNG, and it requires a GUI
  session this headless devcontainer lacks. Not applicable.
- pi-native: no tool renders HTML to images (`fetch_content` extracts text/readable
  markdown; `@image` syntax *reads* existing images). Not applicable.
- Re-evaluate if a pi-native page-render extension appears; until then Playwright via the
  repo install is the principled choice (no new deps, no drift from e2e rendering).
