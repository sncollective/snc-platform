import { useEffect, useState, useRef, useCallback } from "react";
import type React from "react";

import type {
  CreatorMember,
  CreatorMemberCandidate,
  CreatorMemberRole,
} from "@snc/shared";
import { CREATOR_MEMBER_ROLES, CREATOR_ROLE_PERMISSIONS } from "@snc/shared";

import {
  fetchCreatorMembers,
  addCreatorMember,
  updateCreatorMember,
  removeCreatorMember,
  fetchMemberCandidates,
} from "../../lib/creator.js";
import formStyles from "../../styles/form.module.css";
import listItemStyles from "../../styles/list-items.module.css";
import errorStyles from "../../styles/error-alert.module.css";
import successStyles from "../../styles/success-alert.module.css";
import styles from "./team-section.module.css";

// ── Public Types ──

export interface TeamSectionProps {
  readonly creatorId: string;
  readonly currentUserId: string;
}

// ── Private Constants ──

const ROLE_BADGE_CLASS: Record<CreatorMemberRole, string> = {
  owner: styles.roleBadgeOwner,
  editor: styles.roleBadgeEditor,
  viewer: styles.roleBadgeViewer,
};

const DEBOUNCE_MS = 300;

// ── Public API ──

export function TeamSection({
  creatorId,
  currentUserId,
}: TeamSectionProps): React.ReactElement {
  // ── Member State ──
  const [members, setMembers] = useState<CreatorMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // ── Add Member State ──
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<CreatorMemberCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] =
    useState<CreatorMemberCandidate | null>(null);
  const [addRole, setAddRole] = useState<CreatorMemberRole>("editor");
  const [isAdding, setIsAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived State ──
  const currentMember = members.find((m) => m.userId === currentUserId);
  const isOwner = currentMember?.role === "owner";
  const canManageMembers = isOwner;
  const ownerCount = members.filter((m) => m.role === "owner").length;

  // ── Load Members ──
  const loadMembers = useCallback(async (): Promise<void> => {
    try {
      const res = await fetchCreatorMembers(creatorId);
      setMembers(res.members);
    } catch {
      setError("Failed to load team members");
    } finally {
      setIsLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");
    setSearchQuery("");
    setCandidates([]);
    setSelectedCandidate(null);
    void loadMembers();
  }, [loadMembers]);

  // ── Search Candidates ──
  useEffect(() => {
    if (!canManageMembers) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchQuery.trim()) {
      setCandidates([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchMemberCandidates(creatorId, searchQuery.trim());
        setCandidates(res.candidates);
      } catch {
        // Silently fail search
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, creatorId, canManageMembers]);

  // ── Handlers ──
  const handleSelectCandidate = (candidate: CreatorMemberCandidate): void => {
    setSelectedCandidate(candidate);
    setSearchQuery("");
    setCandidates([]);
  };

  const handleAddMember = async (): Promise<void> => {
    if (!selectedCandidate) return;
    setIsAdding(true);
    setError("");
    setSuccessMessage("");

    try {
      const res = await addCreatorMember(creatorId, {
        userId: selectedCandidate.id,
        role: addRole,
      });
      setMembers(res.members);
      setSelectedCandidate(null);
      setAddRole("editor");
      setSuccessMessage(`Added ${selectedCandidate.name} as ${addRole}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add member",
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleChangeRole = async (
    userId: string,
    newRole: CreatorMemberRole,
  ): Promise<void> => {
    setError("");
    setSuccessMessage("");

    try {
      const res = await updateCreatorMember(creatorId, userId, {
        role: newRole,
      });
      setMembers(res.members);
      setSuccessMessage("Role updated");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update role",
      );
    }
  };

  const handleRemoveMember = async (userId: string): Promise<void> => {
    setError("");
    setSuccessMessage("");

    try {
      const res = await removeCreatorMember(creatorId, userId);
      setMembers(res.members);
      setSuccessMessage("Member removed");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove member",
      );
    }
  };

  // ── Render ──
  if (isLoading) {
    return (
      <section className={styles.section}>
        <h2 className={styles.heading}>Team</h2>
        <p>Loading team...</p>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Team</h2>

      {error && (
        <div className={errorStyles.error} role="alert">
          {error}
        </div>
      )}

      {successMessage && (
        <div className={successStyles.success} role="status">
          {successMessage}
        </div>
      )}

      {/* Add Member Form (owners only) */}
      {canManageMembers && (
        <div>
          {selectedCandidate ? (
            <div className={styles.addRow}>
              <div className={styles.selectedCandidate}>
                <span>{selectedCandidate.name}</span>
                <button
                  type="button"
                  className={styles.clearButton}
                  onClick={() => setSelectedCandidate(null)}
                  aria-label="Clear selection"
                >
                  x
                </button>
              </div>
              <select
                value={addRole}
                onChange={(e) =>
                  setAddRole(e.target.value as CreatorMemberRole)
                }
                className={formStyles.select}
                aria-label="Role for new member"
              >
                {CREATOR_MEMBER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.addButton}
                onClick={handleAddMember}
                disabled={isAdding}
              >
                {isAdding ? "Adding..." : "Add"}
              </button>
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users to add..."
                className={`${formStyles.input} ${styles.searchInput}`}
                aria-label="Search users to add"
              />
              {candidates.length > 0 && (
                <ul className={styles.candidateList} role="listbox">
                  {candidates.map((c) => (
                    <li
                      key={c.id}
                      className={styles.candidateItem}
                      role="option"
                      aria-selected={false}
                      onClick={() => handleSelectCandidate(c)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleSelectCandidate(c);
                        }
                      }}
                      tabIndex={0}
                    >
                      <span className={styles.candidateName}>{c.name}</span>
                      <span className={styles.candidateEmail}>{c.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Member List */}
      {members.length === 0 ? (
        <div className={listItemStyles.empty}>
          <p className={listItemStyles.emptyText}>No team members</p>
        </div>
      ) : (
        <div className={listItemStyles.list}>
          {members.map((member) => {
            const isSoleOwner =
              member.role === "owner" &&
              ownerCount <= 1 &&
              member.userId === currentUserId;

            return (
              <div key={member.userId} className={listItemStyles.item}>
                <div className={listItemStyles.itemHeader}>
                  <div className={styles.memberInfo}>
                    <span className={styles.memberName}>
                      {member.displayName}
                    </span>
                    {canManageMembers ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleChangeRole(
                            member.userId,
                            e.target.value as CreatorMemberRole,
                          )
                        }
                        className={formStyles.select}
                        disabled={isSoleOwner}
                        aria-label={`Role for ${member.displayName}`}
                      >
                        {CREATOR_MEMBER_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`${styles.roleBadge} ${ROLE_BADGE_CLASS[member.role]}`}
                      >
                        {member.role}
                      </span>
                    )}
                  </div>
                  {canManageMembers && (
                    <div className={styles.memberActions}>
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => handleRemoveMember(member.userId)}
                        disabled={isSoleOwner}
                        aria-label={`Remove ${member.displayName}`}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
