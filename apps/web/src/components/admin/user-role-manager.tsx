import { useState } from "react";
import type React from "react";

import { ROLES } from "@snc/shared";
import type { AdminUser, Role } from "@snc/shared";

import styles from "./user-role-manager.module.css";

// ── Types ──

interface UserRoleManagerProps {
  readonly user: AdminUser;
  readonly onAssignRole: (userId: string, role: Role) => Promise<void>;
  readonly onRevokeRole: (userId: string, role: Role) => Promise<void>;
}

// ── Public API ──

export function UserRoleManager({
  user,
  onAssignRole,
  onRevokeRole,
}: UserRoleManagerProps): React.ReactElement {
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | "">(""  );

  const availableRoles = ROLES.filter((r) => !user.roles.includes(r));

  const handleAssign = async () => {
    if (!selectedRole || isUpdating) return;
    setIsUpdating(true);
    try {
      await onAssignRole(user.id, selectedRole);
      setSelectedRole("");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRevoke = async (role: Role) => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      await onRevokeRole(user.id, role);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={styles.userRow}>
      <div className={styles.userInfo}>
        <div className={styles.userName}>{user.name}</div>
        <div className={styles.userEmail}>{user.email}</div>
      </div>

      <div className={styles.roles}>
        {user.roles.map((role) => (
          <span key={role} className={styles.roleBadge}>
            {role}
            <button
              type="button"
              className={styles.removeRole}
              onClick={() => void handleRevoke(role)}
              disabled={isUpdating}
              aria-label={`Remove ${role} role`}
            >
              ×
            </button>
          </span>
        ))}

        {availableRoles.length > 0 && (
          <div className={styles.addRole}>
            <select
              className={styles.roleSelect}
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as Role | "")}
              aria-label="Select role to add"
            >
              <option value="">Add role...</option>
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.addButton}
              onClick={() => void handleAssign()}
              disabled={!selectedRole || isUpdating}
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
