---
source_handle: activitypub-spec
fetched: 2026-06-24
source_url: https://www.w3.org/TR/activitypub/
provenance: source-direct
---

# ActivityPub Specification (W3C)

## Paraphrased Summary

The W3C ActivityPub specification defines a server-to-server federation protocol and a client-to-server API for decentralized social systems. Relevant for how attribution and audience control work in federated contexts.

## Attribution (attributedTo)

When creating content, "the `actor` of the activity _SHOULD_ be copied onto the `object`'s `attributedTo` field." This ensures proper credit assignment for posted objects.

## Audience Controls (Public vs Followers)

- Activities addressed to `https://www.w3.org/ns/activitystreams#Public` URI "shall be accessible to all users, without authentication"
- Activities can address a `followers` collection for restricted distribution

## Moderation/Removal Activities

- **Delete:** "The Delete activity is used to delete an already existing object."
- **Block:** "The Block activity is used to indicate that the posting actor does not want another actor to be able to interact with objects posted by the actor."
- **Flag:** Not addressed in ActivityPub itself — defined in ActivityStreams Vocabulary (see `activitystreams-vocab`)

## Content Types

The specification does not define video as a distinct content type — it references ActivityStreams vocabulary for object types and notes: "It's likely that ActivityStreams already includes all the vocabulary you need, but even if it doesn't, ActivityStreams can be extended via JSON-LD."

## Key Passage

> "Activities addressed to [the Public URI] shall be accessible to all users, without authentication."
