# Contributing

Thanks for your interest in contributing to S/NC.

## Getting Started

See the [README](README.md) for setup instructions — install dependencies, start PostgreSQL, configure environment, run migrations, and start dev servers.

## Development Workflow

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Run the full test suite: `bun run test:unit`
5. Submit a pull request

## Code Conventions

Full conventions are documented in [AGENTS.md](AGENTS.md). Key points:

- **Named exports only** — no default exports
- **kebab-case filenames** — `booking-form.tsx`, `content.routes.ts`
- **Typed errors** — use `AppError` subclasses, never plain `Error`
- **Result types** — service functions return `Result<T, E>` for predictable failures
- **CSS Modules** — use design tokens via `var(--token-name)`, never hardcode values
- **Tests required** — every route needs at least a happy-path and a failure test

## Database Migrations

Never hand-write migration SQL files. Always use:

```bash
bun run --filter @snc/api db:generate
bun run --filter @snc/api db:migrate
```

See the migration conventions in [AGENTS.md](AGENTS.md) for details.

## Platform Documentation

Read the domain docs before working on a specific area:

- [Auth](docs/auth.md) — authentication, sessions, OIDC provider, roles
- [Content](docs/content.md) — publishing lifecycle, storage, access gating
- [Creators](docs/creators.md) — creator profiles, team membership
- [Admin](docs/admin.md) — user management, role assignment
- [Calendar](docs/calendar.md) — cooperative calendar, iCal feed
- [Feature Flags](docs/feature-flags.md) — domain-level feature flag system

## License

By contributing, you agree that your code contributions will be licensed under [AGPL-3.0-or-later](LICENSE) and documentation contributions under [CC BY-SA 4.0](LICENSE-DOCS).
