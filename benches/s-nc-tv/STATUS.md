# S-NC.tv — Status

**State:** active
**Phase:** Phase 1: Infrastructure
**Updated:** 2026-03-17
**Tags:** platform, streaming, s-nc-tv

## Current Focus

Phase 1 is blocked on infrastructure provisioning (user task): Owncast and Restreamer LXC containers need to be deployed on Proxmox before platform code can be wired up. Platform-side work (StreamStatusSchema, Owncast client, status endpoint) can be started in parallel.

## Next Steps

- [ ] *(user)* Deploy Owncast LXC container (RTMP 1935 + HTTP 8080) behind Caddy at `stream.s-nc.org`
- [ ] *(user)* Deploy Restreamer LXC container (RTMP 1936 + HTTP 8181) behind Caddy at `relay.s-nc.org`
- [ ] *(user)* Run OBS test stream through full pipeline
- [ ] Add `StreamStatusSchema` to `@snc/shared`
- [ ] Implement `services/owncast.ts` Owncast API client
- [ ] Add `GET /api/streaming/status` feature-gated endpoint

## Blockers

- Infrastructure not yet provisioned (Owncast + Restreamer LXC containers on Proxmox) — user task

## Recent Progress

- 2026-03-17: Bench migrated from projects/s-nc.tv/ to benches/s-nc-tv/; STATUS.md added; content merged from root s-nc-tv.md (platform bench is canonical)
- Research complete: Owncast + Restreamer architecture decided (see `docs/research/streaming-infrastructure.md`)
- Platform MVP solid: 1,298 tests, 12 phases shipped — streaming feature can begin
