import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import type React from "react";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
} from "@tanstack/react-table";
import type { SortingState, ColumnFiltersState } from "@tanstack/react-table";

import type { CreatorProfileResponse, CreatorStatus } from "@snc/shared";
import { CREATOR_STATUSES } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { listAdminCreators, createCreator, updateCreatorStatus } from "../../lib/admin.js";
import { apiMutate } from "../../lib/fetch-utils.js";
import listingStyles from "../../styles/listing-page.module.css";
import formStyles from "../../styles/form.module.css";
import errorStyles from "../../styles/error-alert.module.css";
import successStyles from "../../styles/success-alert.module.css";
import styles from "./admin-creators.module.css";

// ── Private Types ──

interface AdminCreatorsLoaderData {
  readonly creators: readonly CreatorProfileResponse[];
}

// ── Route ──

export const Route = createFileRoute("/admin/creators")({
  head: () => ({ meta: [{ title: "Creators — Admin — S/NC" }] }),
  errorComponent: RouteErrorBoundary,
  loader: async (): Promise<AdminCreatorsLoaderData> => {
    const data = await fetchApiServer({ data: "/api/admin/creators?limit=100" });
    return { creators: (data as { items: CreatorProfileResponse[] }).items };
  },
  component: AdminCreatorsPage,
});

// ── Column Helper ──

const columnHelper = createColumnHelper<CreatorProfileResponse>();

// ── Private Components ──

interface StatusActionsProps {
  creator: CreatorProfileResponse;
  onStatusChange: (creatorId: string, status: CreatorStatus) => Promise<void>;
}

function StatusActions({ creator, onStatusChange }: StatusActionsProps): React.ReactElement {
  const [busy, setBusy] = useState(false);

  const handle = async (status: CreatorStatus) => {
    if (status === "archived") {
      const confirmed = window.confirm(
        `Archive "${creator.displayName}"? This will remove all their content from channel pools.`,
      );
      if (!confirmed) return;
    }
    setBusy(true);
    try {
      await onStatusChange(creator.id, status);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.actionButtons}>
      {creator.status === "inactive" && (
        <button
          className={styles.actionButton}
          disabled={busy}
          onClick={() => { void handle("active"); }}
        >
          Activate
        </button>
      )}
      {creator.status === "active" && (
        <>
          <button
            className={styles.actionButton}
            disabled={busy}
            onClick={() => { void handle("inactive"); }}
          >
            Deactivate
          </button>
          <button
            className={styles.actionButton}
            disabled={busy}
            onClick={() => { void handle("archived"); }}
          >
            Archive
          </button>
        </>
      )}
      {creator.status === "archived" && (
        <button
          className={styles.actionButton}
          disabled={busy}
          onClick={() => { void handle("active"); }}
        >
          Restore
        </button>
      )}
    </div>
  );
}

// ── Invite Dialog ──

interface InviteCreatorDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

function InviteCreatorDialog({ open, onClose, onSuccess }: InviteCreatorDialogProps): React.ReactElement | null {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError("");
    if (!email || !displayName) {
      setError("Both fields are required");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiMutate("/api/invites", {
        method: "POST",
        body: { type: "creator_owner", email, displayName },
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite. Check the email and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={styles.dialogOverlay}
      onClick={onClose}
    >
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Invite Creator"
      >
        <h3 className={styles.dialogTitle}>Invite Creator</h3>
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          {error && (
            <p className={errorStyles.error} role="alert">
              {error}
            </p>
          )}
          <label className={styles.dialogField}>
            Email
            <input
              className={styles.dialogFieldInput}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className={styles.dialogField}>
            Display Name
            <input
              className={styles.dialogFieldInput}
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </label>
          <div className={styles.dialogActions}>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Component ──

function AdminCreatorsPage(): React.ReactElement {
  const { creators: initialCreators } = Route.useLoaderData();
  const [creators, setCreators] = useState<readonly CreatorProfileResponse[]>(initialCreators);
  const [statusFilter, setStatusFilter] = useState<CreatorStatus | "all">("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await createCreator({ displayName: newName });
      setCreators((prev) => [result.creator, ...prev]);
      setNewName("");
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create creator");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = useCallback(async (creatorId: string, status: CreatorStatus) => {
    setError(null);
    try {
      const result = await updateCreatorStatus(creatorId, { status });
      setCreators((prev) =>
        prev.map((c) => (c.id === creatorId ? result.creator : c)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: creators.length };
    for (const c of creators) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [creators]);

  const columnFilters = useMemo<ColumnFiltersState>(
    () => [{ id: "status", value: statusFilter }],
    [statusFilter],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("displayName", {
        header: "Name",
        cell: (info) => (
          <Link
            to="/creators/$creatorId/manage"
            params={{ creatorId: info.row.original.handle ?? info.row.original.id }}
            className={styles.creatorName}
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("handle", {
        header: "Handle",
        cell: (info) => (
          <span className={styles.handle}>
            {info.getValue() ? `@${info.getValue()}` : "—"}
          </span>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const status = info.getValue();
          const statusClass =
            status === "active"
              ? styles.statusActive
              : status === "inactive"
                ? styles.statusInactive
                : styles.statusArchived;
          return (
            <span className={`${styles.statusBadge} ${statusClass}`}>
              {status}
            </span>
          );
        },
        filterFn: (row, _columnId, filterValue: string) => {
          if (filterValue === "all") return true;
          return row.original.status === filterValue;
        },
      }),
      columnHelper.accessor("contentCount", {
        header: "Content",
        cell: (info) => info.getValue(),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <StatusActions
            creator={info.row.original}
            onStatusChange={handleStatusChange}
          />
        ),
      }),
    ],
    [handleStatusChange],
  );

  const table = useReactTable({
    data: creators as CreatorProfileResponse[],
    columns,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={listingStyles.heading}>Creators</h1>
        <div className={styles.actions}>
          <button onClick={() => { setShowInviteDialog(true); setInviteSuccess(false); }}>
            Invite Creator
          </button>
          <button onClick={() => { setShowCreateForm(true); setError(null); }}>
            Create Creator
          </button>
        </div>
      </div>

      {inviteSuccess && (
        <p className={successStyles.success}>Invite sent successfully!</p>
      )}

      <InviteCreatorDialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        onSuccess={() => setInviteSuccess(true)}
      />

      {/* Create form (inline, toggleable) */}
      {showCreateForm && (
        <form onSubmit={(e) => { void handleCreate(e); }} className={styles.createForm}>
          <input
            className={formStyles.input}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Display name"
            required
          />
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create"}
          </button>
          <button type="button" onClick={() => { setShowCreateForm(false); setNewName(""); }}>
            Cancel
          </button>
        </form>
      )}

      {/* Error message */}
      {error && <p className={errorStyles.error}>{error}</p>}

      {/* Status filter tabs */}
      <div className={styles.filterTabs}>
        {(["all", ...CREATOR_STATUSES] as const).map((s) => (
          <button
            key={s}
            className={`${styles.filterTab} ${statusFilter === s ? styles.filterTabActive : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            <span className={styles.filterCount}>({statusCounts[s] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          placeholder="Search creators..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          aria-label="Search creators"
        />
      </div>

      {/* Creator table */}
      {table.getRowModel().rows.length === 0 ? (
        <p className={styles.emptyState}>No creators found.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" ? " \u2191" : ""}
                    {header.column.getIsSorted() === "desc" ? " \u2193" : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
