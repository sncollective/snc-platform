---
source_handle: clapshot-metaplugins
fetched: 2026-06-23
source_url: https://raw.githubusercontent.com/elonen/clapshot/master/organizer/basic_folders/METAPLUGINS.md
provenance: source-direct
---

## Summary

Documentation for Clapshot's metaplugin system — the extension mechanism for the `basic_folders` organizer that allows Python customization without writing a full gRPC Organizer plugin.

## What Metaplugins Can Do

- Add custom popup menu actions to folders and media files
- Modify folder listings before display
- Custom command handling from the client
- Permission check overrides
- Lifecycle event reactions
- Inject custom data via `augment_listing_data` hook — passes computed values or configuration into the UI JavaScript context

## What Metaplugins Cannot Do Natively

- Add approval state buttons to the core UI
- Add structured status fields to the media data model
- Add custom metadata fields per video in a first-class way
- Add new form fields or structured UI components

## Data Model Extension

Indirect only: custom data flows through JavaScript action handlers, not through structured data model extensions. Any approval state would need to be implemented through an external system and referenced via injected data, or via a full custom Organizer (gRPC).

## Implication for Approval Workflow

An approval workflow in Clapshot is achievable but requires either:
1. A full custom Organizer plugin (gRPC, any language), or
2. External state storage + metaplugin injection for lightweight popup-triggered state changes

This is not available out-of-the-box. The Organizer API is noted as "new, still evolving."
