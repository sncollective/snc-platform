---
source_handle: mlt-avformat-producer
fetched: 2026-06-23
source_url: https://www.mltframework.org/plugins/ProducerAvformat/
provenance: source-direct
---

## Summary

Official MLT Framework documentation for the avformat producer plugin, which is the primary media-reading producer in MLT (and therefore in Kdenlive, Shotcut, and Flowblade). Documents the `resource` parameter and protocol support.

## Key Passages

### Resource Parameter

> "A file name specification or URL in the form: [{protocol}|{format}]:{resource}[?{format-parameter}[&{format-parameter}...]]"

The parameter uses a generic `{protocol}` placeholder. The single concrete example given is: `video4linux2:/dev/video1?width=320&height=240`

HTTP/HTTPS are not explicitly enumerated in this parameter description, but the parameter form supports arbitrary protocols.

### Protocol Whitelist/Blacklist

The producer exposes `protocol_whitelist` and `protocol_blacklist` parameters:

- `protocol_whitelist`: "List of protocols that are allowed to be used"
- `protocol_blacklist`: "List of protocols that are not allowed to be used"

These parameters govern which FFmpeg protocols are permitted, confirming the producer can handle multiple network protocols beyond local filesystem access.

### RTSP Transport

The `rtsp_transport` parameter accepts values including `http` and `https`, confirming HTTP-layer transport is supported within the FFmpeg protocol layer.

## From the MLT FAQ (mltframework.org/faq/)

> "MLT now supports libavformat's protocols to read network streams such as multicast MPEG2-TS/UDP, RTP, RTMP (librtmp recommended), RTSP (your mileage may vary), MMS, and HTTP Live Streaming."

> "However, you can not seek on it, so things such as in point and speed changes are ignored."

The FAQ also confirms MLT is designed for server-side headless use: "MLT is often used for SDI output, encoding, streaming, and rendering complex multitrack compositions."

## Structural Metadata

- **Producer**: avformat (FFmpeg-backed, the primary media producer in all MLT-based editors)
- **HTTP/HLS support**: Confirmed via libavformat protocol layer; seeking is not supported on streams
- **Headless operation**: Confirmed as a primary MLT use case
- **Note on seek**: HTTP streaming media cannot be seeked; in-point and speed changes are ignored
