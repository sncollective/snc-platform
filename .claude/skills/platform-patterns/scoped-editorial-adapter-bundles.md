# scoped-editorial-adapter-bundles

Keep one editorial UI/service contract and inject admin vs creator scope at the route/client/mount boundary.

## When to use
The same queue/content-pool workflow is exposed to admins and creators with different auth gates, base paths, SSE topics, capabilities. Don't fork the UI; inject scope.

## Instances
- `apps/api/src/routes/playout-channels.routes.ts:228` — admin routes call shared orchestrator behind `requireRole("admin")`.
- `apps/api/src/routes/creator-playout.routes.ts:53,84` — creator surface mirrors same ops behind `requireCreatorChannelPermission("manageStreaming")`.
- `apps/web/src/lib/playout-channels.ts:13` + `creator-playout-channels.ts:14` — same client signatures, different base paths.
- `apps/web/src/components/playout/editorial-api.tsx:28,64,76` — shared `EditorialApi` contract + admin/creator bundles.

## Anti-patterns
Don't let a missing provider fall back to admin APIs; don't fork the whole surface when only auth/base-path/topic/capabilities differ; don't hide scope checks only in the UI.
