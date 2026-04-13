---
name: scan-accessibility
description: >
  Accessibility scan rules for the SNC platform. Checks WCAG 2.2 Level AA compliance
  for patterns detectable by static code analysis. Loaded by refactor-scan as a rule library.
---

# Accessibility Scan Rules

Scan the codebase for accessibility issues based on WCAG 2.2 Level AA criteria
that are detectable via static analysis. Each rule has a reference file with
rationale, examples, and exceptions.

## Rules

| Rule | WCAG | Summary | Reference |
|------|------|---------|-----------|
| semantic-interactive | 4.1.2 (A) | Use native interactive elements instead of div/span with click handlers | [details](references/semantic-interactive.md) |
| image-alt-text | 1.1.1 (A) | All images must have meaningful alt text; decorative images use alt="" | [details](references/image-alt-text.md) |
| form-labels | 1.3.1, 3.3.2 (A) | Every form input must have an associated label or ARIA label | [details](references/form-labels.md) |
| heading-hierarchy | 1.3.1 (A) | Heading levels must not skip; each page has one h1 | [details](references/heading-hierarchy.md) |
| media-alternatives | 1.2.1, 1.2.2 (A) | Audio/video must have captions or transcripts | [details](references/media-alternatives.md) |
| keyboard-interaction | 2.1.1 (A) | Custom widgets must handle keyboard events per WAI-ARIA APG | [details](references/keyboard-interaction.md) |
| route-announcements | 2.4.3 (A) | SPA route transitions must manage focus and announce page changes | [details](references/route-announcements.md) |

## Runtime-Only Concerns (Not Covered)

- **Color contrast** (1.4.3) — requires computed style resolution
- **Focus order** (2.4.3) — requires rendered DOM traversal
- **Screen reader behavior** — requires assistive technology testing

The `jsx-a11y` ESLint plugin catches some of these at lint time. This scan adds
value by checking patterns across files (heading hierarchy), flagging architectural
gaps (route announcements, media alternatives), and integrating with the refactor
board pipeline for tracked remediation.

See `../../../research/scan-rules-perf-a11y-2026-03.md` for WCAG criteria
mapping and authoritative sources.
