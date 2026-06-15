---
source_handle: jsdom-readme-unimplemented
source_class: github-readme
fetched: 2026-06-15
source_url: https://github.com/jsdom/jsdom
provenance: source-direct
substrate_confidence: source-direct
tool: jsdom — README
version: fetched 2026-06-15 (jsdom ^26 line; README at github main)
topic: jsdom's unimplemented web-platform features; EventSource absence
---

# jsdom — README ("Unimplemented parts of the web platform")

## Paraphrased summary

The jsdom README maintains a section titled "Unimplemented parts of the web
platform" describing what is and is not in jsdom's scope. It states jsdom "has
many missing APIs" and names only two features as explicitly *outside* its scope:
Navigation and Layout. Everything else missing is "just features that we haven't
gotten to yet." `EventSource` / Server-Sent Events / `text/event-stream` do not
appear anywhere in the README — neither in a supported-features list nor as an
explicitly-scoped-out feature. The absence places `EventSource` in the broad
category of unimplemented APIs jsdom does not provide a global for.

## Key passages

- **Missing-APIs framing:** "Although we enjoy adding new features to jsdom and
  keeping it up to date with the latest web specs, it has many missing APIs.
  Please feel free to file an issue for anything missing, but we're a small and
  busy team, so a pull request might work even better."

- **Two scoped-out features:** "Beyond just features that we haven't gotten to
  yet, there are two major features that are currently outside the scope of jsdom.
  These are:
  - **Navigation**: the ability to change the global object, and all other
    objects, when clicking a link or assigning location.href or similar.
  - **Layout**: the ability to calculate where elements will be visually laid out
    as a result of CSS, which impacts methods like getBoundingClientRects() or
    properties like offsetTop."

- **Dummy behaviors:** "Currently jsdom has dummy behaviors for some aspects of
  these features, such as sending a 'not implemented' jsdomError to the virtual
  console for navigation, or returning zeros for many layout-related properties."

- **EventSource absence (negative finding):** A full-text search of the README
  for "EventSource", "Server-Sent", and "event-stream" returns no matches. jsdom
  provides no `EventSource` global.

## Structural metadata

`github-readme` (jsdom's own README on the `main` branch). Authoritative for what
jsdom does and does not provide as a web-platform global. The EventSource absence
is a *negative finding* from full-text search — jsdom does not document EventSource
as supported anywhere, and Navigation + Layout are the only features it names as
explicitly out-of-scope. Consequence for this facet: a test environment of jsdom
has no native `EventSource`, so a consumer-under-test must be supplied one (mock,
polyfill, or injected constructor).

## Substrate-test

Usable without platform context: documents jsdom's stated unimplemented-features
posture on the project's own terms. No project framing.
