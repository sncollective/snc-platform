---
id: bug-admin-simulcast-window-confirm
kind: backlog
tags: [playout, admin-console]
created: 2026-06-12
---

# Simulcast destination delete uses window.confirm() native dialog

**Observed:** `SimulcastDestinationManager.handleDelete` calls `window.confirm("Delete this simulcast destination?")`. This browser-native confirm dialog: (1) freezes JS execution, (2) renders without the platform design tokens (appears as raw browser chrome), (3) cannot be dismissed by pressing Escape in the same interaction model as other platform patterns, (4) blocks background animations.

**File:line:** `apps/web/src/components/simulcast/simulcast-destination-manager.tsx:147`

**Affected surfaces:** Both admin `/admin/simulcast` (`variant="table"`) and creator simulcast management (`variant="list"`).

**Severity:** 2.

**Direction:** Replace with an inline confirmation pattern: on Delete click, show a "Confirm delete?" row below the destination with "Yes, delete" and "Cancel" buttons. Alternatively, add a small `<dialog>` or toast-based confirmation. This matches how other destructive actions on the platform should feel (designed not to surprise).
