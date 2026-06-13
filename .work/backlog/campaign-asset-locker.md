---
id: campaign-asset-locker
created: 2026-06-13
tags: []
---

# Campaign asset locker + release T-anchor reminders

S3-backed (Garage) per-cycle asset storage for label campaigns, plus
release-deadline reminders on the platform calendar.

Motivating context (S/NC Records, Animal Future album campaign): each single
cycle produces a package of assets — masters, artwork, shoot footage, video
exports — currently filed on Seafile under a per-cycle naming convention. The
campaign's distribution push runs through DistroKid, which has **no public
API** (Help Center has zero developer/API articles; the only community
tooling is reverse-engineered from the iOS app and read-only), so the
upload-to-distributor leg stays a manual dashboard act permanently. What the
platform *can* absorb is the other half:

- **Asset storage**: per-campaign / per-cycle asset organization on the
  existing Garage S3 infrastructure — upload, browse, and hand a cycle's
  package to whoever runs the distributor upload.
- **T-anchor reminders**: label release cycles run on dates counted back
  from release day (deliver at T-4wk, editorial pitch at T-2wk, etc.). The
  platform calendar is already the human-facing schedule surface for the
  production org; reminder support against these anchors would replace
  manual date-tracking.

Posture note from the operator: org- and records-side programs parking
platform work like this is the intended pattern — the platform queue absorbs
efficiency features that make S/NC's real-life operational tasks more
manageable. Asset naming/structure conventions on the campaign side are
storage-agnostic by design, so a later migration from Seafile onto this
feature carries over.
