import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";

import type { CreatorProfileResponse, CreatorStatus } from "@snc/shared";
import { CREATOR_STATUSES } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { listAdminCreators, createCreator, updateCreatorStatus } from "../../lib/admin.js";
import listingStyles from "../../styles/listing-page.module.css";

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

// ── Private Components ──

function StatusBadge({ status }: { status: CreatorStatus }): React.ReactElement {
  const colors: Record<CreatorStatus, string> = {
    active: "#16a34a",
    inactive: "#6b7280",
    archived: "#dc2626",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "#fff",
        backgroundColor: colors[status],
        marginLeft: "0.5rem",
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

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
    <span style={{ marginLeft: "0.75rem" }}>
      {creator.status === "inactive" && (
        <button disabled={busy} onClick={() => handle("active")} style={{ marginRight: "0.25rem" }}>
          Activate
        </button>
      )}
      {creator.status === "active" && (
        <>
          <button disabled={busy} onClick={() => handle("inactive")} style={{ marginRight: "0.25rem" }}>
            Deactivate
          </button>
          <button disabled={busy} onClick={() => handle("archived")} style={{ marginRight: "0.25rem" }}>
            Archive
          </button>
        </>
      )}
      {creator.status === "archived" && (
        <button disabled={busy} onClick={() => handle("active")}>
          Restore
        </button>
      )}
    </span>
  );
}

// ── Component ──

function AdminCreatorsPage(): React.ReactElement {
  const { creators: initialCreators } = Route.useLoaderData();
  const [creators, setCreators] = useState<readonly CreatorProfileResponse[]>(initialCreators);
  const [statusFilter, setStatusFilter] = useState<CreatorStatus | "all">("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered =
    statusFilter === "all" ? creators : creators.filter((c) => c.status === statusFilter);

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

  const handleStatusChange = async (creatorId: string, status: CreatorStatus) => {
    setError(null);
    try {
      const result = await updateCreatorStatus(creatorId, { status });
      setCreators((prev) =>
        prev.map((c) => (c.id === creatorId ? result.creator : c)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className={listingStyles.heading}>Creators</h1>
        <button onClick={() => { setShowCreateForm(true); setError(null); }}>
          Create Creator
        </button>
      </div>

      {/* Status filter tabs */}
      <div style={{ marginBottom: "1rem" }}>
        {(["all", ...CREATOR_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              marginRight: "0.5rem",
              fontWeight: statusFilter === s ? 700 : 400,
              textDecoration: statusFilter === s ? "underline" : "none",
            }}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Create form (inline, toggleable) */}
      {showCreateForm && (
        <form onSubmit={handleCreate} style={{ marginBottom: "1rem" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Display name"
            required
            style={{ marginRight: "0.5rem" }}
          />
          <button type="submit" disabled={isSubmitting} style={{ marginRight: "0.25rem" }}>
            {isSubmitting ? "Creating..." : "Create"}
          </button>
          <button type="button" onClick={() => { setShowCreateForm(false); setNewName(""); }}>
            Cancel
          </button>
        </form>
      )}

      {/* Error message */}
      {error && <p style={{ color: "#dc2626" }}>{error}</p>}

      {/* Creator list with status badges and actions */}
      {filtered.length === 0 ? (
        <p className={listingStyles.status}>No creators found.</p>
      ) : (
        <ul>
          {filtered.map((c) => (
            <li key={c.id} style={{ marginBottom: "0.5rem" }}>
              <Link to="/creators/$creatorId/manage" params={{ creatorId: c.handle ?? c.id }}>
                {c.displayName}
              </Link>
              <StatusBadge status={c.status} />
              <StatusActions creator={c} onStatusChange={handleStatusChange} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
