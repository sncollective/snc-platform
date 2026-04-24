---
id: feature-streaming-account-connect
kind: feature
stage: done
tags: [streaming, identity]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Streaming Account Connect

> All units needs prod testing.

## Sub-units (all done)

- [x] Twitch OAuth connect + stream key auto-fill *(needs prod testing)*
- [x] YouTube OAuth connect + stream key auto-fill *(needs prod testing)*
- [x] Simulcast destination auto-create *(needs prod testing)*

## Overview

Allow creators to connect their Twitch and YouTube streaming accounts via OAuth, auto-pulling stream keys and RTMP URLs to populate simulcast destinations. Uses **separate** OAuth flows from social login — streaming connect requests platform-specific scopes (e.g., `channel:read:stream_key` for Twitch) that aren't needed for basic login.

This builds on the existing simulcast destination infrastructure (`simulcastDestinations` table, `simulcast.ts` service, streaming routes).

## Tech Reference Note

The Twitch and YouTube APIs are external services. Key endpoints:
- **Twitch**: `GET https://api.twitch.tv/helix/streams/key` (requires `channel:read:stream_key` scope)
- **YouTube**: `GET https://www.googleapis.com/youtube/v3/liveStreams` (requires `https://www.googleapis.com/auth/youtube.force-ssl` scope)

---

## Implementation Units

### Unit 1: Environment Configuration

**File**: `apps/api/src/config.ts`

Add streaming-specific OAuth credentials (separate from login credentials if desired, but can reuse the same client app):

```typescript
// Twitch streaming connect — reuses TWITCH_CLIENT_ID/SECRET from social login
// YouTube streaming connect
YOUTUBE_CLIENT_ID: z.string().optional(),
YOUTUBE_CLIENT_SECRET: z.string().optional(),
```

**Implementation Notes**:

- Twitch streaming connect reuses the same `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET` from social login config. The difference is in the OAuth scopes requested.
- YouTube streaming connect needs its own Google OAuth client credentials because the YouTube Data API requires a different OAuth consent screen and scopes than Google Sign-In. Use `YOUTUBE_CLIENT_ID`/`SECRET` (not `GOOGLE_CLIENT_ID`) to allow separate configuration.

**Acceptance Criteria**:

- [ ] YouTube env vars parsed when present
- [ ] API starts without YouTube env vars

---

### Unit 2: Streaming Connect Service

**File**: `apps/api/src/services/streaming-connect.ts`

Key functions:
- `startTwitchConnect(userId, creatorId)` — starts Twitch OAuth flow with `channel:read:stream_key user:read:email` scopes
- `handleTwitchCallback(code, state)` — exchanges code, fetches stream key, returns `StreamingCredentials`
- `startYouTubeConnect(userId, creatorId)` — starts YouTube OAuth flow with `youtube.force-ssl` scope
- `handleYouTubeCallback(code, state)` — exchanges code, fetches live stream ingestion info

In-memory state `Map` for CSRF (pre-1.0 single-instance). Auto-creates inactive simulcast destinations in route callbacks.

**Acceptance Criteria**:

- [ ] Twitch connect starts OAuth flow with `channel:read:stream_key` scope
- [ ] Twitch callback fetches and returns stream key + RTMP URL
- [ ] YouTube connect starts OAuth flow with `youtube.force-ssl` scope
- [ ] YouTube callback fetches and returns stream key + RTMP URL
- [ ] Both validate state parameter for CSRF protection
- [ ] Errors return appropriate error codes

---

### Unit 3: Streaming Connect Routes

**File**: `apps/api/src/routes/streaming-connect.routes.ts`

Mount at `/api/streaming/connect` in `app.ts`. Routes:
- `POST /twitch/start` — auth required, owner-only, returns authorization URL
- `GET /twitch/callback` — handles OAuth redirect, auto-creates inactive simulcast destination
- `POST /youtube/start` — auth required, owner-only, returns authorization URL
- `GET /youtube/callback` — handles OAuth redirect, auto-creates inactive simulcast destination

Permission check uses `manageMembers` (owner-only) since connecting a streaming account is a high-privilege action. Callbacks auto-create simulcast destinations with `isActive: false`. Success redirects include `?connected=twitch|youtube`.

**Acceptance Criteria**:

- [ ] Only creator owners can initiate connect flows
- [ ] Twitch callback creates inactive simulcast destination
- [ ] YouTube callback creates inactive simulcast destination
- [ ] Success redirects to streaming manage page
- [ ] Error redirects include error message

---

### Unit 4: Connect Buttons in Streaming Manage Page

**File**: `apps/web/src/routes/creators/$creatorId/manage/streaming.tsx`

Add connect buttons to the streaming management page. `ConnectButton` component initiates OAuth flow via `POST /api/streaming/connect/{platform}/start`. Handles `?connected=` and `?error=` query params to show feedback. After connection, the new inactive destination appears in the existing destinations list.

**Acceptance Criteria**:

- [ ] Connect buttons visible on streaming manage page
- [ ] Clicking initiates OAuth flow
- [ ] Success message shown after connection
- [ ] New inactive destination appears in list
- [ ] Error message shown on failure

---

## Implementation Order

1. **Unit 1** — Environment configuration
2. **Unit 2** — Streaming connect service (Twitch + YouTube OAuth + stream key fetch)
3. **Unit 3** — Routes (start + callback endpoints)
4. **Unit 4** — UI connect buttons + feedback

## Testing

### Unit Tests: `apps/api/tests/services/streaming-connect.test.ts`

- Mock `fetch` for Twitch/YouTube APIs
- Test Twitch flow: start → callback → stream key extraction
- Test YouTube flow: start → callback → live stream ingestion info
- Test state validation (expired, wrong platform, missing)
- Test error cases (token exchange failure, no stream key found)

### Unit Tests: `apps/api/tests/routes/streaming-connect.routes.test.ts`

- Test auth requirement on start endpoints
- Test owner-only permission check
- Test callback creates inactive simulcast destination
- Test redirect URLs on success/error

## Verification Checklist

```bash
bun run --filter @snc/api test:unit
bun run --filter @snc/web test
```
