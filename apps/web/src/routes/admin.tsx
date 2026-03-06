import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type React from "react";
import type { AdminUser, Role } from "@snc/shared";

import { fetchAuthState } from "../lib/auth.js";
import { assignRole, revokeRole } from "../lib/admin.js";
import { useCursorPagination } from "../hooks/use-cursor-pagination.js";
import { UserRoleManager } from "../components/admin/user-role-manager.js";
import styles from "./admin.module.css";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { user, roles } = await fetchAuthState();

    if (!user) {
      throw redirect({ to: "/login" });
    }

    if (!roles.includes("admin")) {
      throw redirect({ to: "/feed" });
    }
  },
  component: AdminPage,
});

function AdminPage(): React.ReactElement {
  const {
    items: users,
    nextCursor,
    isLoading,
    error,
    loadMore,
  } = useCursorPagination<AdminUser>({
    buildUrl: (cursor) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      params.set("limit", "20");
      return `/api/admin/users?${params.toString()}`;
    },
    fetchOptions: { credentials: "include" },
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [localUsers, setLocalUsers] = useState<Map<string, AdminUser>>(new Map());

  const getUser = (u: AdminUser): AdminUser => localUsers.get(u.id) ?? u;

  const handleAssignRole = useCallback(
    async (userId: string, role: Role): Promise<void> => {
      setActionError(null);
      try {
        const result = await assignRole(userId, { role });
        setLocalUsers((prev) => new Map(prev).set(userId, result.user));
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Failed to assign role");
      }
    },
    [],
  );

  const handleRevokeRole = useCallback(
    async (userId: string, role: Role): Promise<void> => {
      setActionError(null);
      try {
        const result = await revokeRole(userId, { role });
        setLocalUsers((prev) => new Map(prev).set(userId, result.user));
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Failed to revoke role");
      }
    },
    [],
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Admin</h1>

      {actionError !== null && (
        <div className={styles.error} role="alert">{actionError}</div>
      )}

      {isLoading && users.length === 0 ? (
        <p className={styles.status}>Loading users...</p>
      ) : error !== null && users.length === 0 ? (
        <div className={styles.error} role="alert">{error}</div>
      ) : (
        <>
          <div className={styles.userList}>
            {users.map((user) => (
              <UserRoleManager
                key={user.id}
                user={getUser(user)}
                onAssignRole={handleAssignRole}
                onRevokeRole={handleRevokeRole}
              />
            ))}
          </div>

          {users.length === 0 && !isLoading && (
            <p className={styles.status}>No users found</p>
          )}

          {nextCursor !== null && (
            <div className={styles.loadMoreWrapper}>
              <button
                type="button"
                className={styles.loadMoreButton}
                onClick={loadMore}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
