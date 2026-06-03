---
tags: [streaming]
release_binding: null
created: 2026-04-21
---

# chat-presence reliability — viewer count decrements lag or miss, separate tabs show conflicting counts temporarily, increment-on-channel-switch sometimes immediate sometimes delayed

Surfaced during /review of chat-presence 2026-04-21. Partial fixes landed defensively (stale-ref cleanup in chat-rooms.ts pruneStaleClients + roomId filter on SET_PRESENCE/USER_JOINED/USER_LEFT reducer actions) but did not resolve the observed lag. Remaining work: server-side WebSocket heartbeat / idle-timeout (Node ws or @hono/node-ws ping-pong) so dead connections are culled within seconds rather than relying on OS-level TCP teardown; potentially a client-side visibilitychange re-sync; diagnostic logging to pin down whether broadcasts are reaching all sockets. Acceptance: tab-close produces decrement within ~5s on all peer tabs; parallel tabs on the same channel never persistently disagree; channel-switch ordering is consistent. Target 0.3.1.
