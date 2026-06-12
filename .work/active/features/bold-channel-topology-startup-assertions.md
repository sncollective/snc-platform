---
id: bold-channel-topology-startup-assertions
kind: feature
stage: drafting
tags: [streaming, playout]
release_binding: null
depends_on: [bold-channel-topology-model-render]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: bold-channel-topology
---

# Startup assertions: infra files must agree with the topology

## Brief
Fail-fast validation at API startup (and optionally a standalone check script for CI)
that the hand-maintained infra surfaces agree with the typed topology: `srs.conf`
callback URL/port, docker-compose published ports (1935, 1936, 8888, 3900, API port),
and env-configured endpoints. The infra files stay hand-maintained — this feature
validates, it does not generate.

Untagged (not `[refactor]`): replacing silent drift with explicit startup errors is a
behavior change per the tag rubric — routes through feature-design. Scope discipline:
assert only what the topology already knows; do not grow a parser for arbitrary config
formats (a few targeted greps/regexes over `srs.conf` and compose files are acceptable
and should say so in the design).
