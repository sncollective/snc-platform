# Video-editor integration — research campaign + position handoff (2026-06-23)

Ran a full-rigor research engagement on **which video editor(s) the platform integrates with for
video production** (near-term driver: album-release video), and landed the result as a **position**
rather than a backlog of build work. Also split the original over-scoped item into two engagements
and queued the second.

## What happened

- **Scoping correction first.** The original single "choose a video editor" item conflated three
  different products. Split into **B+D** (`video-production-media-hub` — editor integration +
  conditional review bridge, album-driven) and **A** (`stream-clipping-twitch-parity` — Twitch-parity
  clipping, queued, not yet run); **de-scoped C** (in-browser NLE).
- **Ran `video-production-media-hub` through `agentic-research:research-orchestrator`** at
  `scope_authority: mixed` / `verification_rigor: full`. 4-facet fan-out (oss-editor-integration,
  resolve-and-proprietary, infra-and-render-backends, review-collab-bridge), ~42 source-direct
  attestations. All gates passed after two revision rounds (adversarial-read caught 2 §1 citation
  defects; the isolated evaluate gate caught a missed Q4 "album-timeline anchoring" + 3 uncited
  clauses).
- **Discharged both "blocking" acquisitions post-close** from mirrors — and they *overturned*
  findings: the Resolve scripting README (X-Raym gist + a corroborating mirror) showed **headless
  render via `-nogui` works** (the brief had concluded "no headless render"); the Resolve 18.6
  Reference Manual (steakunderwater mirror) showed **native OTIO** import/export + AAF/EDL/XML.
- **Handoff landed as a position, not backlog items.** Promoted
  `.research/analysis/positions/video-editor-integration.md`; kept one tracked story
  (`verify-garage-presigned-range-support`); retracted the 5 premature build items; deleted the
  superseded pre-ARD `nle-platform-integration.md`.

## Settled position

Kdenlive + Shotcut primary (shared MLT → one `melt` render); Resolve as access + interchange
consumer (native OTIO, headless `-nogui`); OpenShot secondary; Olive/Flowblade excluded. Platform
as media hub, not an NLE. Full stance + revisit conditions in the position.

## Open (deliberately not settled)

The **media-access architecture**. The operator surfaced that a direct storage mount bypasses the
**Caddy** reverse-proxy/auth perimeter ("punching a hole") — so the campaign's "mounted storage is
the robust path" was refined: robust on *seeking*, but with a network-perimeter cost. Preference is
to **stay behind Caddy**, which **skews back toward deeper platform integration** (platform owns
media access, proxies, project-file gen, server-side render) and reinforces the MLT-editor pick
(Kdenlive/Shotcut consume HTTP natively; Resolve can't). The pivotal input is the **Garage
Range-request check** (the kept story). For *maximal* Kdenlive capability with media server-side
behind Caddy, the candidate is a **server-side cloud workstation** (Kdenlive behind a browser
remote desktop — KasmVNC/Selkies/Guacamole + Proxmox GPU passthrough), currently unresearched.

## Lessons (durable)

- **Position vs. backlog is a real substrate fork.** An `inform-decision` engagement where the
  operator isn't committing to build wants a **position** (durable settled stance) — not a backlog
  of build work (transient, and premature under substrate-before-stance). Track only the one
  concrete next-action (the Range check). Build items wait for build intent.
- **Acquisitions flagged "blocking / login-gated" are often reachable via faithful mirrors** — and
  worth chasing when they gate a load-bearing claim (both Resolve gaps were, and both overturned
  the held finding).
- **Operator feedback is research substrate.** The Caddy/network-perimeter point was a genuine gap
  in the synthesis; folded back into the parent + position rather than left in chat.

## Next

- Run the **A engagement** (`stream-clipping-twitch-parity`) — more directly platform-relevant
  (buildable feature), so its handoff may cleanly warrant backlog items.
- The Garage Range check (`verify-garage-presigned-range-support`) gates the open architecture.
- Cloud-workstation approach is an unresearched follow-up if maximal server-side Kdenlive is pursued.
