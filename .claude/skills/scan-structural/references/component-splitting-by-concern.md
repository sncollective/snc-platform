# Rule: Component Splitting by Concern

> Split components when they have multiple logical sections or tangled state — not at a line count.

## Motivation

React components, especially forms, are inherently complex. Splitting at an arbitrary line count
creates prop-drilling and fragments cohesive logic. Instead, split when structural signals appear:
multiple logical sections, state that serves different purposes, or sub-sections that could be
independently tested. Extract Zod schemas to `.schema.ts` files, submission logic to hooks, and
field groups to sub-components — but leave cohesive single-concept components intact even at 400 lines.

## Before / After

### From this codebase: event-form.tsx (648 lines)

**Before:**
```
apps/web/src/components/calendar/
├── event-form.tsx             # 648 lines — form state + validation + date/time
│                              #   section + recurrence section + details section
│                              #   + submission logic + Zod schema
└── event-form.module.css
```

**After:**
```
apps/web/src/components/calendar/
├── event-form.tsx             # ~200 lines — orchestrator wiring sections together
├── event-form.schema.ts       # Zod schema extracted (reusable for API validation)
├── use-event-form.ts          # Form state management + submission logic hook
├── date-time-section.tsx      # Date/time picker section (if distinct logical group)
├── recurrence-section.tsx     # Recurrence rule section (if distinct logical group)
├── event-form.module.css
└── date-time-section.module.css
```

### Synthetic example: monolithic settings page

**Before:**
```tsx
// settings.tsx — 500 lines
function Settings() {
  // Profile form state (50 lines)
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  // ...

  // Notification preferences state (40 lines)
  const [emailNotifs, setEmailNotifs] = useState(true);
  // ...

  // Danger zone state (30 lines)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // ...

  return (
    <div>
      {/* Profile section — 80 lines of JSX */}
      {/* Notification section — 60 lines of JSX */}
      {/* Danger zone — 40 lines of JSX */}
    </div>
  );
}
```

**After:**
```tsx
// settings.tsx — 50 lines (orchestrator)
function Settings() {
  return (
    <div>
      <ProfileSection />
      <NotificationSection />
      <DangerZone />
    </div>
  );
}

// profile-section.tsx — each section owns its state
// notification-section.tsx
// danger-zone.tsx
```

## Exceptions

- **Cohesive single-concept forms** — a form that handles one entity (e.g., "edit booking")
  with interdependent fields can stay at 400+ lines if all fields are related and splitting
  would create coupling headaches via shared form context.
- **Components under ~300 lines** — rarely worth splitting regardless of structure. The overhead
  of additional files and imports outweighs the clarity benefit.
- **Generated or data-driven components** — components that are large because they render many
  similar items (e.g., a table with 20 column definitions) don't benefit from structural splitting.
- **Route page components** — TanStack Start route files (`routes/*.tsx`) that are under 400
  lines and primarily compose other components should stay as single files.

## Scope

- Applies to: `apps/web/src/components/**/*.tsx`, `apps/web/src/routes/**/*.tsx`
- Extraction targets: same domain folder (sub-components), `hooks/` (shared hooks)
- Schema extraction: co-located `.schema.ts` file in the same directory
- Does NOT apply to: API route files (see thin-handlers rule), test files, CSS modules
