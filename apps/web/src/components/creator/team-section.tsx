import { useEffect, useState, useRef, useCallback } from "react";
import type React from "react";

import type {
  CreatorMember,
  CreatorMemberCandidate,
  CreatorMemberRole,
} from "@snc/shared";
import { CREATOR_MEMBER_ROLES, CREATOR_ROLE_PERMISSIONS } from "@snc/shared";

import {
  createListCollection,
  SelectRoot,
  SelectControl,
  SelectTrigger,
  SelectValueText,
  SelectContent,
  SelectItem,
  SelectItemText,
} from "../ui/select.js";

import {
  fetchCreatorMembers,
  addCreatorMember,
  updateCreatorMember,
  removeCreatorMember,
  fetchMemberCandidates,
} from "../../lib/creator.js";
import { apiMutate } from "../../lib/fetch-utils.js";
import { clsx } from "clsx/lite";

import formStyles from "../../styles/form.module.css";
import listItemStyles from "../../styles/list-items.module.css";
import errorStyles from "../../styles/error-alert.module.css";
import successStyles from "../../styles/success-alert.module.css";
import styles from "./team-section.module.css";

// ── Public Types ──

export interface TeamSectionProps {
  readonly creatorId: string;
  readonly currentUserId: string;
  readonly isAdmin: boolean;
}

// ── Private Constants ──

const ROLE_BADGE_CLASS: Record<CreatorMemberRole, string> = {
  owner: styles.roleBadgeOwner!,
  editor: styles.roleBadgeEditor!,
  viewer: styles.roleBadgeViewer!,
};

const DEBOUNCE_MS = 300;

const ROLE_COLLECTION = createListCollection({
  items: CREATOR_MEMBER_ROLES.map((r) => ({ value: r, label: r })),
});

// ── Public API ──

/** Manage a creator page's team members: list current members with role badges, search and add new members, change roles, and remove members. Only owners and admins see management controls. */
export function TeamSection({
  creatorId,
  currentUserId,
  isAdmin,
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
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Invite State ──
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CreatorMemberRole>("editor");
  const [inviteError, setInviteError] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  // ── Derived State ──
  const currentMember = members.find((m) => m.userId === currentUserId);
  const isOwner = currentMember?.role === "owner";
  const canManageMembers = isOwner || isAdmin;
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
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchMemberCandidates(creatorId, searchQuery.trim());
        setCandidates(res.candidates);
        setHasSearched(true);
      } catch {
        setHasSearched(true);
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

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setInviteError("");
    setIsInviting(true);

    try {
      await apiMutate("/api/invites", {
        method: "POST",
        body: { type: "team_member", email: inviteEmail, creatorId, role: inviteRole },
      });
      setShowInviteForm(false);
      setInviteEmail("");
      setInviteRole("editor");
      setSuccessMessage("Invite sent successfully");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setIsInviting(false);
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
              <SelectRoot
                collection={ROLE_COLLECTION}
                value={[addRole]}
                onValueChange={(details) => { setAddRole(details.value[0] as CreatorMemberRole); }}
              >
                <SelectControl>
                  <SelectTrigger aria-label="Role for new member">
                    <SelectValueText placeholder="Select role" />
                  </SelectTrigger>
                </SelectControl>
                <SelectContent>
                  {ROLE_COLLECTION.items.map((item) => (
                    <SelectItem key={item.value} item={item}>
                      <SelectItemText>{item.label}</SelectItemText>
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
              <button
                type="button"
                className={styles.addButton}
                onClick={() => void handleAddMember()}
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
                className={clsx(formStyles.input, styles.searchInput)}
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
                    >
                      <button
                        type="button"
                        className={styles.candidateButton}
                        onClick={() => handleSelectCandidate(c)}
                      >
                        <span className={styles.candidateName}>{c.name}</span>
                        <span className={styles.candidateEmail}>{c.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {hasSearched && candidates.length === 0 && (
                <p className={styles.noResults}>
                  No eligible users found. Only stakeholders and admins who aren't already members can be added.
                </p>
              )}
            </div>
          )}

          {/* Invite by email */}
          {!showInviteForm ? (
            <button
              type="button"
              className={styles.addButton}
              onClick={() => { setShowInviteForm(true); setInviteError(""); }}
              style={{ marginTop: "0.5rem" }}
            >
              Invite by email
            </button>
          ) : (
            <form onSubmit={(e) => { void handleInvite(e); }} style={{ marginTop: "0.75rem" }}>
              {inviteError && (
                <p style={{ color: "var(--color-error)", marginBottom: "0.5rem", fontSize: "var(--font-size-sm)" }} role="alert">
                  {inviteError}
                </p>
              )}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className={formStyles.input}
                  aria-label="Invite email"
                />
                <SelectRoot
                  collection={ROLE_COLLECTION}
                  value={[inviteRole]}
                  onValueChange={(details) => { setInviteRole(details.value[0] as CreatorMemberRole); }}
                >
                  <SelectControl>
                    <SelectTrigger aria-label="Invite role">
                      <SelectValueText placeholder="Select role" />
                    </SelectTrigger>
                  </SelectControl>
                  <SelectContent>
                    {ROLE_COLLECTION.items.map((item) => (
                      <SelectItem key={item.value} item={item}>
                        <SelectItemText>{item.label}</SelectItemText>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectRoot>
                <button type="submit" disabled={isInviting}>
                  {isInviting ? "Sending..." : "Send Invite"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowInviteForm(false); setInviteEmail(""); setInviteError(""); }}
                >
                  Cancel
                </button>
              </div>
            </form>
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
                      <SelectRoot
                        collection={ROLE_COLLECTION}
                        value={[member.role]}
                        onValueChange={(details) => {
                          void handleChangeRole(
                            member.userId,
                            details.value[0] as CreatorMemberRole,
                          );
                        }}
                        disabled={isSoleOwner}
                      >
                        <SelectControl>
                          <SelectTrigger aria-label={`Role for ${member.displayName}`}>
                            <SelectValueText placeholder="Select role" />
                          </SelectTrigger>
                        </SelectControl>
                        <SelectContent>
                          {ROLE_COLLECTION.items.map((item) => (
                            <SelectItem key={item.value} item={item}>
                              <SelectItemText>{item.label}</SelectItemText>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </SelectRoot>
                    ) : (
                      <span
                        className={clsx(styles.roleBadge, ROLE_BADGE_CLASS[member.role])}
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
                        onClick={() => void handleRemoveMember(member.userId)}
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
