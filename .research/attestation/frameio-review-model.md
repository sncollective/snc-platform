---
source_handle: frameio-review-model
fetched: 2026-06-23
source_url: https://help.frame.io/en/articles/14543173-transitioning-from-workfront-proof-to-the-frame-io-viewer
provenance: source-direct
---

## Summary

Frame.io's review model as documented in its own support article comparing the Frame.io viewer to Workfront Proof. This is Frame.io's own product documentation (help.frame.io) describing the approval state model.

## Approval States

Approvers select from three options:
- **Approved** — asset does not need changes and is ready for use
- **Needs Work** — asset needs changes and is not ready for use; requires resubmission as a new version for another approval round
- **No response** — approver has not yet made a decision

This is a simplification versus Workfront Proof's three-tier (Approved / Changes Required / Rejected). An additional state cited in Adobe Workfront integration docs is "Approved with changes" — asset is mostly complete but needs minor changes before use; does not require a new version/re-approval cycle.

## Comment and Annotation Capabilities

From Frame.io's own documentation: "Comments, annotations and text markup tools, including pinned comments and frame-accurate timestamp comments for video." Also: emoji reactions; reply-to-comment while selected.

**Frame-accurate timestamped comments** are a core Frame.io capability — comments are anchored to specific video frames/timecodes.

## Version Comparison

"Compare versions, including auto compare pixel difference and overlay slider" — pixel difference and overlay tools work for like-to-like file types and sizes. Side-by-side asset review supported.

## Reviewer vs. Approver Distinction

Two roles:
- **Reviewer**: Can add comments and markup assets; can mark review complete but this is not required to move the asset forward
- **Approver**: Must make a decision (Approved / Needs Work) to move the approval process forward; asset does not reach "approved" status until all assigned approvers choose "approved"

## Approval Routing

Multi-stage approvals supported, including the same approver appearing in multiple stages. Parallel stages noted as "coming soon" (as of documentation date).

## Notification

When an approver makes a decision, the document owner is notified via email.

## Notes on Frame.io V4 API

Frame.io V4 API "is not backward compatible" and is available for Enterprise and select testing partners. Full API reference at developer.adobe.com/frameio/api/current/.
