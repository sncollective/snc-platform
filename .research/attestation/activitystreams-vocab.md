---
source_handle: activitystreams-vocab
fetched: 2026-06-24
source_url: https://www.w3.org/TR/activitystreams-vocabulary/
provenance: source-direct
---

# ActivityStreams 2.0 Vocabulary

## Paraphrased Summary

The W3C ActivityStreams 2.0 vocabulary specification defines object types and activity types used in federated social protocols. Relevant here for moderation (Flag activity) and video content types.

## Video Object Type

**URI:** `https://www.w3.org/ns/activitystreams#Video`

"Represents a video document of any kind." Extends the Document class, which extends Object. Inherits all Object properties including: name, url, duration, content, published, updated.

## Link Type

**URI:** `https://www.w3.org/ns/activitystreams#Link`

"An indirect, qualified reference to a resource identified by a URL." Links establish qualified relations to resources. Key properties: href, rel, mediaType, name, hreflang, height, width, preview.

## Note Object Type

**URI:** `https://www.w3.org/ns/activitystreams#Note`

"A short written work typically less than a single paragraph in length." Extends base Object type.

## Flag Activity Type

**URI:** `https://www.w3.org/ns/activitystreams#Flag`

Indicates "the actor is 'flagging' the object." Defined as "reporting content as being inappropriate for any number of reasons" — this is the vocabulary-level activity type for content reporting/moderation workflows in federated systems.

## Key Passage

> Flag: "The actor is 'flagging' the object. Flagging is defined in the sense common to many social platforms as reporting content as being inappropriate for any number of reasons."
