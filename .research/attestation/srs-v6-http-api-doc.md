---
source_handle: srs-v6-http-api-doc
source_class: tool-doc
fetched: 2026-06-24
source_url: https://ossrs.net/lts/en-us/docs/v6/doc/http-api
provenance: source-direct
tool: SRS v6 — HTTP API documentation
version: v6
topic: API endpoints for vhosts/streams/clients, RAW API, absence of DVR/HLS endpoints
---

# SRS v6 — HTTP API documentation

## Paraphrased summary

SRS exposes an HTTP management API (default port 1985, separate from the HLS HTTP server on
8080). The documented endpoints cover system info, vhosts, streams, and clients. The API
provides stream metadata but does not expose DVR file paths, HLS segment lists, timestamps, or
recording progress. The RAW API is restricted in SRS v6 to two endpoints: a config query and
a reload trigger. No DVR-specific RAW API endpoint is documented.

## Key passages

- **Vhosts:** `GET /api/v1/vhosts`, `GET /api/v1/vhosts/{id}` `[unverified-exact]`
- **Streams:** `GET /api/v1/streams?start=N&count=N`, `GET /api/v1/streams/{id}` `[unverified-exact]`
  - Per-stream object includes `stream.publish.cid` (publisher client ID). No timestamp,
    duration, or publish_time fields documented for the streams endpoint.
- **Clients:** `GET /api/v1/clients`, `GET /api/v1/clients/{id}`, `DELETE /api/v1/clients/{id}` `[unverified-exact]`
- **Summaries:** `GET /api/v1/summaries` — system resources (memory, CPU, network, load).
- **RAW API (SRS v6):** "Other RAW APIs are disabled by SRS 4.0."
  - `GET /api/v1/raw?rpc=raw` — query configuration
  - `GET /api/v1/raw?rpc=reload` — reload (equivalent to `killall -1 srs`) `[unverified-exact]`
  - **No DVR RAW API** documented.
- **No HLS segment or DVR path endpoints** in the documented API surface.

## Structural metadata

- The HTTP API (port 1985) is distinct from the HLS HTTP server (port 8080 in platform config).
- The absence of a DVR timestamp/progress API is load-bearing: there is no polling endpoint
  to determine "how many seconds of DVR recording exist" for a live stream.
- The `/api/v1/streams` endpoint does not expose the HLS `hls_fragment`, `hls_window`, or
  segment sequence numbers through the management API — those are config-time values.
