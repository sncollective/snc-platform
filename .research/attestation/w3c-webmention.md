---
source_handle: w3c-webmention
fetched: 2026-06-24
source_url: https://www.w3.org/TR/webmention/
provenance: source-direct
---

# W3C Webmention Specification

## Paraphrased Summary

Webmention is a W3C protocol for cross-site notifications: when one URL links to another, the sender can notify the receiver. Relevant as a potential clip attribution/notification mechanism.

## What It Does

"A Webmention is a notification that one URL links to another." Enables distributed social interactions across independent platforms without centralization.

## How It Works

1. Sender creates content linking to a target URL
2. Sender discovers receiver's endpoint (HTTP Link header or `<link>` element with `rel="webmention"`)
3. Sender POSTs `source` and `target` parameters to that endpoint
4. Receiver verifies the mention exists and processes accordingly

## Endpoint Discovery

Priority-ordered fallback:
1. HTTP `Link` header with `rel="webmention"`
2. HTML `<link>` element with matching rel value
3. HTML `<a>` element with matching rel value

"The endpoint MAY be a relative URL, in which case the sender MUST resolve it relative to the target URL."

## Verification Requirements

Receivers must:
- Confirm both URLs are valid and use supported schemes (HTTP/HTTPS)
- Verify the target URL accepts webmentions
- Fetch the source document and confirm it contains an actual link to the target
- Process asynchronously to prevent denial-of-service attacks

"The source document MUST have an exact match of the target URL provided in order for it to be considered a valid Webmention."

## Use Cases

- Blog replies (notify original post authors)
- Event RSVPs
- Likes/bookmarks
- Updates/deletions (notifying receivers when source content changes or is removed)

## Key Passage

> "A Webmention is a notification that one URL links to another" — enabling "interactions to happen across different websites, enabling a distributed social web."
