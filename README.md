# S/NC

A worker-cooperative content publishing platform. Creators publish video, audio, and written content behind a subscription gate, sell merchandise via a headless Shopify storefront, embed Bandcamp players, and offer bookable creative services — all governed democratically by cooperative members.

Built as an alternative to extractive platforms.

**Live:** [s-nc.org](https://s-nc.org)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API** | [Hono](https://hono.dev) on Node.js 24+ with OpenAPI 3.1 docs |
| **Frontend** | [TanStack Start](https://tanstack.com/start) (React 19, SSR, file-based routing) |
| **Database** | [PostgreSQL 16](https://www.postgresql.org/) via [Drizzle ORM](https://orm.drizzle.team) |
| **Auth** | [Better Auth](https://www.better-auth.com) (email/password, multi-role) |
| **Payments** | [Stripe](https://stripe.com) (subscriptions, checkout, webhooks) |
| **Merch** | [Shopify Storefront API](https://shopify.dev/docs/api/storefront) (headless) |
| **Validation** | [Zod 4](https://zod.dev) (API + shared), [zod/mini](https://zod.dev) (frontend) |
| **Testing** | [Vitest](https://vitest.dev), Testing Library, [Playwright](https://playwright.dev) (e2e) |
| **Object Storage** | [Garage](https://garagehq.deuxfleurs.fr) (S3-compatible, production) |
| **Logging** | [pino](https://getpino.io) (structured JSON, request-scoped via hono-pino) |
| **Styling** | CSS Modules + CSS custom properties (design tokens) |
| **Package Manager** | pnpm 10+ with workspaces |
| **Reverse Proxy** | [Caddy](https://caddyserver.com) (dev + production) |

## Repository Structure

```
snc/
├── apps/
│   ├── api/                  # Hono API server
│   │   ├── src/
│   │   │   ├── app.ts        # Hono instance, middleware, route registration
│   │   │   ├── index.ts      # Server entry point, graceful shutdown
│   │   │   ├── config.ts     # Zod-validated env config
│   │   │   ├── auth/         # Better Auth instance + role service
│   │   │   ├── db/           # Drizzle connection + schema definitions
│   │   │   ├── middleware/    # Auth, CORS, error handler, content gating
│   │   │   ├── routes/       # Domain-grouped route handlers
│   │   │   ├── services/     # Stripe, Shopify, revenue integrations
│   │   │   └── storage/      # Pluggable StorageProvider (local or S3)
│   │   ├── tests/            # API tests
│   │   └── drizzle/          # SQL migrations
│   └── web/                  # TanStack Start frontend
│       ├── src/
│       │   ├── routes/       # File-based routes
│       │   ├── components/   # React components by domain
│       │   ├── contexts/     # Audio player context (reducer + provider)
│       │   ├── hooks/        # Shared hooks (pagination, auth guards, etc.)
│       │   ├── lib/          # API clients, auth, formatting utilities
│       │   └── styles/       # Global CSS + shared CSS modules
│       └── tests/            # Web tests
├── packages/
│   └── shared/               # Zod schemas, types, error classes, Result<T,E>
│       ├── src/
│       └── tests/
├── docker-compose.yml        # PostgreSQL 16
├── .env.example              # Environment template
└── CLAUDE.md                 # Coding conventions
```

## Prerequisites

- **Node.js** >= 24.0.0
- **pnpm** >= 10.0.0
- **Docker** (for PostgreSQL)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container (`snc-postgres`) on port 5432 with user `snc`, password `snc`, database `snc`.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add the required secrets:

```bash
# Required — copy these and fill in real values
DATABASE_URL=postgres://snc:snc@localhost:5432/snc
PORT=3000
CORS_ORIGIN=http://localhost:3080

# Auth — generate a secret with: openssl rand -base64 32
BETTER_AUTH_SECRET=<your-32+-char-secret>
BETTER_AUTH_URL=http://localhost:3080

# Storage (local for dev, s3 for production)
STORAGE_TYPE=local
STORAGE_LOCAL_DIR=./uploads

# S3-compatible storage (required when STORAGE_TYPE=s3)
# S3_ENDPOINT=https://your-s3-endpoint
# S3_REGION=garage
# S3_BUCKET=your-bucket
# S3_ACCESS_KEY_ID=your-access-key
# S3_SECRET_ACCESS_KEY=your-secret-key

# Stripe (optional) — get from https://dashboard.stripe.com/apikeys
# Subscription/billing features return 503 when not set. The rest of the app works.
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# Shopify (optional) — get from Shopify Admin → Apps → Headless
# Merch features return 503 when not set. The rest of the app works.
# SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
# SHOPIFY_STOREFRONT_TOKEN=your_storefront_access_token
```

The frontend reads `VITE_API_URL` from `apps/web/.env.local` (defaults to `http://localhost:3000` if not set):

```bash
# apps/web/.env.local (optional)
VITE_API_URL=http://localhost:3000
```

### 4. Run database migrations

```bash
pnpm --filter @snc/api db:migrate
```

### 5. Start development servers

Start all three processes — API, web, and Caddy reverse proxy:

```bash
# Terminal 1: API server (port 3000)
pnpm --filter @snc/api dev

# Terminal 2: Web server (port 3001)
pnpm --filter @snc/web dev

# Terminal 3: Caddy reverse proxy (port 3080)
caddy run --config Caddyfile.dev
```

Or start API + web together with `pnpm dev`, plus Caddy in a separate terminal.

The API runs with `--watch` for automatic restarts. The web server uses Vite HMR. Caddy routes `/api`, `/health`, and `/uploads` to the API and everything else to the web server.

### 6. Verify it's working

- **App**: http://localhost:3080 (through Caddy — use this in the browser)
- **API health**: http://localhost:3080/health (or directly at http://localhost:3000/health)
- **API docs**: http://localhost:3000/api/docs (Scalar UI — direct access)
- **OpenAPI spec**: http://localhost:3000/api/openapi.json

## Running Tests

```bash
# All unit tests
pnpm test

# By workspace
pnpm --filter @snc/api test
pnpm --filter @snc/web test
pnpm --filter @snc/shared test

# Watch mode
pnpm --filter @snc/api test -- --watch
```

Unit tests mock all external services (Stripe, Shopify, database). No running services are needed.

E2E tests use Playwright against a running dev environment:

```bash
pnpm --filter @snc/e2e test
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API + web dev servers |
| `pnpm test` | Run all tests |
| `pnpm build` | Build all workspaces |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm lint` | Lint all workspaces (via `tsc --noEmit`) |
| `pnpm --filter @snc/api db:generate` | Generate new Drizzle migration |
| `pnpm --filter @snc/api db:migrate` | Apply pending migrations |

## Environment Variables Reference

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Auth secret, min 32 characters (`openssl rand -base64 32`) |

### Optional (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `LOG_LEVEL` | `info` | pino log level (`debug`, `info`, `warn`, `error`) |
| `CORS_ORIGIN` | `http://localhost:3080` | Allowed CORS origin(s), comma-separated |
| `BETTER_AUTH_URL` | `http://localhost:3080` | Auth service base URL |
| `STORAGE_TYPE` | `local` | Storage backend (`local` or `s3`) |
| `STORAGE_LOCAL_DIR` | `./uploads` | Upload directory for local storage |
| `S3_ENDPOINT` | — | S3-compatible endpoint URL (required when `STORAGE_TYPE=s3`) |
| `S3_REGION` | `garage` | S3 region |
| `S3_BUCKET` | — | S3 bucket name |
| `S3_ACCESS_KEY_ID` | — | S3 access key |
| `S3_SECRET_ACCESS_KEY` | — | S3 secret key |
| `STRIPE_SECRET_KEY` | — | Stripe API key (billing returns 503 without it) |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook secret (billing returns 503 without it) |
| `SHOPIFY_STORE_DOMAIN` | — | Shopify `.myshopify.com` domain (merch returns 503 without it) |
| `SHOPIFY_STOREFRONT_TOKEN` | — | Shopify Storefront API token (merch returns 503 without it) |
| `OWNCAST_URL` | — | Owncast instance URL (streaming returns 503 without it) |
| `FEDERATION_DOMAIN` | `s-nc.org` | ActivityPub federation domain |
| `SEAFILE_OIDC_CLIENT_ID` | — | Seafile OIDC client ID (OIDC provider inactive without it) |
| `SEAFILE_OIDC_CLIENT_SECRET` | — | Seafile OIDC client secret |
| `SMTP_HOST` | — | SMTP server (email features degrade gracefully without it) |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `EMAIL_FROM` | `S/NC <noreply@s-nc.org>` | Sender address for outbound email |
| `STUDIO_INQUIRY_EMAIL` | — | Email address for studio booking inquiries |
| `FEATURE_*` | `true` | Feature flags — see [Feature Flags](docs/feature-flags.md) |
| `VITE_API_URL` | `http://localhost:3000` | API URL for the frontend (in `apps/web/.env.local`) |

## API Endpoints

The API serves OpenAPI 3.1 documentation at `/api/openapi`. Key endpoint groups:

| Group | Base Path | Auth | Description |
|-------|-----------|------|-------------|
| Health | `GET /api/health` | Public | Health check |
| Auth | `/api/auth/*` | Public | Sign up, sign in, sign out (Better Auth) |
| Me | `GET /api/me` | Authenticated | Current user + session + roles |
| Admin | `/api/admin/*` | Admin | User management, role assignment |
| Content | `/api/content/*` | Mixed | CRUD, upload, feed, media streaming |
| Creators | `/api/creators/*` | Mixed | Profiles, avatar/banner, team members, events |
| Projects | `/api/projects/*` | Mixed | Creator project/series management |
| Calendar | `/api/calendar/*` | Stakeholder | Cooperative calendar, event types, iCal feed |
| Subscriptions | `/api/subscriptions/*` | Mixed | Plans, checkout, cancel |
| Webhooks | `POST /api/webhooks/stripe` | Stripe signature | Payment event processing |
| Merch | `/api/merch/*` | Public | Product listing, detail, checkout |
| Bookings | `/api/bookings/*` | Mixed | Services, booking requests, review |
| Dashboard | `/api/dashboard/*` | Stakeholder | Revenue, subscribers, bookings KPIs |
| Studio | `/api/studio/*` | Stakeholder | Studio dashboard |
| Emissions | `/api/emissions/*` | Stakeholder | Carbon tracking and reporting |
| Streaming | `/api/streaming/*` | Mixed | Owncast streaming integration |
| Federation | `/api/federation/*` | Public | ActivityPub federation endpoints |
| Upload | `/api/upload/*` | Authenticated | Multipart/presigned upload handling |

## User Roles

Platform roles are assigned via the `user_roles` join table. Users without a role are registered users; paying users with an active subscription are patrons. "Creator" is an entity type, not a role — users participate in creator teams (see [Creators](docs/creators.md)).

| Role | Capabilities |
|------|-------------|
| `stakeholder` | Cooperative member — access dashboard, calendar, revenue, booking management |
| `admin` | User management, role assignment, platform administration |

## Seeding Data

After migrations, the database is empty. To test the full flow:

### Subscription plans

Create Products and Prices in the [Stripe Dashboard](https://dashboard.stripe.com), then insert them:

```sql
INSERT INTO subscription_plans (id, name, type, interval, price_cents, currency, stripe_price_id, active)
VALUES
  (gen_random_uuid(), 'All Access Monthly', 'platform', 'month', 999, 'usd', 'price_xxx', true),
  (gen_random_uuid(), 'All Access Yearly', 'platform', 'year', 9999, 'usd', 'price_yyy', true);
```

### Services

```sql
INSERT INTO services (id, name, description, pricing_info, active, sort_order)
VALUES
  (gen_random_uuid(), 'Recording Session', 'Professional studio recording.', '$50/hour', true, 1),
  (gen_random_uuid(), 'Mixing & Mastering', 'Full mix and master.', '$200/track', true, 2),
  (gen_random_uuid(), 'Label Services', 'Distribution and licensing.', 'Contact for pricing', true, 3);
```

## Stripe Webhook Testing

To test webhooks locally, install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and forward events:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The webhook handler processes these events:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

## Shopify Merch Setup

Merch is optional. To enable it:

1. Set `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_TOKEN` in `.env`
2. In Shopify Admin, tag products with `snc-creator:<userId>` to associate them with creators
3. Set the `vendor` field to the creator's display name

Without Shopify credentials, the merch endpoints return 503 "MERCH_NOT_CONFIGURED" — the rest of the app works normally.

## Project Conventions

- **Named exports only** — no default exports
- **Strict TypeScript** — `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **File naming** — `kebab-case.ts` (e.g., `booking-form.tsx`, `content.routes.ts`)
- **Error handling** — Typed `AppError` subclasses, `Result<T, E>` for service functions
- **CSS** — CSS Modules with design tokens from `:root` custom properties in `global.css`
- **Validation** — Zod schemas on every route handler via `zValidator`; `zod/mini` on the frontend
- **Testing** — Vitest with fixture factories (`makeMock*` pattern), mocked external services

See [CLAUDE.md](./CLAUDE.md) for the full coding conventions reference.

## Architecture Notes

- **Monorepo** — pnpm workspaces, no Turborepo/Nx. Root scripts run across all packages.
- **Shared package** — `@snc/shared` contains all Zod schemas, TypeScript types, error classes, and the `Result<T, E>` type. Both API and web import from it for end-to-end type safety.
- **Storage abstraction** — The `StorageProvider` interface supports local filesystem (dev) and S3-compatible storage (production) without changing route handlers.
- **Content gating** — `checkContentAccess()` middleware enforces 5 priority rules (public, unauth, owner bypass, active subscription, reject) for subscription-based access control.
- **Cursor pagination** — Keyset pagination via base64-encoded cursors, with a reusable `useCursorPagination<T>` hook on the frontend.
- **No external charting library** — The dashboard revenue chart is pure CSS.

## Platform Documentation

Domain-specific documentation lives in `docs/`:

| Document | Description |
|----------|-------------|
| [Admin](docs/admin.md) | User management and role assignment |
| [Auth](docs/auth.md) | Authentication, sessions, OIDC provider, roles |
| [Calendar](docs/calendar.md) | Cooperative calendar, iCal feed |
| [Content](docs/content.md) | Publishing lifecycle, storage backends, access gating |
| [Creators](docs/creators.md) | Creator profiles, team membership |
| [Feature Flags](docs/feature-flags.md) | Domain-level feature flag system |

## License

Code and scripts are licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-or-later).

Documentation (README, CLAUDE.md, and other written materials) is licensed under [Creative Commons Attribution-ShareAlike 4.0 International](LICENSE-DOCS) (CC BY-SA 4.0).
