---
id: calendar-bulk-import
created: 2026-06-13
tags: []
---

# Calendar bulk-import (.ics / CSV)

The platform calendar has no bulk-import path — events must be entered one at a
time by hand. For any schedule with more than a handful of dated events that's
real friction.

Motivating context (S/NC Records, Animal Future campaign): a single release
cycle generates ~8 dated events (deliver, pitches, pre-save, release, follow-ups)
and the campaign runs 5–7 cycles plus the album/show — dozens of events the
operator currently has to punch in individually. The campaign's own tooling can
emit a standard **.ics** of its work-item dates; the gap is the platform
calendar accepting an import.

Proposed: support importing **.ics** (and/or CSV) into a calendar — file upload
or paste — mapping events to the platform's calendar model. iCalendar is the
interchange standard every external calendar already emits, so .ics is the
higher-leverage format.

This is the org/records-efficiency pattern: a platform feature that removes a
real-world S/NC operational chore. No campaign deadline binds it — the campaign
works around it with personal-calendar .ics imports until it lands.
