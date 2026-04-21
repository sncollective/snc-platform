---
tags: [streaming, deploy]
release_binding: null
created: 2026-04-21
---

# Live Nav Link to s-nc.tv Domain

The "Live" nav link should point to s-nc.tv directly rather than the current `/live` path on the main platform domain. Requires setting up s-nc.tv as the dedicated streaming domain with appropriate Caddy routing and DNS, then updating the nav link target. Deploy work (DNS + Caddy config) and platform code change are both needed.
