# controlled-confirm-dialog

Consequential UI actions use a shared controlled confirm dialog with explicit consequence labels.

## When to use
Use when a button triggers destructive or interrupting behavior and needs accessible confirmation.

## Instances
- `apps/web/src/components/ui/confirm-dialog.tsx:53` — shared controlled `ConfirmDialog` component.
- `apps/web/src/routes/admin/playout.tsx:327` — create-channel confirmation warns about playout restart.
- `apps/web/src/routes/admin/playout.tsx:341` — delete-channel confirmation uses danger tone/pending state.
- `apps/web/src/routes/creators/$creatorId/manage/streaming.tsx:355` — stream-key revoke confirmation.
- `apps/web/src/components/simulcast/simulcast-destination-manager.tsx:345` — simulcast destination delete confirmation.

## Canonical sketch
```tsx
const [pending, setPending] = useState<Item | null>(null);
<ConfirmDialog
  open={pending !== null}
  title="Delete item?"
  confirmLabel="Delete item"
  isPending={isDeleting}
  onConfirm={() => void handleConfirm()}
  onCancel={() => setPending(null)}
>
  This cannot be undone.
</ConfirmDialog>
```

## Anti-patterns
Don't use for low-risk reversible toggles; don't use generic labels like "OK" for destructive confirms.
