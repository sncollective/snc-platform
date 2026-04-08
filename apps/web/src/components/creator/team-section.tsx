import { useEffect, useState, useRef, useCallback, memo } from "react";
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

// ── Memoized Sub-components ──

interface AddMemberFormProps {
  readonly creatorId: string;
  readonly onMembersUpdated: (members: CreatorMember[], message: string) => void;
  readonly onError: (message: string) => void;
}

/** Search for users and add them as team members. */
const AddMemberForm = memo(function AddMemberForm({
  creatorId,
  onMembersUpdated,
  onError,
}: AddMemberFormProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<CreatorMemberCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] =
    useState<CreatorMemberCandidate | null>(null);
  const [addRole, setAddRole] = useState<CreatorMemberRole>("editor");
  const [isAdding, setIsAdding] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
  }, [searchQuery, creatorId]);

  const handleSelectCandidate = (candidate: CreatorMemberCandidate): void => {
    setSelectedCandidate(candidate);
    setSearchQuery("");
    setCandidates([]);
  };

  const handleAddMember = async (): Promise<void> => {
    if (!selectedCandidate) return;
    setIsAdding(true);

    try {
      const res = await addCreatorMember(creatorId, {
        userId: selectedCandidate.id,
        role: addRole,
      });
      const name = selectedCandidate.name;
      const role = addRole;
      setSelectedCandidate(null);
      setAddRole("editor");
      onMembersUpdated(res.members, `Added ${name} as ${role}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setIsAdding(false);
    }
  };

  if (selectedCandidate) {
    return (
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
    );
  }

  return (
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
  );
});

interface InviteFormProps {
  readonly creatorId: string;
  readonly onInviteSent: (message: string) => void;
  readonly onError: (message: string) => void;
}

/** Send an email invite to join the team. */
const InviteForm = memo(function InviteForm({
  creatorId,
  onInviteSent,
  onError,
}: InviteFormProps): React.ReactElement {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CreatorMemberRole>("editor");
  const [formError, setFormError] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setFormError("");
    setIsInviting(true);

    try {
      await apiMutate("/api/invites", {
        method: "POST",
        body: { type: "team_member", email, creatorId, role },
      });
      setShowForm(false);
      setEmail("");
      setRole("editor");
      onInviteSent("Invite sent successfully");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setIsInviting(false);
    }
  };

  if (!showForm) {
    return (
      <button
        type="button"
        className={styles.addButton}
        onClick={() => { setShowForm(true); setFormError(""); }}
        style={{ marginTop: "0.5rem" }}
      >
        Invite by email
      </button>
    );
  }

  return (
    <form onSubmit={(e) => { void handleInvite(e); }} style={{ marginTop: "0.75rem" }}>
      {formError && (
        <p style={{ color: "var(--color-error)", marginBottom: "0.5rem", fontSize: "var(--font-size-sm)" }} role="alert">
          {formError}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          required
          className={formStyles.input}
          aria-label="Invite email"
        />
        <SelectRoot
          collection={ROLE_COLLECTION}
          value={[role]}
          onValueChange={(details) => { setRole(details.value[0] as CreatorMemberRole); }}
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
          onClick={() => { setShowForm(false); setEmail(""); setFormError(""); }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
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

  // ── Inline Role Editing State ──
  const [editingMember, setEditingMember] = useState<{ userId: string; role: string } | null>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);

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
    void loadMembers();
  }, [loadMembers]);

  // ── Handlers ──
  const handleChangeRole = useCallback(async (
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
  }, [creatorId]);

  const handleRemoveMember = useCallback(async (userId: string): Promise<void> => {
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
  }, [creatorId]);

  const handleMembersUpdated = useCallback((updatedMembers: CreatorMember[], message: string): void => {
    setError("");
    setMembers(updatedMembers);
    setSuccessMessage(message);
  }, []);

  const handleFormError = useCallback((message: string): void => {
    setSuccessMessage("");
    setError(message);
  }, []);

  const handleInviteSent = useCallback((message: string): void => {
    setError("");
    setSuccessMessage(message);
  }, []);

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

      {/* Add Member + Invite Forms (owners only) */}
      {canManageMembers && (
        <div>
          <AddMemberForm
            creatorId={creatorId}
            onMembersUpdated={handleMembersUpdated}
            onError={handleFormError}
          />
          <InviteForm
            creatorId={creatorId}
            onInviteSent={handleInviteSent}
            onError={handleFormError}
          />
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
                      <button
                        ref={member.userId === editingMember?.userId ? editTriggerRef : undefined}
                        className={clsx(styles.roleBadgeButton, ROLE_BADGE_CLASS[member.role])}
                        onClick={(e) => {
                          editTriggerRef.current = e.currentTarget;
                          setEditingMember({ userId: member.userId, role: member.role });
                        }}
                        disabled={isSoleOwner}
                        type="button"
                        aria-label={`Role for ${member.displayName}`}
                      >
                        {member.role}
                      </button>
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

      {/* Shared role selector — one instance positioned over the active badge */}
      {editingMember && (
        <SelectRoot
          collection={ROLE_COLLECTION}
          value={[editingMember.role]}
          onValueChange={(details) => {
            void handleChangeRole(
              editingMember.userId,
              details.value[0] as CreatorMemberRole,
            );
            setEditingMember(null);
          }}
          open
          onOpenChange={(details) => {
            if (!details.open) setEditingMember(null);
          }}
          positioning={{
            getAnchorRect: () => editTriggerRef.current?.getBoundingClientRect() ?? null,
          }}
        >
          <SelectContent>
            {ROLE_COLLECTION.items.map((item) => (
              <SelectItem key={item.value} item={item}>
                <SelectItemText>{item.label}</SelectItemText>
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
      )}
    </section>
  );
}
