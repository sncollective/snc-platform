---
tags: [federation, identity]
release_binding: null
created: 2026-04-20
---

# Federated Identity

Protocol-specific identity projection layer — WebFinger, DID documents, AT Protocol OAuth, Mastodon OAuth, IndieAuth, NIP-05 verification, Polycentric key linking, and portable identity export — all anchored to the canonical S/NC account.

**Bullets to split / scope out when this is promoted:**

- WebFinger via Fedify — `@creator@s-nc.org` discovery for ActivityPub
- DID documents — `/.well-known/did.json` for AT Protocol; `did:plc` for PDS-hosted, `did:web` alternative
- AT Protocol OAuth — OAuth 2.1 with DPoP + PKCE + PAR for "Sign in with Bluesky"
- Mastodon OAuth via Auth.js — fediverse login from any Mastodon/AP instance
- IndieAuth — domain-based federated login (OAuth 2.0 with `rel="authorization_endpoint"` discovery)
- NIP-05 verification for Nostr — `creator@s-nc.org` resolves to Nostr pubkey via `/.well-known/nostr.json`
- Polycentric public key linking via FUTO ID claims
- Portable identity export — users can export identity data and migrate
