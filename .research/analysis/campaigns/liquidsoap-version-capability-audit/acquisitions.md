---
title: Acquisition candidates — liquidsoap-version-capability-audit
campaign: liquidsoap-version-capability-audit
updated: 2026-06-16
---

# Acquisition candidates

Consolidated from the four specialists. All **enriching** (deepen a facet); **no blocking**
candidates — every load-bearing source was fetched (the tag-pinned LS tree, CHANGES.md, our code,
the SRS docs). Verification-independent offgas: these are gaps regardless of the gate outcomes.

| Source | Class | Web-availability | Completes (held facet/claim) |
|---|---|---|---|
| GitHub PR/issue pages for #5194, #5051, #5032, #5237 | primary-doc | yes (github.com) | upstream discussion/repro context behind each LS fix — `ls-version-delta`. Not blocking; source diffs already confirm the changes. |
| `raw.githubusercontent.com` byte-exact `trunk/conf/full.conf` + issue #3267 | primary-doc | intermittent (500'd this session) | upgrade SRS `vcodec` list + #3267 Won't-fix wording from `search-summary` → `source-direct` — `srs-ffmpeg-seam` |
| SRS source `trunk/src/` OR a dev-container scaling test | primary-doc / counsel | yes (source) / local | the SRS max-streams/vhosts cap for dynamic channels — `srs-ffmpeg-seam` |
| SRS subtitle/caption handling over RTMP→HLS/WebRTC (SRS upstream docs) | portal | yes | whether 2.5.0 subtitle output can ride our RTMP→SRS→player path — cross-component, `ls-2.5.0-capabilities` |
| Vidstack caption/text-track support (vidstack docs) | portal | yes | the delivery half of subtitle/caption items against our HLS/WebRTC output — player-side |

**Promotion target:** the standing `research-acquisition-queue` backlog item (operator-confirmed at
the handoff gate — never auto-written). None of these block the audit's conclusions; they sharpen
follow-on work.
