# Creator Profiles & Management

A creator is an **entity**, not a role. Creator profiles represent bands, artists, labels, or other publishing identities on the platform. Users participate in creator entities as **team members** with one of three team roles (owner, editor, viewer). A single user can be a member of multiple creator teams, and a single creator entity can have multiple team members. The relationship is modeled as a many-to-many join through the `creator_members` table.

## How It Works

### Entity Model

The creator domain has two tables:

- **`creator_profiles`** -- the creator entity itself (display name, bio, avatar, banner, social links, handle).
- **`creator_members`** -- a join table linking users to creator profiles with a team role. The composite primary key is `(creator_id, user_id)`.

Both tables use `ON DELETE CASCADE` foreign keys: deleting a creator cascades to its members, and deleting a user cascades their memberships.

A creator profile is **not** a 1:1 extension of a user account. It is an independent entity that one or more users manage through the `creator_members` join.

### Creator Team Roles and Permissions

Team roles are separate from platform roles. Platform roles (`admin`, `stakeholder`) control platform-level access (see [auth.md](auth.md)). Creator team roles control what a user can do within a specific creator entity.

The three team roles and their permissions, defined in `CREATOR_ROLE_PERMISSIONS` (`packages/shared/src/creator.ts`):

| Permission | owner | editor | viewer |
|---|---|---|---|
| `editProfile` | yes | yes | no |
| `manageContent` | yes | yes | no |
| `manageScheduling` | yes | yes | no |
| `manageMembers` | yes | no | no |
| `viewPrivate` | yes | yes | yes |

Permission checks are enforced server-side by `requireCreatorPermission()` in `apps/api/src/services/creator-team.ts`. Platform admins bypass all creator permission checks -- if the user has the `admin` platform role, every permission returns `true` regardless of team membership.

### Who Can Create Creator Entities

Only users with the `stakeholder` or `admin` platform role can create new creator entities (`POST /api/creators` requires `requireRole("stakeholder", "admin")`). The creating user is automatically seeded as the `owner` of the new entity.

### Who Can Be Added as Team Members

The candidates endpoint (`GET /api/creators/:creatorId/members/candidates`) only returns users who hold the `stakeholder` or `admin` platform role and are not already members of the creator. This means registered users and patrons cannot be added to creator teams.

## Routes

All routes are mounted under `/api/creators`. The `creatorId` parameter accepts either a UUID or a handle -- the backend resolves both via `findCreatorProfile()` which queries on `OR(id = identifier, handle = identifier)`.

### Creator Profile Routes (`creator.routes.ts`)

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/` | optional | -- | List creators with cursor-based pagination. Authenticated users see `isSubscribed`. Stakeholders/admins see `canManage`, `subscriberCount`, `lastPublishedAt`. Subscribed creators sort first. |
| `POST` | `/` | required | `stakeholder` or `admin` platform role | Create a new creator entity. Seeds the caller as `owner`. |
| `GET` | `/:creatorId` | none | -- | Get a single creator profile by ID or handle. Includes `contentCount`. |
| `PATCH` | `/:creatorId` | required | `editProfile` | Update display name, bio, handle, or social links. |
| `POST` | `/:creatorId/avatar` | required | `editProfile` | Upload avatar image (multipart form, `file` field). |
| `POST` | `/:creatorId/banner` | required | `editProfile` | Upload banner image (multipart form, `file` field). |
| `GET` | `/:creatorId/avatar` | none | -- | Stream avatar image. |
| `GET` | `/:creatorId/banner` | none | -- | Stream banner image. |

### Creator Member Routes (`creator-members.routes.ts`)

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/:creatorId/members` | required | Must be a team member or platform admin | List all team members with display names and roles. |
| `POST` | `/:creatorId/members` | required | `manageMembers` | Add a user as a team member. Target must exist and not already be a member. |
| `PATCH` | `/:creatorId/members/:memberId` | required | `manageMembers` | Change a member's team role. |
| `DELETE` | `/:creatorId/members/:memberId` | required | `manageMembers` | Remove a member. Cannot remove the last owner (returns 422). |
| `GET` | `/:creatorId/members/candidates` | required | `manageMembers` | Search eligible users to add. Filters to stakeholders/admins not already members. Supports `?q=` search by name/email and `?limit=` (default 20, max 50). |

## Schema

### `creator_profiles` table

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | UUID, generated application-side via `randomUUID()` |
| `display_name` | `text` NOT NULL | 1-100 characters |
| `bio` | `text` | Nullable, max 2000 characters |
| `avatar_key` | `text` | Storage key, nullable. Resolved to `/api/creators/:id/avatar` URL in responses. |
| `banner_key` | `text` | Storage key, nullable. Resolved to `/api/creators/:id/banner` URL in responses. |
| `social_links` | `jsonb` NOT NULL DEFAULT `[]` | Array of `SocialLink` objects (`{ platform, url, label? }`) |
| `handle` | `text` UNIQUE | Nullable. Validated by `HANDLE_REGEX`. |
| `created_at` | `timestamptz` NOT NULL | |
| `updated_at` | `timestamptz` NOT NULL | |

### `creator_members` table

| Column | Type | Notes |
|---|---|---|
| `creator_id` | `text` NOT NULL FK | References `creator_profiles.id` ON DELETE CASCADE |
| `user_id` | `text` NOT NULL FK | References `users.id` ON DELETE CASCADE |
| `role` | `text` NOT NULL | One of `owner`, `editor`, `viewer` |
| `created_at` | `timestamptz` NOT NULL | |

Primary key: `(creator_id, user_id)`. Indexes: `(user_id, role)` and `(creator_id, role)`.

Schema source: `apps/api/src/db/schema/creator.schema.ts`

## Configuration

### Handle System

Handles are human-readable URL slugs for creator profiles. Defined by `HANDLE_REGEX` in `packages/shared/src/creator.ts`:

```
/^[a-z0-9_-]{3,30}$/
```

Rules: 3-30 characters, lowercase letters, digits, underscore, or hyphen.

**Auto-generation:** When a creator is created without an explicit handle, or when `displayName` changes without an explicit handle in the patch body, the system generates one via `generateUniqueSlug()` (`apps/api/src/services/slug.ts`). The slug algorithm:

1. Converts the display name to kebab-case (lowercase, spaces to hyphens, strip non-alphanumeric).
2. Truncates to 30 characters (`maxLength`).
3. If the result is shorter than 3 characters, generates a random fallback: `creator-{8-char-uuid-prefix}`.
4. Queries the DB for existing handles starting with the base slug.
5. If the base is taken, appends `-2`, `-3`, etc. until a unique handle is found.
6. When updating, excludes the current profile's own ID from the uniqueness check.

**Dual-mode resolution:** All `:creatorId` route parameters accept either a UUID or a handle. The `findCreatorProfile()` helper queries `WHERE id = $1 OR handle = $1`. Frontend components use `creator.handle ?? creator.id` for URL params, preferring human-readable handles when available.

### Social Links

Creator profiles store an array of social links in the `social_links` JSONB column. Each link has:

- `platform` -- one of the `SOCIAL_PLATFORMS` enum values
- `url` -- validated as a URL, plus platform-specific URL pattern validation where defined
- `label` -- optional, max 100 characters

Supported platforms (from `SOCIAL_PLATFORMS` in `packages/shared/src/creator.ts`):

| Platform Key | Display Name | URL Pattern Validated |
|---|---|---|
| `bandcamp` | Bandcamp | yes |
| `spotify` | Spotify | yes |
| `apple-music` | Apple Music | yes |
| `soundcloud` | SoundCloud | yes |
| `youtube-music` | YouTube Music | yes |
| `tidal` | Tidal | yes |
| `instagram` | Instagram | yes |
| `tiktok` | TikTok | yes |
| `twitter` | Twitter / X | yes |
| `mastodon` | Mastodon | no |
| `youtube` | YouTube | yes |
| `website` | Website | no |

Constraints enforced by `UpdateCreatorProfileSchema`:
- Maximum 20 links per profile (`MAX_SOCIAL_LINKS`).
- No duplicate platforms within a single profile.
- URLs must match platform-specific regex patterns where defined (e.g., Bandcamp URLs must match `^https?://[a-zA-Z0-9-]+\.bandcamp\.com(/.*)?$`).

### Image Upload

Avatar and banner uploads use the `upload-replace-workflow` pattern:

1. Pre-check `Content-Length` header against `MAX_FILE_SIZES.image`.
2. Resolve the creator profile (by UUID or handle).
3. Verify `editProfile` permission.
4. Parse multipart body, extract the `file` field.
5. Validate actual file size and MIME type against `ACCEPTED_MIME_TYPES.image`.
6. Delete the old file from storage if replacing.
7. Upload to storage at `creators/{profileId}/{avatar|banner}/{sanitizedFilename}`.
8. Update the DB with the new storage key.

### List Enrichment

The `GET /` list endpoint enriches responses beyond the base profile data using batch helpers from `apps/api/src/services/creator-list.ts`:

- **`batchGetContentCounts`** -- published, non-deleted content count per creator.
- **`batchGetSubscribedCreatorIds`** -- for authenticated users, checks active platform subscriptions (patron of all creators) and active creator-specific subscriptions.
- **`batchGetSubscriberCounts`** -- active subscriber count per creator (stakeholder/admin only).
- **`batchGetLastPublished`** -- most recent publish date per creator (stakeholder/admin only).

### Pagination

The list endpoint uses cursor-based keyset pagination. Cursors encode `{ createdAt, id }` pairs. The list is ordered by `created_at DESC, id DESC`. The client-side `useCursorPagination` hook (`apps/web/src/hooks/use-cursor-pagination.ts`) handles accumulating pages, resetting on dependency changes, and aborting in-flight requests.

Default page size: 24. Maximum: 50 (from `CreatorListQuerySchema`).

## Key Decisions

1. **Creator is an entity, not a role.** A creator profile is not a user attribute -- it is an independent entity with its own identity, team, and content. Users relate to creators through team membership. This enables multi-member bands, labels, and collaborative projects.

2. **Team roles are orthogonal to platform roles.** Platform roles (`admin`, `stakeholder`) govern platform access. Creator team roles (`owner`, `editor`, `viewer`) govern what a user can do within a specific creator entity. Platform admins get implicit full access to all creators.

3. **Only stakeholders/admins can create creators or join teams.** This keeps creator entity creation tied to cooperative membership rather than open registration.

4. **Last-owner protection.** The API prevents removing or demoting the last owner of a creator entity (returns 422), ensuring every creator always has at least one owner.

5. **Handle auto-regeneration on rename.** When a creator's `displayName` changes and no explicit handle is provided, the handle is automatically regenerated from the new name. This keeps URLs aligned with display names by default while allowing manual handle overrides.

6. **Dual-mode identifier resolution.** All `:creatorId` parameters accept UUID or handle. This supports human-readable URLs (`/creators/my-band`) while keeping UUIDs available for programmatic access.

7. **Batch queries to avoid N+1.** The list endpoint uses batched helpers for content counts, subscription status, subscriber counts, and last-published dates rather than per-item queries.

## Gotchas

1. **Handle uniqueness is checked application-side.** Both `POST /` (create) and `PATCH /:creatorId` (update) manually query for existing handles before writing. The `handle` column has a `UNIQUE` constraint as a safety net, but the application checks first to return friendly error messages.

2. **`findCreatorProfile` uses OR on id/handle.** If a handle happens to look like a UUID (unlikely given the regex), the query could match on the wrong field. In practice, `HANDLE_REGEX` prevents this since it requires 3-30 characters of `[a-z0-9_-]` which rarely collides with UUID format.

3. **Image storage keys use the profile UUID, not the handle.** Storage paths are `creators/{id}/avatar/...` using the immutable UUID, so handle renames do not break file references.

4. **Social link validation happens at the Zod schema level.** The `UpdateCreatorProfileSchema` runs platform-specific URL pattern validation via `.refine()`. Mastodon and Website have no URL pattern -- any valid URL is accepted for those platforms.

5. **Candidate search exposes email addresses.** The `GET /:creatorId/members/candidates` endpoint returns user emails to help identify candidates. This is gated behind `manageMembers` permission (owner or admin only).

6. **The list endpoint sorts subscribed creators first for authenticated users.** This is a stable sort on top of the `createdAt DESC` ordering, so subscribed creators bubble up within each page but cursor-based pagination still works correctly since cursors use `createdAt`/`id`.

7. **Creator creation is a two-step DB write.** `POST /` inserts into `creator_profiles` then `creator_members` in sequence (not a transaction). If the member insert fails, an orphaned profile could exist. This is a known simplification.

See [auth.md](auth.md) for platform roles and authentication. See [content.md](content.md) for creator content management.
