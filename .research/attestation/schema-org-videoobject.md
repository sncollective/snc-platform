---
source_handle: schema-org-videoobject
fetched: 2026-06-24
source_url: https://schema.org/VideoObject
provenance: source-direct
---

# Schema.org VideoObject

## Paraphrased Summary

VideoObject is a Schema.org type for structured data markup of video content, inheriting from the hierarchy: Thing > CreativeWork > MediaObject > VideoObject. Used for JSON-LD or microdata to help search engines understand video content.

## Key Properties for Short Video Clips

**thumbnailUrl** — Type: URL — "A thumbnail image relevant to the Thing."

**contentUrl** — Type: URL — "Actual bytes of the media object, for example the image file or video file."

**embedUrl** — Type: URL — "A URL pointing to a player for a specific video. In general, this is the information in the `src` element of an `embed` tag."

**duration** — Type: Duration or QuantitativeValue — Time span in "ISO 8601 duration format" (e.g., PT1M33S for 1 minute 33 seconds).

**uploadDate** — Type: Date or DateTime — "Date (including time if available) when this media object was uploaded to this site."

**creator** — Type: Organization or Person — "The creator/author of this CreativeWork. This is the same as the Author property."

**description** — Type: Text or TextObject — "A description of the item."

**name** — Type: Text — "The name of the item."

## Structural Notes

- Inherits from MediaObject which itself inherits from CreativeWork, giving access to `author`, `dateCreated`, `dateModified`, `license`, `isBasedOn`, `copyrightHolder` and similar properties
- `embedUrl` vs `contentUrl` distinction: `embedUrl` points to a player (for embedding); `contentUrl` is the raw video file
- Both `creator` and `author` are available via CreativeWork inheritance for attribution
