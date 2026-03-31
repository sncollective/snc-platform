import type React from "react";
import { useEffect, useState } from "react";

import { Link } from "@tanstack/react-router";

import { apiGet } from "../../lib/fetch-utils.js";

import styles from "./creator-switcher.module.css";

// ── Types ──

interface MyCreator {
  readonly id: string;
  readonly displayName: string;
  readonly handle: string | null;
  readonly role: string;
  readonly avatarUrl: string | null;
}

interface CreatorSwitcherProps {
  readonly currentCreatorId: string;
  readonly currentSlug: string;
}

// ── Public API ──

/** Dropdown to switch between creators the user is a member of. */
export function CreatorSwitcher({ currentCreatorId }: CreatorSwitcherProps): React.ReactElement | null {
  const [creators, setCreators] = useState<readonly MyCreator[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCreators(): Promise<void> {
      try {
        const data = await apiGet<{ creators: MyCreator[] }>("/api/me/creators");
        setCreators(data.creators);
      } catch {
        setError("Failed to load creators");
      }
    }
    void loadCreators();
  }, []);

  // Don't render switcher if user only has one creator
  if (error || creators.length <= 1) return null;

  const otherCreators = creators.filter((c) => c.id !== currentCreatorId);

  return (
    <div className={styles.switcher}>
      <span className={styles.label}>Switch creator</span>
      <div className={styles.list}>
        {otherCreators.map((c) => (
          <Link
            key={c.id}
            to="/creators/$creatorId/manage"
            params={{ creatorId: c.handle ?? c.id }}
            className={styles.creatorLink}
          >
            {c.displayName}
            <span className={styles.role}>{c.role}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
