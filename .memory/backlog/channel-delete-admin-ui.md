---
tags: [streaming, admin-console]
release_binding: null
created: 2026-04-18
---

# Admin UI — channel delete button

The `dynamic-liquidsoap-config` feature shipped the `DELETE /channels/:channelId` backend (soft deactivation: `isActive: false`) with config regeneration + health polling, but the admin UI only surfaces the create flow. No delete button or deactivate action is wired up in `platform/apps/web/src/routes/admin/playout.tsx`.

Follow-on to Unit 6 of that feature (which covered the create toast + pulsing amber status indicator). Delete should reuse the same restarting/ready toast cycle since it triggers the same config regeneration path on the backend. Likely needs: a delete action on each channel row, a confirm dialog ("Deactivate channel — content stops broadcasting on this stream key"), and the same engine-restart polling UX.

Surfaced at review of `dynamic-liquidsoap-config` (2026-04-18). Non-blocking for that feature; the create/restart path is functional and the backend endpoint is in place.
