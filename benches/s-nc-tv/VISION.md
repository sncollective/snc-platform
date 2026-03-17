# S-NC.tv

## Overview

A cooperative-owned live streaming channel where S/NC creators share one stage. Live streams are always public for maximum reach. Recordings become premium content behind the existing subscription paywall. Self-hosted on S/NC infrastructure (Owncast + Restreamer), simulcasting to commercial platforms without locking creators into any of them.

## Problem Statement

Commercial streaming platforms take 5-50% of creator revenue, enforce exclusivity clauses, and own the audience relationship. No platform gives creators access to subscriber emails. Music creators face DMCA strikes for playing their own collaborators' work. Discovery algorithms concentrate viewers on already-popular channels, leaving smaller creators invisible. Creators build audiences on platforms they don't control, subject to policy changes and revenue share cuts they have no voice in.

## Solution

A single cooperative-owned channel on self-hosted infrastructure, with three structural advantages:

1. **Shared channel** — creators take turns on one channel. Smaller creators inherit the full audience instead of starting from zero. Scheduling and handoff replace algorithmic discovery.
2. **Live public, VOD premium** — live streams maximize reach (anyone can watch). Recordings land behind the existing subscription paywall as premium content, giving subscribers a reason to pay and creators a revenue stream that outlasts the live moment.
3. **Simulcast by default** — Restreamer relays every stream to Twitch, YouTube, and wherever else creators want to be. S/NC never restricts where creators stream. The cooperative channel is home base, not a cage.

### Core Principles

- **Creator-owned infrastructure** — cooperative members own the platform. Revenue share is a democratic decision, not a corporate one.
- **Music licensing freedom** — S/NC Records artists stream with their own catalog and other S/NC music. Zero DMCA risk. No other platform can offer this.
- **No DRM** — server-side content gating via existing Stripe subscriptions. No client-side playback restrictions.
- **Fediverse-native** — Owncast's built-in ActivityPub federation sends go-live notifications to fediverse followers without platform lock-in.

## Usage

**For creators:**
- Configure OBS once (point at the Restreamer RTMP URL)
- Schedule time slots through the S/NC platform
- Go live — stream hits S-NC.tv, Twitch, YouTube, and any other configured destinations simultaneously
- After the stream, review the recording and publish as subscriber-only VOD content

**For viewers:**
- Watch live at S-NC.tv (always free, no account required)
- Get notified when streams start (email, fediverse)
- Subscribe for access to VOD recordings and the full content library

## Architecture

```
Creator (OBS) → Restreamer → Owncast → S-NC.tv (HLS player + chat)
                    ├──────→ Twitch
                    ├──────→ YouTube
                    └──────→ (other destinations)

Owncast webhooks → S/NC API → notifications, scheduling, VOD pipeline
Owncast ActivityPub → fediverse go-live notifications
Stream recordings → Garage S3 → subscriber-gated VOD content
```

Owncast handles streaming, chat, and ActivityPub federation. Restreamer handles multi-destination relay. The S/NC platform handles scheduling, creator identity, VOD publishing, and subscriber access — all through Owncast's REST API and webhooks. Both services run in LXC containers on existing Proxmox infrastructure behind Caddy.

## Success Criteria

- Creator streams from OBS through the full pipeline (Restreamer → Owncast → S-NC.tv + external destinations) without platform-specific setup beyond the initial RTMP URL
- Viewers watch live on S-NC.tv with no account required; chat is functional
- Subscribers notified on go-live (email + fediverse)
- Stream recordings automatically captured, stored in Garage S3, and available for creator review and VOD publishing
- Simulcast to at least Twitch and YouTube works reliably alongside the S-NC.tv stream
- Scheduling system handles creator handoffs on the shared channel without stream key conflicts
- VOD content is gated behind existing subscription paywall with no new payment infrastructure
