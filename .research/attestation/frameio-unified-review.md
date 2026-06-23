---
source_handle: frameio-unified-review
fetched: 2026-06-23
source_url: https://experienceleague.adobe.com/en/docs/workfront/using/review-and-approve-work/get-started-with-unified-approvals
provenance: source-direct
---

## Summary

Adobe Experience League documentation on Frame.io's unified review and approval system as integrated with Workfront. Describes the full approval state model and version cycle.

## Approval States (Three-State Decision)

- **Approve** — asset requires no changes and is ready for use
- **Approved with changes** — asset needs minor revisions but will NOT require re-approval after updates; the approver endorses the direction while flagging minor cleanup
- **Needs work** — asset requires changes; must be uploaded as a new version and go through another complete approval round

## Version Cycle

When an asset receives "Needs work," the revised asset must be uploaded as a new version and go through another round of approvals. This creates an explicit version-per-review-cycle model.

## Reviewer vs. Approver Roles

- **Reviewer**: Can comment and mark up assets; can mark review complete, but this is not required to advance the workflow
- **Approver**: Must make a binding decision (Approve / Approved with changes / Needs work) to advance the process

## Access Model

Users access the Frame.io viewer via Workfront email notifications or the approval widget in Workfront Home. Frame.io handles the annotation interface; Workfront handles workflow coordination.

## Minimum Approval Architecture (Implied)

1. Coordinator initiates approval, assigns reviewers/approvers
2. Reviewers/approvers notified (email)
3. Frame.io viewer for timecoded commenting and frame annotations
4. Approvers make decisions
5. Progress tracked via Workfront metrics

## Data Architecture Implications

The model separates the annotation surface (Frame.io viewer, timecoded comments, frame drawings) from the approval state tracking (Workfront). This separation suggests the two concerns can be decoupled architecturally: a comment system with timestamp anchors + a separate approval state field per asset version.
