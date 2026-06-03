---
tags: [research, integration]
release_binding: null
created: 2026-05-07
---

# Events integration — pull show data from Bandsintown as source of truth

Bands manage shows in multiple places (personal calendar, Bandsintown, Spotify). Goal: reduce duplicate entry by treating Bandsintown as the source of truth and pulling from it into the SNC platform.

## Architecture decision (2026-05-07 conversation)

- BIT is source of truth (not SNC platform) — bands enter shows in Bandsintown for Artists.
- BIT auto-pushes to Spotify (within ~24h once artist connects accounts) — no work for us.
- SNC platform pulls from BIT public API (read-only, `app_id` auth, no partnership needed) and displays shows.
- Eventbrite push from SNC is parked as nice-to-have.
- Personal calendar already covered elsewhere; note that BIT publishes per-artist iCal feeds, so platform iCal only matters if aggregating across artists or adding non-show events.

## Why not platform-as-source-of-truth

- No direct push API to Spotify exists (Spotify only ingests via partner ticketing platforms).
- BIT public API is read-only; write access requires their partnership program.
- Spotify ended its Songkick partnership; Bandsintown is now the indie path to Spotify.

## Revisit if

- Bandsintown partnership becomes accessible (cheaper/faster than expected).
- Platform needs to own canonical show data for governance/cooperative-membership reasons.
