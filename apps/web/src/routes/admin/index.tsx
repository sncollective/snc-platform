import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";
import { Users } from "lucide-react";
import type { AdminUser, Role } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { assignRole, revokeRole } from "../../lib/admin.js";
import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { UserRoleManager } from "../../components/admin/user-role-manager.js";
import errorStyles from "../../styles/error-alert.module.css";
import listingStyles from "../../styles/listing-page.module.css";
import pageHeadingStyles from "../../styles/page-heading.module.css";
import styles from "../admin.module.css";

export const Route = createFileRoute("/admin/")({
  errorComponent: RouteErrorBoundary,
  head: () => ({ meta: [{ title: "Admin — S/NC" }] }),
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

  const handleAssignRole = async (
    userId: string,
    role: Role,
  ): Promise<void> => {
    setActionError(null);
    try {
      const result = await assignRole(userId, { role });
      setLocalUsers((prev) => new Map(prev).set(userId, result.user));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to assign role");
    }
  };

  const handleRevokeRole = async (
    userId: string,
    role: Role,
  ): Promise<void> => {
    setActionError(null);
    try {
      const result = await revokeRole(userId, { role });
      setLocalUsers((prev) => new Map(prev).set(userId, result.user));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to revoke role");
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={pageHeadingStyles.heading}>Admin</h1>

      {actionError !== null && (
        <div className={errorStyles.error} role="alert">{actionError}</div>
      )}

      {isLoading && users.length === 0 ? (
        <p className={listingStyles.status}>Loading users...</p>
      ) : error !== null && users.length === 0 ? (
        <div className={errorStyles.error} role="alert">{error}</div>
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
            <div className={listingStyles.empty}>
              <Users size={32} aria-hidden="true" />
              <p>No users found</p>
            </div>
          )}

          {nextCursor !== null && (
            <div className={listingStyles.loadMoreWrapper}>
              <button
                type="button"
                className={listingStyles.loadMoreButton}
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
