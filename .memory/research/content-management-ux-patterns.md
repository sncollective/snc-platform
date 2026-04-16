# Content Management UX Patterns

Research into how creator platforms and CMS tools handle content management, editing, and publishing. Conducted March 2026 to inform the S/NC content management redesign.

## Platforms Analyzed

| Platform | Content types | Creator model |
|----------|--------------|---------------|
| YouTube Studio | Video, Shorts, Live, Podcasts, Community posts | Single-channel, high volume |
| Substack | Text, Video, Audio, Notes, Chat, Live | Single-author newsletter |
| Ghost CMS | Posts, Pages (with block-based media) | Multi-author publication |
| Spotify for Creators | Podcast episodes (audio + video) | Per-show management |
| Patreon | Mixed-media posts (text + inline media) | Tier-gated creator posts |

## List View Patterns

### Data Table (YouTube Studio)

YouTube's Content tab is a full data table with sortable columns: thumbnail, title, visibility, restrictions, date, views, comments, likes ratio. Rows show hover actions (edit, analytics, comments, three-dot menu). Checkboxes enable bulk operations (batch visibility change, batch delete).

Content types are separated into **sub-tabs**: Videos, Shorts, Live, Community, Playlists, Podcasts. Each tab only appears if the creator has that content type. This allows type-specific columns (e.g. "Restrictions" for videos, "Replies" for community posts).

**Strengths:** Scannable at high volume. Sortable and filterable across many dimensions. Bulk actions via checkbox selection. Type-specific columns per tab.

**Weaknesses:** Sub-tabs multiply as content types grow. Empty tabs are hidden but the nav still gets wide. Overhead for low-volume creators.

### Vertical Card/Row List (Ghost, Substack, Patreon)

Ghost, Substack, and Patreon use simpler vertical lists where each row shows title, date, status, and a few key metrics. Actions are behind three-dot menus or right-click context menus.

**Ghost** adds inline analytics per published post (visitors, email opens, clicks, member signups) and supports **saved filter views** — custom combinations of status + author + tag + access level that become persistent sidebar entries with color-coded dots.

**Substack** shows views, open rate, and new subscribers per post directly in the list. Clean three-tab split: Published / Drafts / Scheduled.

**Patreon** keeps the list minimal (title, type, date, audience tier) and puts bulk operations behind a dedicated bulk-edit mode.

**Strengths:** Readable, low cognitive load. Works well for moderate volume. Ghost's saved views create "virtual folders" without rigid tabs.

**Weaknesses:** Columns can't vary by content type in a unified list. Less useful for high-volume scanning and sorting.

### Hybrid Approach: Adaptive Columns on Filter

Not observed in the platforms studied, but a natural synthesis: a unified list where filtering by content type adjusts which columns are visible. Filtering to "Audio" shows plays and duration; filtering to "Video" shows views and processing status; "All" shows the common set (title, type badge, date, status, visibility).

This avoids tab bloat while preserving type-specific information density. Similar to how project management tools (Linear, Notion) adapt views based on active filters.

## Edit Page Patterns

### Two-Column: Content + Settings Sidebar

**Ghost and Patreon** both use a two-column layout:
- **Left:** Full-width content area (title, body/media, block editor)
- **Right:** Collapsible settings sidebar (metadata, visibility, tags, publish controls, SEO)

Ghost's sidebar (opened via gear icon) includes: URL/slug, publish date, author(s), tags, access tier, excerpt, SEO fields, social preview, code injection, and post history/version restore.

Patreon's sidebar includes: audience/tier, collection assignment, "Drop" toggle, schedule, notification controls, comment settings, tags.

**Strengths:** Content stays full-width and immersive. Settings are accessible but not in the way. The sidebar can be collapsed when writing. Works for all content types — the left column dispatches to type-specific editors.

**Weaknesses:** Sidebar can get long with many settings. On narrow viewports, typically collapses to a bottom panel or full-screen overlay.

### Tabbed Sections (YouTube Studio)

YouTube uses **left-side vertical tabs** on the edit page: Details, Analytics, Editor, Subtitles, Monetization. Each tab is a full page of settings/tools.

**Strengths:** Clean separation of orthogonal concerns. Each tab is focused. Works well when a single content item has many dimensions (editing tools, subtitle management, monetization rules).

**Weaknesses:** More navigation overhead. Only justified when there are 4+ genuinely separate concerns per content item.

### Single Column with Bottom Panel (Substack)

Substack keeps the editor as a single full-width column. Publish settings are in a bottom panel revealed via a Settings button. Pre-publish settings include: audience, section, tags, comment permissions, SEO, social preview, schedule, email delivery options.

**Strengths:** Maximum writing space. Publish settings are a deliberate step, not ambient UI.

**Weaknesses:** Settings are hidden until you look for them. Less discoverable for first-time users.

## Publish Flow Patterns

| Platform | Pattern | Details |
|----------|---------|---------|
| YouTube | Inline on Details tab | Visibility dropdown (Public/Unlisted/Private/Scheduled) always visible in the right sidebar |
| Substack | Bottom panel | Settings button reveals audience, schedule, delivery options |
| Ghost | Multi-step modal | Choose distribution (web/email/both) → audience segment → preview (desktop/mobile/email) → schedule or publish. Most deliberate flow. |
| Patreon | Sidebar | Publish Now or Schedule in the always-visible right sidebar |
| Spotify | Inline | Publish/Schedule on the episode details page |

Ghost's approach is the most intentional — publishing is a distinct action with preview and distribution choices, not just a button click. This maps well to platforms where publish has real consequences (sending emails, notifying subscribers, gating content by tier).

## Mixed Content Type Handling

| Approach | Who | How it works |
|----------|-----|-------------|
| **Sub-tabs per type** | YouTube | Separate lists: Videos, Shorts, Live, Podcasts. No mixing. |
| **Type chosen at creation** | Substack, Spotify | Pick type upfront (Text, Video, Audio). Form adapts. Types don't mix in one post. |
| **Block-based inline mixing** | Ghost | Single editor, insert media blocks (image, video, audio, gallery, file). One post can contain multiple media types. |
| **Full inline mixing** | Patreon | Any post can contain text + images + video + audio + files + paywall breaks. Most flexible. |

### Collections vs Singles

YouTube handles collections as **Playlists** — a separate management concern from individual videos. Playlists have their own list view, ordering UI, and metadata. A video can belong to multiple playlists.

Spotify handles collections as **Shows** — the top-level organizational unit. Each show contains episodes. Multi-show management is supported.

Ghost and Substack don't have a native collection concept (beyond tags and categories for filtering).

Patreon has **Collections** — curated groupings that appear in subscriber-facing navigation, like playlists.

The common pattern: collections are a **separate management surface** from individual content items, with their own metadata, ordering, and publish state.

## Key Takeaways

1. **Audience/access gating is a first-class publish setting** everywhere — not buried in advanced options. For subscription-based platforms, who can see it is as important as what it says.

2. **Inline analytics in the list view** (Ghost, Substack) surface engagement without requiring click-through. Even 2-3 metrics per row (views, opens, new subs) help creators prioritize.

3. **Publish should be a deliberate step**, not just a button. Ghost's multi-step modal is the gold standard but even a confirmation dialog with visibility/audience review is better than a bare "Publish" button.

4. **Collections need their own management surface.** Playlists (YouTube), Shows (Spotify), and Collections (Patreon) are all separate from the individual content list. Trying to manage ordered collections inline in a flat content list doesn't scale.

5. **The two-column edit layout (content + settings sidebar) is the dominant pattern** for creator platforms. It keeps the content area immersive while making settings accessible. The tabbed approach (YouTube) only pays off with 4+ orthogonal concerns per item.

6. **Type-specific columns matter** for management lists. Plays vs reads vs word count are type-specific metrics. Either sub-tabs (YouTube) or adaptive columns on filter can solve this — sub-tabs are cleaner at scale but bloat at breadth.
