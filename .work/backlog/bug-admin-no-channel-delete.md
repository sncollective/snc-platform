---
id: bug-admin-no-channel-delete
kind: backlog
tags: [playout, admin-console]
created: 2026-06-12
---

# No channel deletion in admin playout UI

**Observed:** `/admin/playout` provides no affordance to delete a playout channel. Channels created via "+ New Channel" can only be removed by direct database access. Creating a test/error channel during audit ("Audit Test Channel") leaves permanent artifacts.

**Impact:** Admin cannot clean up channels, correct naming mistakes, or remove deprecated sources without database access. Heuristic: User control and freedom. Severity: 3.

**Direction:** Add a delete-channel action with an inline confirmation dialog warning that deletion will restart the playout engine. The API presumably already supports channel deletion (the existing `createChannel` lib function has a counterpart or the channel table is directly deletable). The engine restart consequence must be surfaced in the confirmation (same pattern as channel creation warning).
